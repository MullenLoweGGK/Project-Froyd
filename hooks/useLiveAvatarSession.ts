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

/** Probe+release mic. Must run under a user gesture on iOS Safari (first grant). */
async function requestMicrophoneAccess(): Promise<void> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
    },
  });
  stream.getTracks().forEach((t) => t.stop());
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
  voiceChat: {
    isMuted: boolean;
    mute: () => Promise<void>;
    unmute: () => Promise<void>;
    on: (event: string, cb: (...args: never[]) => void) => void;
  };
  on: (event: string, cb: (...args: never[]) => void) => void;
};

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

const DEFAULT_QUESTION_LIMIT = 4;

function toHumanError(code: HumanErrorCode, technical?: string): string {
  if (process.env.NODE_ENV === "development" && technical) {
    console.error(`[LiveAvatar] ${code}:`, technical);
  }

  switch (code) {
    case "missing-config":
      return "Tento scenár ešte nie je pripravený. Skúste prosím iný avatar.";
    case "session-failed":
      return "Nepodarilo sa spustiť rozhovor. Skúste to znova o chvíľu.";
    case "credit-limit":
      return froydContent.creditLimit.message;
    case "mic-denied":
      return "Potrebujeme prístup k mikrofónu, aby ste mohli hovoriť s avatárom. Povoľte mikrofón v nastaveniach prehliadača / iPhonu (Nastavenia → Safari → Mikrofón) a skúste znova.";
    case "connection":
      return "Pripojenie sa nepodarilo. Skontrolujte internet a skúste znova.";
    case "stream":
      return "Video avatára sa nepodarilo načítať. Skúste rozhovor spustiť znova.";
    case "disconnect":
      return "Rozhovor sa neočakávane ukončil. Môžete ho spustiť znova.";
    case "unsupported":
      return "Váš prehliadač nepodporuje hlasový rozhovor. Skúste novší prehliadač.";
    default:
      return "Niečo sa pokazilo. Skúste to prosím znova.";
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
const MAX_SESSION_MS = 120_000;
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

  const [status, setStatus] = useState<AppStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [sessionMeta, setSessionMeta] = useState<SessionMetadata | null>(null);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [avatarChunk, setAvatarChunk] = useState("");
  const [lastAvatarText, setLastAvatarText] = useState("");
  const [micMuted, setMicMuted] = useState(false);
  const [preparingIntro, setPreparingIntro] = useState(false);
  const [questionLimitReached, setQuestionLimitReached] = useState(false);

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
    debugLog("MAX_DURATION_ARMED", { ms: MAX_SESSION_MS });
    maxDurationTimerRef.current = setTimeout(() => {
      maxDurationTimerRef.current = null;
      void (async () => {
        await stopSession();
        setError(
          "Dosiahli ste maximálny čas rozhovoru (120 sekúnd). Môžete spustiť nový rozhovor."
        );
      })();
    }, MAX_SESSION_MS);
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
      if (session.voiceChat.isMuted) {
        await session.voiceChat.unmute();
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
      if (!config.avatarId) {
        setError(toHumanError("missing-config"));
        setStatus("error");
        return;
      }

      if (typeof window === "undefined" || !navigator?.mediaDevices?.getUserMedia) {
        setError(toHumanError("unsupported"));
        setStatus("error");
        return;
      }

      // iOS Safari: first mic prompt must be the first await under the tap.
      // Do this before stopSession/fetch so the 30s disclaimer auto-start still works.
      try {
        await requestMicrophoneAccess();
        micPermissionGrantedRef.current = true;
        await preferMediaLoudspeaker(videoRef.current);
        await unlockBrowserAudio();
      } catch {
        micPermissionGrantedRef.current = false;
        setError(toHumanError("mic-denied"));
        setStatus("error");
        return;
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
            setError(toHumanError("credit-limit", String((body as { detail?: string }).detail ?? "")));
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
        setError(toHumanError("session-failed", String(err)));
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
          questionLimit: Math.max(1, config.questionLimit ?? DEFAULT_QUESTION_LIMIT),
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
          debugLog("READY_GATE", { sessionId: gate.sessionId });

          try {
            await sessionLike.voiceChat.mute();
          } catch (err) {
            debugLog("READY_GATE_MUTE_FAILED", err);
          }

          if (videoRef.current) {
            try {
              await videoRef.current.play();
            } catch {
              /* autoplay may wait for the confirm click */
            }
          }

          if (!isCurrentSession()) return;
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
            setError(toHumanError("disconnect"));
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
            ? "Nepodarilo sa spustiť avatara. Skontrolujte voice ID / knowledge base ID v HeyGen LiveAvatar (avatar môže byť v poriadku, ale hlas alebo kontext nie)."
            : toHumanError(code, msg);
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
  const confirmReady = useCallback(async () => {
    const gate = introGateRef.current;
    const session = sessionRef.current;
    if (!gate || !session) return;
    if (!gate.streamReady || !gate.sessionConnected) return;
    if (gate.introStarted) return;

    gate.introStarted = true;
    setPreparingIntro(true);
    debugLog("USER_READY_CONFIRMED", { sessionId: gate.sessionId });

    // Prefer permission already granted on "Spustiť" (required for iOS auto-start
    // after the 30s disclaimer — that path has no user gesture).
    try {
      await requestMicrophoneAccess();
      micPermissionGrantedRef.current = true;
    } catch {
      if (!micPermissionGrantedRef.current) {
        gate.introStarted = false;
        setPreparingIntro(false);
        setError(toHumanError("mic-denied"));
        setStatus("error");
        return;
      }
      // Already granted earlier — continue; HeyGen voiceChat will re-request if needed.
      debugLog("MIC_REPROBE_SKIPPED", { sessionId: gate.sessionId });
    }

    if (introGateRef.current !== gate || sessionRef.current !== session) return;

    await preferMediaLoudspeaker(videoRef.current);
    await unlockBrowserAudio();

    if (introGateRef.current !== gate || sessionRef.current !== session) return;

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

    if (introGateRef.current !== gate || sessionRef.current !== session) return;

    try {
      await session.voiceChat.mute();
    } catch (err) {
      debugLog("INTRO_MUTE_FAILED", err);
    }

    if (introGateRef.current !== gate || sessionRef.current !== session) return;

    debugLog("INTRO_SCHEDULED", {
      sessionId: gate.sessionId,
      bufferMs: INTRO_BUFFER_MS,
    });

    await wait(INTRO_BUFFER_MS, (id) => {
      introTimerRef.current = id;
    });

    if (introGateRef.current !== gate || sessionRef.current !== session) return;

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

    if (introGateRef.current !== gate || sessionRef.current !== session) return;

    if (gate.openingText) {
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
      return;
    }

    setPreparingIntro(false);
    gate.conversationActive = true;
    try {
      await session.voiceChat.unmute();
    } catch {
      /* ignore */
    }
    setStatus("ready");
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
    isActive,
    isIdle,
    startSession,
    stopSession,
    toggleMic,
    confirmReady,
    setError,
  };
}
