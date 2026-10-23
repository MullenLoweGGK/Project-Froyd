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

/** Remembers a prior successful grant for this origin (survives leave/re-enter). */
const MIC_GRANTED_STORAGE_KEY = "froyd_mic_granted";

/**
 * Probe+release mic. On iOS Safari the first grant must run under a user gesture.
 * Use plain `{ audio: true }` — detailed constraints can fail as OverconstrainedError
 * on some iPhones without showing a permission dialog.
 */
async function requestMicrophoneAccess(): Promise<void> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  stream.getTracks().forEach((t) => t.stop());
}

function micErrorDetail(err: unknown): string {
  if (!err || typeof err !== "object") return String(err);
  const e = err as { name?: string; message?: string };
  return [e.name, e.message].filter(Boolean).join(": ") || String(err);
}

function readStoredMicGranted(): boolean {
  try {
    return window.localStorage?.getItem(MIC_GRANTED_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeStoredMicGranted(granted: boolean): void {
  try {
    if (granted) {
      window.localStorage?.setItem(MIC_GRANTED_STORAGE_KEY, "1");
    }
  } catch {
    /* private mode / blocked storage */
  }
}

/** Prefer Permissions API when the browser exposes microphone state. */
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

/**
 * True when the site already has mic access — no new consent prompt needed.
 * A second getUserMedia probe after leaving a session often fails spuriously
 * on Safari even though the user already allowed the mic.
 */
async function isMicrophoneAlreadyAllowed(): Promise<boolean> {
  const perm = await readMicrophonePermissionState();
  if (perm === "granted") return true;
  if (perm === "denied") return false;
  return readStoredMicGranted();
}

function markMicrophoneAllowed(
  ref: { current: boolean },
  setGranted: (v: boolean) => void
): void {
  ref.current = true;
  setGranted(true);
  writeStoredMicGranted(true);
}

export type LiveAvatarConfig = {
  avatarId: string;
  contextId?: string;
  voiceId?: string;
  language?: string;
  /**
   * Manual opening line via session.repeat() after CONNECTED + STREAM_READY.
   * Disable / clear HeyGen Context OpeningText so the avatar does not speak twice.
   */
  openingText?: string;
  /** Hard stop after this many user turns (default 4). */
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
  stopListening: () => string;
  startListening: () => string;
  voiceChat: {
    state: string;
    isMuted: boolean;
    start: (config?: { defaultMuted?: boolean }) => Promise<void>;
    stop: () => void;
    mute: () => Promise<void>;
    unmute: () => Promise<void>;
    on: (event: string, cb: (...args: never[]) => void) => void;
  };
  on: (event: string, cb: (...args: never[]) => void) => void;
};

/**
 * Ensure LiveKit mic is ACTIVE + unmuted + agent listening.
 * Call under a user gesture (Začať / Zapnúť). Prefer unmute; only start() when
 * INACTIVE. Avoid stop() unless recreate is required — stop+start often throws
 * on Safari after leave/re-enter.
 */
async function ensureMicLive(session: SessionLike): Promise<boolean> {
  const vc = session.voiceChat;
  const listen = () => {
    try {
      session.startListening();
    } catch (err) {
      debugLog("START_LISTENING_FAILED", err);
    }
  };

  if (vc.state === "ACTIVE" && !vc.isMuted) {
    listen();
    return true;
  }

  if (vc.state === "ACTIVE") {
    try {
      await vc.unmute();
    } catch (err) {
      debugLog("ENSURE_MIC_UNMUTE_FAILED", err);
    }
    if (!vc.isMuted) {
      listen();
      return true;
    }
  }

  // INACTIVE (or still muted with a dead track): start fresh without stop when
  // possible; stop only if SDK thinks chat is already started.
  if (vc.state !== "INACTIVE") {
    try {
      vc.stop();
    } catch {
      /* ignore */
    }
  }

  try {
    await vc.start({ defaultMuted: false });
  } catch (err) {
    debugLog("ENSURE_MIC_START_FAILED", err);
    try {
      await requestMicrophoneAccess();
      if (vc.state !== "INACTIVE") {
        try {
          vc.stop();
        } catch {
          /* ignore */
        }
      }
      await vc.start({ defaultMuted: false });
    } catch (retryErr) {
      debugLog("ENSURE_MIC_START_RETRY_FAILED", retryErr);
      return false;
    }
  }

  // start() can no-op silently when the room is not connected.
  if (vc.state !== "ACTIVE") {
    debugLog("ENSURE_MIC_NOT_ACTIVE", { state: vc.state });
    return false;
  }

  if (vc.isMuted) {
    try {
      await vc.unmute();
    } catch {
      /* ignore */
    }
  }

  listen();
  return !vc.isMuted;
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
    case "session-failed":
      return en
        ? "Couldn’t start the conversation. Please try again in a moment."
        : "Nepodarilo sa spustiť rozhovor. Skúste to znova o chvíľu.";
    case "credit-limit":
      return froydContent.creditLimit.message;
    case "mic-denied":
      return en
        ? "We need microphone access so you can talk to the avatar. Allow the mic in your browser / iPhone settings (Settings → Safari → Microphone) and try again."
        : "Potrebujeme prístup k mikrofónu, aby ste mohli hovoriť s avatárom. Povoľte mikrofón v nastaveniach prehliadača / iPhonu (Nastavenia → Safari → Mikrofón) a skúste znova.";
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
  /** Talk clock starts on first mic unmute after intro — not on CONNECTED. */
  const maxDurationArmedRef = useRef(false);
  const maxSessionMsRef = useRef(DEFAULT_MAX_SESSION_MS);
  const introTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const introGateRef = useRef<IntroGate | null>(null);
  /** iOS only shows the mic prompt during a user gesture — grant on "Spustiť". */
  const micPermissionGrantedRef = useRef(false);
  /** Session UI language for human-readable errors (sk | en). */
  const languageRef = useRef("sk");

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

  // Hydrate prior site mic grant so leave → re-enter does not re-prompt.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const allowed = await isMicrophoneAlreadyAllowed();
      if (cancelled || !allowed) return;
      micPermissionGrantedRef.current = true;
      setMicPermissionGranted(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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

  /** Starts the talk clock once — first mic unmute after the intro. */
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

  /**
   * @param wantMuted — from the button label. Avoids desync where UI says
   * “Zapnúť mikrofón” but voiceChat.isMuted is already false (would mute again).
   */
  const toggleMic = useCallback(async (wantMuted?: boolean) => {
    const session = sessionRef.current;
    const lang = languageRef.current;
    if (!session) {
      setError(
        lang === "en"
          ? "Session ended. Start the conversation again."
          : "Relácia skončila. Spustite rozhovor znova."
      );
      return;
    }
    // Keep mic muted while the scripted intro is speaking / after question limit.
    if (introGateRef.current?.introInProgress) return;
    if (introGateRef.current?.forceClosing || introGateRef.current?.closingSpeakPending) {
      return;
    }
    if (introGateRef.current?.questionLimitReached) return;

    const shouldMute =
      typeof wantMuted === "boolean" ? wantMuted : !session.voiceChat.isMuted;

    setError(null);

    try {
      if (shouldMute) {
        if (session.voiceChat.state === "ACTIVE") {
          await session.voiceChat.mute();
        }
        setMicMuted(true);
        return;
      }

      const ok = await ensureMicLive(session);
      if (!ok) {
        setMicMuted(true);
        const denied = (await readMicrophonePermissionState()) === "denied";
        setError(
          denied
            ? toHumanError("mic-denied", undefined, lang)
            : lang === "en"
              ? "Couldn’t turn the microphone on. Click “Zapnúť mikrofón” again."
              : "Nepodarilo sa zapnúť mikrofón. Kliknite znova na „Zapnúť mikrofón“."
        );
        return;
      }

      markMicrophoneAllowed(micPermissionGrantedRef, setMicPermissionGranted);
      setMicMuted(false);
      armMaxDurationTimer();
      await preferMediaLoudspeaker(videoRef.current);
    } catch (err) {
      debugLog("MIC_TOGGLE_FAILED", err);
      setMicMuted(true);
      setError(
        lang === "en"
          ? "Microphone action failed. Try again."
          : "Akcia s mikrofónom zlyhala. Skúste znova."
      );
    }
  }, [armMaxDurationTimer]);

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

      // Mic consent: if already allowed (Permissions API / prior session), skip
      // getUserMedia probe — a second probe after leave/re-enter often fails on
      // Safari and falsely blocks the ready CTA. Only prompt when unknown.
      const alreadyAllowed =
        micPermissionGrantedRef.current || (await isMicrophoneAlreadyAllowed());
      if (alreadyAllowed) {
        markMicrophoneAllowed(micPermissionGrantedRef, setMicPermissionGranted);
      } else {
        try {
          await requestMicrophoneAccess();
          markMicrophoneAllowed(micPermissionGrantedRef, setMicPermissionGranted);
        } catch (err) {
          // Do not clear a previously known grant on a spurious probe failure.
          console.error("[LiveAvatar] mic permission on start:", micErrorDetail(err));
          const stillAllowed = await isMicrophoneAlreadyAllowed();
          if (stillAllowed) {
            markMicrophoneAllowed(micPermissionGrantedRef, setMicPermissionGranted);
          } else {
            micPermissionGrantedRef.current = false;
            setMicPermissionGranted(false);
          }
        }
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
          throw new Error(
            (body as { error?: string }).error ?? `Backend returned HTTP ${res.status}`
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

        const session = new LiveAvatarSession(sessionToken, {
          voiceChat: true,
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
            hasOpening: Boolean(gate.openingText),
          });

          // With scripted intro (main): mute until after repeat() finishes.
          // With empty intro (courses): keep the LiveKit mic track — mute here
          // would stopOnMute and leave no working unmute path after Začať.
          if (gate.openingText) {
            try {
              await sessionLike.voiceChat.mute();
            } catch (err) {
              debugLog("READY_GATE_MUTE_FAILED", err);
            }
          }

          if (videoRef.current) {
            try {
              await videoRef.current.play();
            } catch {
              /* autoplay may wait for the confirm click */
            }
          }

          if (!isCurrentSession()) return;
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
          try {
            await sessionLike.voiceChat.unmute();
          } catch (err) {
            debugLog("CONVERSATION_UNMUTE_FAILED", err);
          }
          try {
            sessionLike.startListening();
          } catch (err) {
            debugLog("START_LISTENING_FAILED", err);
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

          if (gate.userTurnCount === gate.questionLimit && gate.questionLimitMessage) {
            void speakForcedLimitLine(gate.questionLimitMessage);
            return;
          }

          if (gate.userTurnCount > gate.questionLimit) {
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
      } catch (err) {
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
   * After disclaimer countdown / "start now": unlock audio, prime media,
   * then speak openingText (no warm-up utterance).
   */
  const confirmReady = useCallback(async (): Promise<boolean> => {
    const gate = introGateRef.current;
    const session = sessionRef.current;
    if (!gate || !session) return false;
    if (!gate.streamReady || !gate.sessionConnected) return false;
    // Allow retry after a failed confirm (do not stick the latch).
    if (gate.introStarted) {
      gate.introStarted = false;
    }

    gate.introStarted = true;
    setPreparingIntro(true);
    setError(null);
    debugLog("USER_READY_CONFIRMED", { sessionId: gate.sessionId });

    // Empty intro: keep getUserMedia / unmute as the first awaits under this click.
    // When already granted, skip permission probes so Safari keeps the user gesture.
    if (!gate.openingText) {
      if (!micPermissionGrantedRef.current) {
        const allowed = await isMicrophoneAlreadyAllowed();
        if (allowed) {
          markMicrophoneAllowed(micPermissionGrantedRef, setMicPermissionGranted);
        } else {
          try {
            await requestMicrophoneAccess();
            markMicrophoneAllowed(micPermissionGrantedRef, setMicPermissionGranted);
          } catch (err) {
            console.error("[LiveAvatar] mic permission on confirm:", micErrorDetail(err));
            gate.introStarted = false;
            setPreparingIntro(false);
            setError(toHumanError("mic-denied", micErrorDetail(err), languageRef.current));
            setStatus("awaiting-ready");
            return false;
          }
        }
      }

      gate.conversationActive = true;
      const micOk = await ensureMicLive(session);
      if (!micOk) {
        gate.introStarted = false;
        setPreparingIntro(false);
        setMicMuted(true);
        setError(
          languageRef.current === "en"
            ? "Couldn’t turn the microphone on. Click “Začať rozhovor hneď” again."
            : "Nepodarilo sa zapnúť mikrofón. Kliknite znova na „Začať rozhovor hneď“."
        );
        setStatus("awaiting-ready");
        return false;
      }

      await preferMediaLoudspeaker(videoRef.current);
      await unlockBrowserAudio();
      if (videoRef.current) {
        await primeAvatarMedia(videoRef.current, () => {
          try {
            session.attach(videoRef.current as HTMLVideoElement);
          } catch {
            /* ignore */
          }
        });
        videoRef.current.muted = false;
        videoRef.current.defaultMuted = false;
        videoRef.current.volume = 1;
        try {
          await videoRef.current.play();
        } catch {
          /* ignore */
        }
      }

      setPreparingIntro(false);
      setMicMuted(false);
      setStatus("ready");
      return true;
    }

    // Scripted intro (main campaign path)
    if (!micPermissionGrantedRef.current) {
      const allowed = await isMicrophoneAlreadyAllowed();
      if (allowed) {
        markMicrophoneAllowed(micPermissionGrantedRef, setMicPermissionGranted);
      } else {
        try {
          await requestMicrophoneAccess();
          markMicrophoneAllowed(micPermissionGrantedRef, setMicPermissionGranted);
        } catch (err) {
          console.error("[LiveAvatar] mic permission on confirm:", micErrorDetail(err));
          gate.introStarted = false;
          setPreparingIntro(false);
          setError(toHumanError("mic-denied", micErrorDetail(err), languageRef.current));
          setStatus("awaiting-ready");
          return false;
        }
      }
    }

    await preferMediaLoudspeaker(videoRef.current);
    await unlockBrowserAudio();

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
      videoRef.current.muted = false;
      videoRef.current.defaultMuted = false;
      videoRef.current.volume = 1;
      try {
        session.attach(videoRef.current);
      } catch {
        /* ignore */
      }
      try {
        await videoRef.current.play();
      } catch {
        /* ignore */
      }
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
      try {
        session.startListening();
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
