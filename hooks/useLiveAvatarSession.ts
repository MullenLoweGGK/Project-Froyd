"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  AppStatus,
  SessionApiResponse,
  SessionMetadata,
  TranscriptEntry,
} from "@/lib/types";
import { froydContent } from "@/lib/ldz-content";
import {
  clearCreditsExhausted,
  isCreditsExhaustedFromResponse,
  markCreditsExhausted,
} from "@/hooks/useCreditsExhausted";
import { preferMediaLoudspeaker } from "@/lib/media-speaker";

/**
 * Probe+release mic. On iOS Safari the first grant must run under a user gesture.
 * Use plain `{ audio: true }` — detailed constraints can fail as OverconstrainedError
 * on some iPhones without showing a permission dialog.
 */
async function requestMicrophoneAccess(): Promise<void> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  stream.getTracks().forEach((t) => t.stop());
}

/** Open mic under the current user gesture; caller must stop tracks when done. */
async function acquireMicrophoneStream(): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({ audio: true });
}

/** Prefer Permissions API — a second getUserMedia probe often fails spuriously on iOS. */
async function readMicrophonePermissionState(): Promise<
  PermissionState | "unknown"
> {
  try {
    const permissions = navigator.permissions;
    if (!permissions?.query) return "unknown";
    const status = await permissions.query({
      name: "microphone" as PermissionName,
    });
    return status.state;
  } catch {
    return "unknown";
  }
}

async function ensureMicrophoneAccess(): Promise<boolean> {
  const state = await readMicrophonePermissionState();
  if (state === "granted") return true;
  if (state === "denied") return false;

  try {
    await requestMicrophoneAccess();
    return true;
  } catch (err) {
    console.error("[LiveAvatar] mic ensure failed:", micErrorDetail(err));
    const name = err && typeof err === "object" ? (err as { name?: string }).name : "";
    if (name === "NotAllowedError" || name === "PermissionDeniedError") {
      return false;
    }
    return false;
  }
}

function micErrorDetail(err: unknown): string {
  if (!err || typeof err !== "object") return String(err);
  const e = err as { name?: string; message?: string };
  return [e.name, e.message].filter(Boolean).join(": ") || String(err);
}

export type LiveAvatarConfig = {
  avatarId: string;
  contextId?: string;
  voiceId?: string;
  language?: string;
  /**
   * Manual opening line via session.repeat() after CONNECTED + STREAM_READY.
   * Omit on courses — participant speaks first.
   */
  openingText?: string;
  /** Hard stop after this many user turns. Omit / undefined = no limit. */
  questionLimit?: number;
  /** Forced line spoken via session.repeat() when the limit is hit. */
  questionLimitMessage?: string;
  /** Spoken on every further user turn after the limit (5th+). */
  questionLimitFollowupMessage?: string;
  /** Talk clock after first mic unmute (ms). Default 120s. */
  maxSessionMs?: number;
};

export type HumanErrorCode =
  | "missing-config"
  | "session-failed"
  | "credit-limit"
  | "mic-denied"
  | "connection"
  | "stream"
  | "disconnect"
  | "unsupported"
  | "unknown";

type SessionLike = {
  stop: () => Promise<void>;
  attach: (el: HTMLVideoElement) => void;
  start: () => Promise<void>;
  /** SDK: LiveAvatarSession.repeat(message: string): string (event id) */
  repeat: (message: string) => string;
  interrupt: () => void;
  /** FULL mode: switch agent from idle → listening so user speech is processed */
  startListening: () => string;
  stopListening: () => string;
  keepAlive?: () => Promise<void>;
  voiceChat: {
    isMuted: boolean;
    /** INACTIVE | STARTING | ACTIVE — unmute is a no-op while INACTIVE */
    state: string;
    start: (config?: { defaultMuted?: boolean }) => Promise<void>;
    stop: () => void;
    mute: () => Promise<void>;
    unmute: () => Promise<void>;
    on: (event: string, cb: (...args: never[]) => void) => void;
  };
  on: (event: string, cb: (...args: never[]) => void) => void;
};

/**
 * Make voice chat ACTIVE + unmuted and tell the agent to listen.
 * Soft path never calls stop() (that breaks Safari). forceRestart only under a click.
 * ACTIVE is treated as success even if isMuted flakes — startListening still helps.
 */
