"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  AppStatus,
  SessionApiResponse,
  SessionMetadata,
  TranscriptEntry,
} from "@/lib/types";

export type LiveAvatarConfig = {
  avatarId: string;
  contextId?: string;
  voiceId?: string;
  language?: string;
};

export type HumanErrorCode =
  | "missing-config"
  | "session-failed"
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
  voiceChat: {
    isMuted: boolean;
    mute: () => Promise<void>;
    unmute: () => Promise<void>;
    on: (event: string, cb: (...args: never[]) => void) => void;
  };
  on: (event: string, cb: (...args: never[]) => void) => void;
};

function toHumanError(code: HumanErrorCode, technical?: string): string {
  if (process.env.NODE_ENV === "development" && technical) {
    console.error(`[LiveAvatar] ${code}:`, technical);
  }

  switch (code) {
    case "missing-config":
      return "Tento scenár ešte nie je pripravený. Skúste prosím iný avatar.";
    case "session-failed":
      return "Nepodarilo sa spustiť rozhovor. Skúste to znova o chvíľu.";
    case "mic-denied":
      return "Potrebujeme prístup k mikrofónu, aby ste mohli hovoriť s avatárom. Povoľte mikrofón v prehliadači a skúste znova.";
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

/**
 * Shared LiveAvatar session controller.
 * Only one session should exist at a time — callers must stop before starting another.
 * The HeyGen SDK is dynamically imported only when the user starts a session.
 */
export function useLiveAvatarSession() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const sessionRef = useRef<SessionLike | null>(null);
  const transcriptRef = useRef<TranscriptEntry[]>([]);

  const [status, setStatus] = useState<AppStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [sessionMeta, setSessionMeta] = useState<SessionMetadata | null>(null);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [avatarChunk, setAvatarChunk] = useState("");
  const [lastAvatarText, setLastAvatarText] = useState("");
  const [micMuted, setMicMuted] = useState(false);

  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

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
  }, [saveTranscript]);

  const toggleMic = useCallback(async () => {
    const session = sessionRef.current;
    if (!session) return;
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

      if (sessionRef.current) {
        await stopSession();
      }

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
          throw new Error(
            (body as { error?: string }).error ?? `Backend returned HTTP ${res.status}`
          );
        }

        const data = (await res.json()) as SessionApiResponse;
        sessionToken = data.sessionToken;
        sessionId = data.sessionId;
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
        sessionRef.current = session as unknown as SessionLike;

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

        session.voiceChat.on(VoiceChatEvent.MUTED, () => setMicMuted(true));
        session.voiceChat.on(VoiceChatEvent.UNMUTED, () => setMicMuted(false));

        session.on(SessionEvent.SESSION_STATE_CHANGED, (state) => {
          if (state === SessionState.CONNECTED) setStatus("ready");
          if (state === SessionState.DISCONNECTING) setStatus("stopping");
          if (state === SessionState.DISCONNECTED) {
            setStatus("disconnected");
            sessionRef.current = null;
          }
        });

        session.on(SessionEvent.SESSION_STREAM_READY, () => {
          if (videoRef.current) {
            session.attach(videoRef.current);
          }
        });

        session.on(SessionEvent.SESSION_DISCONNECTED, (reason) => {
          if (reason !== SessionDisconnectReason.CLIENT_INITIATED) {
            setStatus("disconnected");
            setError(toHumanError("disconnect"));
          }
          sessionRef.current = null;
        });

        session.on(AgentEventsEnum.USER_SPEAK_STARTED, () => setStatus("user-speaking"));
        session.on(AgentEventsEnum.USER_SPEAK_ENDED, () => setStatus("ready"));
        session.on(AgentEventsEnum.AVATAR_SPEAK_STARTED, () => {
          setStatus("avatar-speaking");
          setAvatarChunk("");
        });
        session.on(AgentEventsEnum.AVATAR_SPEAK_ENDED, () => {
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
            if (evt?.text) setAvatarChunk(evt.text);
          } catch {
            /* ignore */
          }
        });

        session.on(AgentEventsEnum.AVATAR_TRANSCRIPTION, (evt) => {
          try {
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
          setStatus("stopped");
          sessionRef.current = null;
        });

        await session.start();
      } catch (err) {
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
        setError(human);
        if (process.env.NODE_ENV === "development") {
          console.error("[LiveAvatar] session.start failed:", err);
        }
        setStatus("error");
        sessionRef.current = null;
      }
    },
    [addEntry, stopSession]
  );

  useEffect(() => {
    return () => {
      sessionRef.current?.stop().catch(() => null);
      sessionRef.current = null;
    };
  }, []);

  const isActive =
    status === "ready" ||
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
    isActive,
    isIdle,
    startSession,
    stopSession,
    toggleMic,
    setError,
  };
}