async function ensureVoiceChatListening(
  session: SessionLike,
  opts: { forceRestart?: boolean } = {}
): Promise<boolean> {
  const vc = session.voiceChat;
  const startListeningSafe = () => {
    try {
      session.startListening();
    } catch (err) {
      debugLog("START_LISTENING_FAILED", err);
    }
  };

  if (vc.state === "ACTIVE") {
    if (vc.isMuted) {
      try {
        await vc.unmute();
      } catch (err) {
        debugLog("VOICE_CHAT_UNMUTE_FAILED", err);
      }
    }
    startListeningSafe();
    debugLog("VOICE_CHAT_LISTENING", {
      ok: true,
      path: "active",
      muted: vc.isMuted,
    });
    return true;
  }

  if (!opts.forceRestart) {
    try {
      await vc.start({ defaultMuted: false });
    } catch (err) {
      debugLog("VOICE_CHAT_START_FAILED", err);
    }
    if (vc.state === "ACTIVE") {
      if (vc.isMuted) {
        try {
          await vc.unmute();
        } catch {
          /* ignore */
        }
      }
      startListeningSafe();
      return true;
    }
    startListeningSafe();
    debugLog("VOICE_CHAT_LISTENING", {
      ok: false,
      path: "soft",
      state: vc.state,
      muted: vc.isMuted,
    });
    return false;
  }

  // Hard restart under user gesture only.
  try {
    vc.stop();
  } catch {
    /* already stopped */
  }

  let probe: MediaStream | null = null;
  try {
    probe = await acquireMicrophoneStream();
    await vc.start({ defaultMuted: false });
  } catch (err) {
    debugLog("VOICE_CHAT_RESTART_FAILED", err);
    probe?.getTracks().forEach((t) => t.stop());
    startListeningSafe();
    return false;
  }
  probe.getTracks().forEach((t) => t.stop());

  if (vc.isMuted) {
    try {
      await vc.unmute();
    } catch {
      /* ignore */
    }
  }
  startListeningSafe();
  const ok = vc.state === "ACTIVE";
  debugLog("VOICE_CHAT_LISTENING", {
    ok,
    path: "restart",
    state: vc.state,
    muted: vc.isMuted,
  });
  return ok;
}

type IntroGate = {
  sessionId: string;
  streamReady: boolean;
  sessionConnected: boolean;
  /** User saw the ready prompt (CONNECTED + STREAM_READY). */
  readyPromptShown: boolean;
  /** User confirmed — intro may run once. */
  introStarted: boolean;
  introInProgress: boolean;
  /** Mic unmuted after intro — user turns count toward the question limit. */
  conversationActive: boolean;
  /** Completed user speak turns after intro. */
  userTurnCount: number;
  questionLimit: number;
  questionLimitMessage?: string;
  questionLimitFollowupMessage?: string;
  /** interrupt() issued; waiting to start forced closing line. */
  forceClosing: boolean;
  /** Forced closing line is currently being spoken via repeat(). */
  closingSpeakPending: boolean;
  /** Limit already enforced — keep mic muted. */
  questionLimitReached: boolean;
  openingText?: string;
};

const DEFAULT_MAX_SESSION_MS = 120_000;

function toHumanError(
  code: HumanErrorCode,
  technical?: string,
  language: string = "sk"
): string {
  if (process.env.NODE_ENV === "development" && technical) {
    console.error(`[LiveAvatar] ${code}:`, technical);
  }

  const en = language === "en";

  switch (code) {
    case "missing-config":
      return en
        ? "This scenario isn’t ready yet. Please try another avatar."
        : "Tento scenár ešte nie je pripravený. Skúste prosím iný avatar.";
    case "session-failed": {
      // LiveAvatar platform outage (HTML 502/503) — not a local env misconfig.
      if (
        technical &&
        /upstream|503|502|Service Temporarily Unavailable|Non-JSON response/i.test(
          technical
        )
      ) {
        return en
          ? "HeyGen LiveAvatar is temporarily unavailable. Please try again in a few minutes."
          : "HeyGen LiveAvatar je dočasne nedostupný. Skúste to znova o pár minút.";
      }
      if (technical && /LIVEAVATAR_API_KEY is not configured/i.test(technical)) {
        return en
          ? "Couldn’t start the conversation — server is missing LIVEAVATAR_API_KEY on this Vercel project (Production)."
          : "Nepodarilo sa spustiť rozhovor — na tomto Vercel projekte chýba LIVEAVATAR_API_KEY (Production).";
      }
      return en
        ? "Couldn’t start the conversation. Please try again in a moment."
        : "Nepodarilo sa spustiť rozhovor. Skúste to znova o chvíľu.";
    }
    case "credit-limit":
      return froydContent.creditLimit.message;
    case "mic-denied":
      return en
        ? "Microphone is blocked for this site. In Safari: Safari → Settings for This Website → Microphone → Allow, then click “Start conversation” again. (If no dialog appears, it was blocked earlier — change it in those settings.)"
        : "Mikrofón je pre tento web zablokovaný. V Safari: Safari → Nastavenia pre tento web → Mikrofón → Povoliť, potom znova „Začať rozhovor“. (Ak dialóg nevyskočí, bol skôr zamietnutý — zmeňte to v týchto nastaveniach.)";
    case "connection":
      return en
        ? "Connection failed. Check your internet and try again."
        : "Pripojenie sa nepodarilo. Skontrolujte internet a skúste znova.";
    case "stream":
      return en
        ? "Couldn’t load the avatar video. Please start the conversation again."
        : "Video avatára sa nepodarilo načítať. Skúste rozhovor spustiť znova.";
    case "disconnect":
      return en
        ? "The conversation ended unexpectedly. You can start again."
        : "Rozhovor sa neočakávane ukončil. Môžete ho spustiť znova.";
    case "unsupported":
      return en
        ? "Your browser doesn’t support voice conversation. Try a newer browser."
        : "Váš prehliadač nepodporuje hlasový rozhovor. Skúste novší prehliadač.";
    default:
      return en
        ? "Something went wrong. Please try again."
        : "Niečo sa pokazilo. Skúste to prosím znova.";
  }
}

function debugLog(event: string, detail?: unknown) {
  if (process.env.NODE_ENV === "production") return;
  if (detail !== undefined) {
    console.debug(`[LiveAvatar] ${event}`, detail);
  } else {
    console.debug(`[LiveAvatar] ${event}`);
  }
}

/**
 * Shared LiveAvatar session controller.
 * Only one session should exist at a time — callers must stop before starting another.
 * The HeyGen SDK is dynamically imported only when the user starts a session.
 */
/** Settle after audio unlock / re-attach, before session.repeat(openingText). */
const INTRO_BUFFER_MS = 1200;

async function unlockBrowserAudio(): Promise<void> {
  try {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    if (ctx.state === "suspended") {
      await ctx.resume();
    }
    const buffer = ctx.createBuffer(1, 1, 22050);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);
    // Keep context briefly alive, then close to avoid leaking.
    window.setTimeout(() => {
      void ctx.close().catch(() => null);
    }, 500);
  } catch {
    /* ignore — best-effort unlock */
  }
}

function wait(ms: number, storeTimer: (id: ReturnType<typeof setTimeout> | null) => void) {
  return new Promise<void>((resolve) => {
    const id = setTimeout(() => {
      storeTimer(null);
      resolve();
    }, ms);
    storeTimer(id);
  });
}

/** Ensure the <video> element is unmuted, playing, and has a live audio track when possible. */
async function primeAvatarMedia(
  video: HTMLVideoElement,
  attach: () => void
): Promise<void> {
  try {
    attach();
  } catch {
    /* stream may already be attached */
  }

  video.muted = false;
  video.defaultMuted = false;
  video.volume = 1;

  try {
    await video.play();
  } catch {
    /* may still succeed after unlock */
  }

  await new Promise<void>((resolve) => {
    const timeout = window.setTimeout(() => resolve(), 4000);

    const done = () => {
      window.clearTimeout(timeout);
      video.removeEventListener("playing", onPlaying);
      resolve();
    };

    const onPlaying = () => done();
    video.addEventListener("playing", onPlaying);

    const stream = video.srcObject;
    const hasLiveAudio =
      stream instanceof MediaStream &&
      stream.getAudioTracks().some((t) => t.readyState === "live" && t.enabled);

    if (!video.paused && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && hasLiveAudio) {
      done();
      return;
    }

    // Poll briefly for live audio after attach.
    const started = Date.now();
    const poll = () => {
      const s = video.srcObject;
      const audioLive =
        s instanceof MediaStream &&
        s.getAudioTracks().some((t) => t.readyState === "live" && t.enabled);
      if (!video.paused && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && audioLive) {
        done();
        return;
      }
      if (Date.now() - started > 4000) {
        done();
        return;
      }
      window.requestAnimationFrame(poll);
    };
    window.requestAnimationFrame(poll);
  });
}

export function useLiveAvatarSession() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const sessionRef = useRef<SessionLike | null>(null);
  const transcriptRef = useRef<TranscriptEntry[]>([]);
  const maxDurationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** 120s talk clock starts on first mic unmute after intro — not on CONNECTED. */
  const maxDurationArmedRef = useRef(false);
  const introTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const introGateRef = useRef<IntroGate | null>(null);
  /** iOS only shows the mic prompt during a user gesture — grant on "Spustiť". */
  const micPermissionGrantedRef = useRef(false);
  /** Session UI language for human-readable errors (sk | en). */
  const languageRef = useRef("sk");
  /** Per-session talk clock (armed on first unmute). */
  const maxSessionMsRef = useRef(DEFAULT_MAX_SESSION_MS);

  const [status, setStatus] = useState<AppStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [sessionMeta, setSessionMeta] = useState<SessionMetadata | null>(null);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [avatarChunk, setAvatarChunk] = useState("");
  const [lastAvatarText, setLastAvatarText] = useState("");
  const [micMuted, setMicMuted] = useState(false);
  const [preparingIntro, setPreparingIntro] = useState(false);
  const [questionLimitReached, setQuestionLimitReached] = useState(false);
  const [micPermissionGranted, setMicPermissionGranted] = useState(false);

  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  const clearMaxDurationTimer = useCallback(() => {
    if (maxDurationTimerRef.current) {
      clearTimeout(maxDurationTimerRef.current);
      maxDurationTimerRef.current = null;
    }
  }, []);

  const clearIntroTimer = useCallback(() => {
    if (introTimerRef.current) {
      clearTimeout(introTimerRef.current);
      introTimerRef.current = null;
    }
  }, []);

  const resetIntroGate = useCallback(() => {
    clearIntroTimer();
    introGateRef.current = null;
  }, [clearIntroTimer]);

  const addEntry = useCallback((role: "user" | "avatar" | "system", text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setTranscript((prev) => [
      ...prev,
      { role, text: trimmed, timestamp: new Date().toISOString() },
    ]);
  }, []);

  const saveTranscript = useCallback(
    async (meta: SessionMetadata, entries: TranscriptEntry[], endedAt: string) => {
      try {
        await fetch("/api/session/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: meta.sessionId,
            avatarId: meta.avatarId,
            contextId: meta.contextId,
            voiceId: meta.voiceId,
            language: meta.language,
            startedAt: meta.startedAt,
            endedAt,
            entries,
          }),
        });
      } catch (err) {
        if (process.env.NODE_ENV === "development") {
          console.error("[LiveAvatar] transcript save failed", err);
        }
      }
    },
    []
  );

  const stopSession = useCallback(async () => {
    clearMaxDurationTimer();
    maxDurationArmedRef.current = false;
    resetIntroGate();
    setPreparingIntro(false);
    setQuestionLimitReached(false);

    const session = sessionRef.current;
    if (!session) {
      setStatus((s) => (s === "idle" ? s : "stopped"));
      setMicMuted(false);
      return;
    }

    setStatus("stopping");
    try {
      await session.stop();
    } catch {
      // stop() may throw if already disconnected
    }

    sessionRef.current = null;
    setMicMuted(false);
    const endedAt = new Date().toISOString();

    setSessionMeta((prev) => {
      if (prev) {
        void saveTranscript(prev, transcriptRef.current, endedAt);
        return { ...prev, endedAt };
      }
      return prev;
    });

    setStatus("stopped");
  }, [clearMaxDurationTimer, resetIntroGate, saveTranscript]);

  /** Starts the 120s talk clock once — first mic unmute after the intro. */
  const armMaxDurationTimer = useCallback(() => {
    if (maxDurationArmedRef.current) return;
    maxDurationArmedRef.current = true;
    clearMaxDurationTimer();
    const maxMs = maxSessionMsRef.current;
    const maxMinutes = Math.max(1, Math.round(maxMs / 60_000));
    debugLog("MAX_DURATION_ARMED", { ms: maxMs });
    maxDurationTimerRef.current = setTimeout(() => {
      maxDurationTimerRef.current = null;
      void (async () => {
        await stopSession();
        setError(
          languageRef.current === "en"
            ? `You’ve reached the maximum conversation time (${maxMinutes} minutes). You can start a new conversation.`
            : `Dosiahli ste maximálny čas rozhovoru (${maxMinutes} minút). Môžete spustiť nový rozhovor.`
        );
      })();
    }, maxMs);
  }, [clearMaxDurationTimer, stopSession]);

  const toggleMic = useCallback(async () => {
    const session = sessionRef.current;
    if (!session) return;
    // Keep mic muted while the scripted intro is speaking / after question limit.
    if (introGateRef.current?.introInProgress) return;
    if (introGateRef.current?.forceClosing || introGateRef.current?.closingSpeakPending) {
      return;
    }
    try {
      // If voice chat never became ACTIVE (Safari after Spustiť), recreate under this click.
      if (session.voiceChat.state !== "ACTIVE") {
        await ensureVoiceChatListening(session, { forceRestart: true });
        setMicMuted(session.voiceChat.isMuted);
        return;
      }
      if (session.voiceChat.isMuted) {
        await session.voiceChat.unmute();
        try {
          session.startListening();
        } catch {
          /* ignore */
        }
      } else {
        await session.voiceChat.mute();
      }
    } catch (err) {
      if (process.env.NODE_ENV === "development") {
        console.error("[LiveAvatar] mic toggle failed", err);
      }
    }
  }, []);

  const startSession = useCallback(
    async (config: LiveAvatarConfig) => {
      languageRef.current = config.language === "en" ? "en" : "sk";
      maxSessionMsRef.current =
        typeof config.maxSessionMs === "number" && config.maxSessionMs > 0
          ? config.maxSessionMs
          : DEFAULT_MAX_SESSION_MS;

      if (!config.avatarId) {
        setError(toHumanError("missing-config", undefined, languageRef.current));
        setStatus("error");
        return;
      }

      if (typeof window === "undefined" || !navigator?.mediaDevices?.getUserMedia) {
        setError(toHumanError("unsupported", undefined, languageRef.current));
        setStatus("error");
        return;
      }

      // Warm mic under “Spustiť” (same as campaign). Keep the stream until after
      // session.start() so the SDK can publish a local audio track.
      let micWarmup: MediaStream | null = null;
      try {
        micWarmup = await acquireMicrophoneStream();
        micPermissionGrantedRef.current = true;
        setMicPermissionGranted(true);
      } catch (err) {
        micPermissionGrantedRef.current = false;
        setMicPermissionGranted(false);
        console.error("[LiveAvatar] mic warmup on start:", micErrorDetail(err));
      }

      try {
        await preferMediaLoudspeaker(videoRef.current);
        await unlockBrowserAudio();
      } catch {
        /* best-effort */
      }

      if (sessionRef.current) {
        await stopSession();
      }

      clearMaxDurationTimer();
      maxDurationArmedRef.current = false;
      resetIntroGate();
      setPreparingIntro(false);
      setQuestionLimitReached(false);
      setError(null);
      setTranscript([]);
      setAvatarChunk("");
      setLastAvatarText("");
      setStatus("creating-session");

      let sessionToken: string;
      let sessionId: string;

      try {
        const res = await fetch("/api/liveavatar/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            avatarId: config.avatarId,
            contextId: config.contextId || undefined,
            voiceId: config.voiceId || undefined,
            language: config.language ?? "sk",
            isSandbox: process.env.NEXT_PUBLIC_USE_SANDBOX === "true",
          }),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: res.statusText }));
          if (isCreditsExhaustedFromResponse(res.status, body)) {
            markCreditsExhausted();
            setError(toHumanError("credit-limit", String((body as { detail?: string }).detail ?? ""), languageRef.current));
            setStatus("error");
            return;
          }
          const code = (body as { code?: string }).code;
          const detail = (body as { detail?: string }).detail;
          throw new Error(
            [code, (body as { error?: string }).error, detail]
              .filter(Boolean)
              .join(": ") || `Backend returned HTTP ${res.status}`
          );
        }

        const data = (await res.json()) as SessionApiResponse;
        sessionToken = data.sessionToken;
        sessionId = data.sessionId;
        clearCreditsExhausted();
      } catch (err) {
        setError(toHumanError("session-failed", String(err), languageRef.current));
        setStatus("error");
        return;
      }

      setStatus("connecting");

      try {
        const sdk = await import("@heygen/liveavatar-web-sdk");
        const {
          LiveAvatarSession,
          SessionEvent,
          SessionState,
          AgentEventsEnum,
          SessionDisconnectReason,
          VoiceChatEvent,
        } = sdk;

        // Courses: keep mic live from session.start (no second getUserMedia).
        // Campaign: start muted until after the scripted intro.
        const isCoursesSession = !config.openingText?.trim();
        const session = new LiveAvatarSession(sessionToken, {
          voiceChat: isCoursesSession ? {} : { defaultMuted: true },
          autoKeepAlive: true,
        });
        const sessionLike = session as unknown as SessionLike;
        sessionRef.current = sessionLike;

        // Per-session intro gate — identity is this object + sessionId.
        const gate: IntroGate = {
          sessionId,
          streamReady: false,
          sessionConnected: false,
          readyPromptShown: false,
          introStarted: false,
          introInProgress: false,
          conversationActive: false,
          userTurnCount: 0,
          // Infinity = no hard question limit (courses site).
          questionLimit:
            typeof config.questionLimit === "number" && config.questionLimit > 0
              ? Math.max(1, config.questionLimit)
              : Number.POSITIVE_INFINITY,
          questionLimitMessage: config.questionLimitMessage?.trim() || undefined,
          questionLimitFollowupMessage:
            config.questionLimitFollowupMessage?.trim() || undefined,
          forceClosing: false,
          closingSpeakPending: false,
          questionLimitReached: false,
          openingText: config.openingText?.trim() || undefined,
        };
        introGateRef.current = gate;

        const now = new Date().toISOString();

        setSessionMeta({
          sessionId,
          avatarId: config.avatarId,
          contextId: config.contextId || undefined,
          voiceId: config.voiceId || undefined,
          language: config.language ?? "sk",
          startedAt: now,
          sandbox: process.env.NEXT_PUBLIC_USE_SANDBOX === "true",
        });

        const isCurrentSession = () =>
          introGateRef.current === gate && sessionRef.current === sessionLike;

        /** Pause after CONNECTED + STREAM_READY — wait for explicit user confirm. */
        const maybeEnterReadyGate = async () => {
          if (
            !gate.streamReady ||
            !gate.sessionConnected ||
            gate.readyPromptShown ||
            gate.introStarted ||
            !isCurrentSession()
          ) {
            return;
          }

          gate.readyPromptShown = true;
          debugLog("READY_GATE", {
            sessionId: gate.sessionId,
            courses: isCoursesSession,
            voiceState: sessionLike.voiceChat.state,
            muted: sessionLike.voiceChat.isMuted,
          });

          if (videoRef.current) {
            try {
              await videoRef.current.play();
            } catch {
              /* autoplay may wait for the confirm click */
            }
          }

          if (!isCurrentSession()) return;

          // Courses: skip the ready-gate click loop entirely — go live immediately.
          // Mic was granted on Spustiť; muting/restarting here is what broke Safari.
          if (isCoursesSession) {
            gate.introStarted = true;
            gate.conversationActive = true;
            await ensureVoiceChatListening(sessionLike, { forceRestart: false });
            if (videoRef.current) {
              await primeAvatarMedia(videoRef.current, () => {
                try {
                  sessionLike.attach(videoRef.current as HTMLVideoElement);
                } catch {
                  /* ignore */
                }
              });
            }
            await preferMediaLoudspeaker(videoRef.current);
            await unlockBrowserAudio();
            if (!isCurrentSession()) return;
            setPreparingIntro(false);
            setError(null);
            setMicMuted(sessionLike.voiceChat.isMuted);
            setStatus("ready");
            debugLog("COURSES_LIVE", {
              sessionId: gate.sessionId,
              state: sessionLike.voiceChat.state,
              muted: sessionLike.voiceChat.isMuted,
            });
            return;
          }

          try {
            await sessionLike.voiceChat.mute();
          } catch (err) {
            debugLog("READY_GATE_MUTE_FAILED", err);
          }

          setError(null);
          setStatus("awaiting-ready");
        };

        session.voiceChat.on(VoiceChatEvent.MUTED, () => setMicMuted(true));
        session.voiceChat.on(VoiceChatEvent.UNMUTED, () => {
          setMicMuted(false);
          // Talk clock starts when the mic is first enabled (after intro).
          armMaxDurationTimer();
          void preferMediaLoudspeaker(videoRef.current);
        });

        session.on(SessionEvent.SESSION_STATE_CHANGED, (state) => {
          if (state === SessionState.CONNECTED) {
            debugLog("SESSION_CONNECTED", { sessionId });
            gate.sessionConnected = true;
            void maybeEnterReadyGate();
          }
          if (state === SessionState.DISCONNECTING) setStatus("stopping");
          if (state === SessionState.DISCONNECTED) {
            clearMaxDurationTimer();
            resetIntroGate();
            setStatus("disconnected");
            if (sessionRef.current === sessionLike) {
              sessionRef.current = null;
            }
          }
        });

        session.on(SessionEvent.SESSION_STREAM_READY, () => {
          debugLog("STREAM_READY", { sessionId });
          if (videoRef.current) {
            session.attach(videoRef.current);
            void videoRef.current.play().catch(() => null);
            void preferMediaLoudspeaker(videoRef.current);
          }
          gate.streamReady = true;
          void maybeEnterReadyGate();
        });

        session.on(SessionEvent.SESSION_DISCONNECTED, (reason) => {
          debugLog("SESSION_DISCONNECTED", { sessionId, reason });
          clearMaxDurationTimer();
          resetIntroGate();
          if (reason !== SessionDisconnectReason.CLIENT_INITIATED) {
            setStatus("disconnected");
            setError(toHumanError("disconnect", undefined, languageRef.current));
          }
          if (sessionRef.current === sessionLike) {
            sessionRef.current = null;
          }
        });

        const activateConversation = async () => {
          gate.conversationActive = true;
          const listening = await ensureVoiceChatListening(sessionLike, {
            forceRestart: false,
          });
          if (!listening) {
            debugLog("CONVERSATION_UNMUTE_FAILED", {
              state: sessionLike.voiceChat.state,
              muted: sessionLike.voiceChat.isMuted,
            });
          }
          // Mic unmute can flip Android into call/earpiece mode — re-assert media speaker.
          await preferMediaLoudspeaker(videoRef.current);
        };

        /**
         * Deterministic question-limit lines — do not rely on HeyGen prompt.
         * 4th turn: full limit message; 5th+: follow-up message (repeat every time).
         */
        const speakForcedLimitLine = async (message: string) => {
          if (!message) return;
          if (gate.forceClosing || gate.closingSpeakPending) return;
          if (!isCurrentSession()) return;

          gate.forceClosing = true;
          debugLog("QUESTION_LIMIT_ENFORCE", {
            sessionId: gate.sessionId,
            turn: gate.userTurnCount,
            limit: gate.questionLimit,
          });

          try {
            sessionLike.interrupt();
          } catch (err) {
            debugLog("QUESTION_LIMIT_INTERRUPT_FAILED", err);
          }

          try {
            await sessionLike.voiceChat.mute();
          } catch (err) {
            debugLog("QUESTION_LIMIT_MUTE_FAILED", err);
          }

          try {
            sessionLike.stopListening();
          } catch (err) {
            debugLog("QUESTION_LIMIT_STOP_LISTEN_FAILED", err);
          }

          await wait(350, (id) => {
            introTimerRef.current = id;
          });

          if (!isCurrentSession()) return;

          gate.closingSpeakPending = true;
          setStatus("avatar-speaking");
          setAvatarChunk("");

          try {
            sessionLike.repeat(message);
            addEntry("avatar", message);
            setLastAvatarText(message);
          } catch (err) {
            debugLog("QUESTION_LIMIT_REPEAT_FAILED", err);
            gate.forceClosing = false;
            gate.closingSpeakPending = false;
            gate.questionLimitReached = true;
            setQuestionLimitReached(true);
            void activateConversation();
            setStatus("ready");
          }
        };

        session.on(AgentEventsEnum.USER_SPEAK_STARTED, () => {
          if (introGateRef.current?.introInProgress) return;
          if (introGateRef.current?.forceClosing) return;
          if (introGateRef.current?.closingSpeakPending) return;
          setStatus("user-speaking");
        });
        session.on(AgentEventsEnum.USER_SPEAK_ENDED, () => {
          if (introGateRef.current !== gate) return;
          if (gate.introInProgress || gate.forceClosing || gate.closingSpeakPending) {
            return;
          }
          if (!gate.conversationActive) {
            setStatus("ready");
            return;
          }

          gate.userTurnCount += 1;
          debugLog("USER_TURN", {
            sessionId: gate.sessionId,
            turn: gate.userTurnCount,
            limit: gate.questionLimit,
          });

          if (
            Number.isFinite(gate.questionLimit) &&
            gate.userTurnCount === gate.questionLimit &&
            gate.questionLimitMessage
          ) {
            void speakForcedLimitLine(gate.questionLimitMessage);
            return;
          }

          if (
            Number.isFinite(gate.questionLimit) &&
            gate.userTurnCount > gate.questionLimit
          ) {
            const followup =
              gate.questionLimitFollowupMessage || gate.questionLimitMessage;
            if (followup) {
              void speakForcedLimitLine(followup);
              return;
            }
          }

          setStatus("ready");
        });
        session.on(AgentEventsEnum.AVATAR_SPEAK_STARTED, () => {
          if (introGateRef.current === gate && gate.forceClosing && !gate.closingSpeakPending) {
            // Discarded agent audio after interrupt — ignore.
            return;
          }
          setStatus("avatar-speaking");
          setAvatarChunk("");
        });
        session.on(AgentEventsEnum.AVATAR_SPEAK_ENDED, () => {
          if (introGateRef.current !== gate) {
            setStatus("ready");
            setAvatarChunk("");
            return;
          }

          // Agent reply cut by interrupt before our forced line starts.
          if (gate.forceClosing && !gate.closingSpeakPending) {
            setAvatarChunk("");
            return;
          }

          // Forced limit / follow-up line finished — unmute so further turns can repeat it.
          if (gate.closingSpeakPending) {
            gate.closingSpeakPending = false;
            gate.forceClosing = false;
            gate.questionLimitReached = true;
            setQuestionLimitReached(true);
            debugLog("QUESTION_LIMIT_DONE", { sessionId: gate.sessionId });
            void activateConversation();
            setStatus("ready");
            setAvatarChunk("");
            return;
          }

          if (gate.introInProgress) {
            gate.introInProgress = false;
            debugLog("INTRO_ENDED", { sessionId: gate.sessionId });
            void activateConversation();
          }
          setStatus("ready");
          setAvatarChunk("");
        });

        session.on(AgentEventsEnum.USER_TRANSCRIPTION, (evt) => {
          try {
            if (evt?.text) addEntry("user", evt.text);
          } catch {
            /* ignore malformed */
          }
        });

        session.on(AgentEventsEnum.AVATAR_TRANSCRIPTION_CHUNK, (evt) => {
          try {
            if (gate.forceClosing && !gate.closingSpeakPending) return;
            if (evt?.text) setAvatarChunk(evt.text);
          } catch {
            /* ignore */
          }
        });

        session.on(AgentEventsEnum.AVATAR_TRANSCRIPTION, (evt) => {
          try {
            // Skip partial/aborted agent reply while forcing the closing line.
            if (gate.forceClosing && !gate.closingSpeakPending) return;
            if (gate.closingSpeakPending) return; // we already logged the fixed line
            if (evt?.text) {
              addEntry("avatar", evt.text);
              setLastAvatarText(evt.text);
              setAvatarChunk("");
            }
          } catch {
            /* ignore */
          }
        });

        session.on(AgentEventsEnum.SESSION_STOPPED, () => {
          clearMaxDurationTimer();
          resetIntroGate();
          setStatus("stopped");
          if (sessionRef.current === sessionLike) {
            sessionRef.current = null;
          }
        });

        await session.start();
        // If configureSession failed to open the mic, retry once while Spustiť's
        // warmup stream is still alive (helps Safari publish a LiveKit track).
        if (sessionLike.voiceChat.state !== "ACTIVE") {
          try {
            await sessionLike.voiceChat.start({ defaultMuted: isCoursesSession ? false : true });
          } catch (err) {
            debugLog("VOICE_CHAT_RETRY_AFTER_START_FAILED", err);
          }
        }
        // Release warmup tracks after SDK has published its own mic track.
        micWarmup?.getTracks().forEach((t) => t.stop());
        micWarmup = null;
        debugLog("VOICE_CHAT_AFTER_START", {
          sessionId,
          state: sessionLike.voiceChat.state,
          muted: sessionLike.voiceChat.isMuted,
        });
      } catch (err) {
        micWarmup?.getTracks().forEach((t) => t.stop());
        micWarmup = null;
        clearMaxDurationTimer();
        resetIntroGate();
        const msg = String(err);
        // HeyGen often returns a generic "Errors validating session token";
        // surface a clearer public message when the cause is identifiable.
        const code: HumanErrorCode = /Permission|NotAllowed|mic|microphone/i.test(msg)
          ? "mic-denied"
          : /Voice not found|voice_id/i.test(msg)
            ? "missing-config"
            : /timeout|network|fetch|connect/i.test(msg)
              ? "connection"
              : "stream";
        const human =
          /Errors validating session token/i.test(msg)
            ? languageRef.current === "en"
              ? "Couldn’t start the avatar. Check the voice ID / knowledge base ID in HeyGen LiveAvatar (the avatar may be fine, but the voice or context may not)."
              : "Nepodarilo sa spustiť avatara. Skontrolujte voice ID / knowledge base ID v HeyGen LiveAvatar (avatar môže byť v poriadku, ale hlas alebo kontext nie)."
            : toHumanError(code, msg, languageRef.current);
        setError(msg && msg !== "undefined" ? `${human} (${msg})` : human);
        if (process.env.NODE_ENV === "development") {
          console.error("[LiveAvatar] session.start failed:", err);
        }
        setStatus("error");
        sessionRef.current = null;
      }
    },
    [
      addEntry,
      armMaxDurationTimer,
      clearIntroTimer,
      clearMaxDurationTimer,
      resetIntroGate,
      stopSession,
    ]
  );

  /**
   * After disclaimer / "start now": unlock audio, prime media, then either
   * speak openingText or (courses) open mic + unmute under the same click.
   */
  const confirmReady = useCallback(async (): Promise<boolean> => {
    const gate = introGateRef.current;
    const session = sessionRef.current;
    const lang = languageRef.current;

    if (!gate || !session) {
      setError(
        lang === "en"
          ? "The connection dropped. Close this window and start the conversation again."
          : "Spojenie sa prerušilo. Zavrite okno a spustite rozhovor znova."
      );
      setStatus("error");
      return false;
    }
    if (!gate.streamReady || !gate.sessionConnected) {
      setError(
        lang === "en"
          ? "The avatar is still connecting. Wait a second, then click Start conversation again."
          : "Avatar sa ešte pripája. Počkajte chvíľu a znova kliknite na Začať rozhovor."
      );
      setStatus("awaiting-ready");
      return false;
    }
    // Allow retry after a failed confirm (introStarted may have been left true).
    if (gate.introStarted) {
      gate.introStarted = false;
    }

    gate.introStarted = true;
    setPreparingIntro(true);
    setError(null);
    debugLog("USER_READY_CONFIRMED", {
      sessionId: gate.sessionId,
      hasOpening: Boolean(gate.openingText),
    });

    // Mic: only prompt if Spustiť didn’t already grant. A second getUserMedia on
    // Safari/iOS often fails spuriously — and MUST be the first await under the click.
    if (!micPermissionGrantedRef.current) {
      try {
        await requestMicrophoneAccess();
        micPermissionGrantedRef.current = true;
        setMicPermissionGranted(true);
      } catch (err) {
        console.error("[LiveAvatar] mic permission on confirm:", micErrorDetail(err));
        gate.introStarted = false;
        setPreparingIntro(false);
        setError(toHumanError("mic-denied", micErrorDetail(err), lang));
        setStatus("awaiting-ready");
        return false;
      }
    } else {
      setMicPermissionGranted(true);
    }

    if (introGateRef.current !== gate || sessionRef.current !== session) {
      setPreparingIntro(false);
      return false;
    }

    // ── Courses fallback (ready gate skipped in normal flow) ──
    if (!gate.openingText) {
      await ensureVoiceChatListening(session, { forceRestart: true });
      if (videoRef.current) {
        await primeAvatarMedia(videoRef.current, () => {
          try {
            session.attach(videoRef.current as HTMLVideoElement);
          } catch {
            /* ignore */
          }
        });
      }
      await preferMediaLoudspeaker(videoRef.current);
      await unlockBrowserAudio();
      gate.conversationActive = true;
      setPreparingIntro(false);
      setError(null);
      setMicMuted(session.voiceChat.isMuted);
      setStatus("ready");
      return true;
    }

    // ── Campaign path (scripted intro) ──
    setError(null);

    if (introGateRef.current !== gate || sessionRef.current !== session) return false;

    await preferMediaLoudspeaker(videoRef.current);
    await unlockBrowserAudio();

    if (introGateRef.current !== gate || sessionRef.current !== session) return false;

    try {
      await session.voiceChat.mute();
    } catch (err) {
      debugLog("INTRO_MUTE_FAILED", err);
    }

    if (introGateRef.current !== gate || sessionRef.current !== session) return false;

    debugLog("INTRO_SCHEDULED", {
      sessionId: gate.sessionId,
      bufferMs: INTRO_BUFFER_MS,
    });

    await wait(INTRO_BUFFER_MS, (id) => {
      introTimerRef.current = id;
    });

    if (introGateRef.current !== gate || sessionRef.current !== session) return false;

    if (videoRef.current) {
      await primeAvatarMedia(videoRef.current, () => {
        try {
          session.attach(videoRef.current as HTMLVideoElement);
        } catch {
          /* ignore */
        }
      });
      await preferMediaLoudspeaker(videoRef.current);
    }

    if (introGateRef.current !== gate || sessionRef.current !== session) return false;

    gate.introInProgress = true;
    setPreparingIntro(false);
    debugLog("INTRO_STARTED", { sessionId: gate.sessionId });
    setStatus("avatar-speaking");

    try {
      session.repeat(gate.openingText);
    } catch (err) {
      gate.introInProgress = false;
      debugLog("INTRO_REPEAT_FAILED", err);
      gate.conversationActive = true;
      try {
        await session.voiceChat.unmute();
      } catch {
        /* ignore */
      }
      setStatus("ready");
    }
    return true;
  }, []);

  useEffect(() => {
    return () => {
      clearMaxDurationTimer();
      resetIntroGate();
      sessionRef.current?.stop().catch(() => null);
      sessionRef.current = null;
    };
  }, [clearMaxDurationTimer, resetIntroGate]);

  const isActive =
    status === "ready" ||
    status === "awaiting-ready" ||
    status === "user-speaking" ||
    status === "avatar-speaking" ||
    status === "connecting" ||
    status === "creating-session";

  const isIdle =
    status === "idle" ||
    status === "stopped" ||
    status === "disconnected" ||
    status === "error";

  return {
    videoRef,
    status,
    error,
    sessionMeta,
    transcript,
    avatarChunk,
    lastAvatarText,
    micMuted,
    preparingIntro,
    questionLimitReached,
    micPermissionGranted,
    isActive,
    isIdle,
    startSession,
    stopSession,
    toggleMic,
    confirmReady,
    setError,
  };
}
