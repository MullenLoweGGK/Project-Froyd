"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  LiveAvatarSession,
  SessionEvent,
  SessionState,
  AgentEventsEnum,
  SessionDisconnectReason,
} from "@heygen/liveavatar-web-sdk";

import { AvatarPanel } from "@/components/AvatarPanel";
import { ControlBar } from "@/components/ControlBar";
import { StatusBadge } from "@/components/StatusBadge";
import { TranscriptPanel } from "@/components/TranscriptPanel";
import type {
  AppStatus,
  SessionMetadata,
  TranscriptEntry,
  TranscriptResponse,
  SessionApiResponse,
} from "@/lib/types";

// These are injected at build time via env vars; safe to expose — they are IDs, not secrets.
const DEFAULT_AVATAR_ID = process.env.NEXT_PUBLIC_DEFAULT_AVATAR_ID ?? "";
const DEFAULT_CONTEXT_ID = process.env.NEXT_PUBLIC_DEFAULT_CONTEXT_ID ?? "";
const DEFAULT_VOICE_ID = process.env.NEXT_PUBLIC_DEFAULT_VOICE_ID ?? "";

export default function Home() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const sessionRef = useRef<LiveAvatarSession | null>(null);
  const startedAtRef = useRef<string>("");

  // Avatar config — editable in UI before starting a session
  const [avatarId, setAvatarId] = useState(DEFAULT_AVATAR_ID);
  const [contextId, setContextId] = useState(DEFAULT_CONTEXT_ID);
  const [voiceId, setVoiceId] = useState(DEFAULT_VOICE_ID);

  // UI state
  const [status, setStatus] = useState<AppStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [sessionMeta, setSessionMeta] = useState<SessionMetadata | null>(null);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [userChunk, setUserChunk] = useState("");
  const [avatarChunk, setAvatarChunk] = useState("");
  const [fetchedTranscript, setFetchedTranscript] = useState<TranscriptResponse | null>(null);
  const [debugLog, setDebugLog] = useState<string[]>([]);

  function log(msg: string) {
    const ts = new Date().toLocaleTimeString("sk-SK");
    setDebugLog((prev) => [`[${ts}] ${msg}`, ...prev].slice(0, 100));
  }

  function addEntry(role: "user" | "avatar" | "system", text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    setTranscript((prev) => [
      ...prev,
      { role, text: trimmed, timestamp: new Date().toISOString() },
    ]);
  }

  // Persist transcript to server after session ends
  async function saveTranscript(
    meta: SessionMetadata,
    entries: TranscriptEntry[],
    endedAt: string
  ) {
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
      log("Transcript saved to server.");
    } catch (err) {
      log(`Transcript save failed: ${String(err)}`);
    }
  }

  const stopSession = useCallback(async () => {
    const session = sessionRef.current;
    if (!session) return;

    setStatus("stopping");
    log("Stopping session…");

    try {
      await session.stop();
    } catch (err) {
      // stop() may throw if already disconnected — that's fine
      log(`Stop warning (non-fatal): ${String(err)}`);
    }

    sessionRef.current = null;
    const endedAt = new Date().toISOString();

    setSessionMeta((prev) => {
      if (prev) {
        saveTranscript(prev, transcript, endedAt);
        return { ...prev, endedAt };
      }
      return prev;
    });

    setStatus("stopped");
    log("Session stopped.");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transcript]);

  const startSession = useCallback(async () => {
    setError(null);
    setFetchedTranscript(null);
    setTranscript([]);
    setUserChunk("");
    setAvatarChunk("");
    setStatus("creating-session");
    log("Requesting session token from backend…");

    // Step 1: get sessionToken + sessionId from our backend
    let sessionToken: string;
    let sessionId: string;

    try {
      const res = await fetch("/api/liveavatar/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          avatarId: avatarId || DEFAULT_AVATAR_ID,
          contextId: contextId || undefined,
          voiceId: voiceId || undefined,
          language: "sk",
          sandbox: process.env.NEXT_PUBLIC_USE_SANDBOX === "true",
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
      log(`Session token received. Session ID: ${sessionId}`);
    } catch (err) {
      const msg = String(err);
      log(`Session creation failed: ${msg}`);
      setError(msg);
      setStatus("error");
      return;
    }

    // Step 2: init SDK session and subscribe to events
    setStatus("connecting");
    log("Initialising LiveAvatarSession…");

    const session = new LiveAvatarSession(sessionToken, {
      // voiceChat: true auto-starts the microphone inside session.start()
      voiceChat: true,
    });
    sessionRef.current = session;

    const now = new Date().toISOString();
    startedAtRef.current = now;

    setSessionMeta({
      sessionId,
      avatarId: avatarId || DEFAULT_AVATAR_ID,
      contextId: contextId || undefined,
      voiceId: voiceId || undefined,
      language: "sk",
      startedAt: now,
      sandbox: process.env.NEXT_PUBLIC_USE_SANDBOX === "true",
    });

    // Session-level events
    session.on(SessionEvent.SESSION_STATE_CHANGED, (state: SessionState) => {
      log(`State: ${state}`);
      if (state === SessionState.CONNECTED) setStatus("ready");
      if (state === SessionState.DISCONNECTING) setStatus("stopping");
      if (state === SessionState.DISCONNECTED) {
        setStatus("disconnected");
        sessionRef.current = null;
      }
    });

    session.on(SessionEvent.SESSION_STREAM_READY, () => {
      log("Stream ready — attaching to video element.");
      if (videoRef.current) {
        session.attach(videoRef.current);
      }
    });

    session.on(SessionEvent.SESSION_DISCONNECTED, (reason: SessionDisconnectReason) => {
      log(`Disconnected: ${reason}`);
      if (reason !== SessionDisconnectReason.CLIENT_INITIATED) {
        setStatus("disconnected");
      }
      sessionRef.current = null;
    });

    // Agent transcript events
    session.on(AgentEventsEnum.USER_SPEAK_STARTED, () => {
      setStatus("user-speaking");
      setUserChunk("");
    });

    session.on(AgentEventsEnum.USER_SPEAK_ENDED, () => {
      setStatus("ready");
      setUserChunk("");
    });

    session.on(AgentEventsEnum.USER_TRANSCRIPTION_CHUNK, (evt) => {
      try {
        if (evt?.text) setUserChunk(evt.text);
      } catch { /* malformed payload — silently ignore */ }
    });

    session.on(AgentEventsEnum.USER_TRANSCRIPTION, (evt) => {
      try {
        if (evt?.text) {
          addEntry("user", evt.text);
          setUserChunk("");
        }
      } catch { /* malformed payload — silently ignore */ }
    });

    session.on(AgentEventsEnum.AVATAR_SPEAK_STARTED, () => {
      setStatus("avatar-speaking");
      setAvatarChunk("");
    });

    session.on(AgentEventsEnum.AVATAR_SPEAK_ENDED, () => {
      setStatus("ready");
      setAvatarChunk("");
    });

    session.on(AgentEventsEnum.AVATAR_TRANSCRIPTION_CHUNK, (evt) => {
      try {
        if (evt?.text) setAvatarChunk(evt.text);
      } catch { /* malformed payload — silently ignore */ }
    });

    session.on(AgentEventsEnum.AVATAR_TRANSCRIPTION, (evt) => {
      try {
        if (evt?.text) {
          addEntry("avatar", evt.text);
          setAvatarChunk("");
        }
      } catch { /* malformed payload — silently ignore */ }
    });

    session.on(AgentEventsEnum.SESSION_STOPPED, (evt) => {
      log(`Session stopped by server: ${evt?.stop_reason ?? "unknown reason"}`);
      setStatus("stopped");
      sessionRef.current = null;
    });

    // Step 3: start the session (connects to LiveKit, starts voice chat)
    try {
      await session.start();
      log("Session started.");
    } catch (err) {
      const msg = String(err);
      log(`session.start() failed: ${msg}`);
      setError(msg);
      setStatus("error");
      sessionRef.current = null;
    }
  }, [avatarId, contextId, voiceId]);

  const fetchTranscript = useCallback(async () => {
    if (!sessionMeta?.sessionId) return;
    log(`Fetching transcript for ${sessionMeta.sessionId}…`);
    try {
      const res = await fetch(`/api/liveavatar/transcript/${sessionMeta.sessionId}`);
      const data = (await res.json()) as TranscriptResponse;
      setFetchedTranscript(data);
      log(`Fetched ${data.entries?.length ?? 0} transcript entries.`);
    } catch (err) {
      const msg = String(err);
      log(`Transcript fetch failed: ${msg}`);
      setError(msg);
    }
  }, [sessionMeta]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      sessionRef.current?.stop().catch(() => null);
    };
  }, []);

  const isEditable = status === "idle" || status === "stopped" || status === "disconnected" || status === "error";

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-mono">
      {/* Header */}
      <header className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-base font-bold tracking-tight">LDZ Avatars</h1>
          <p className="text-xs text-zinc-500 mt-0.5">Simulated patient · Educational simulation · SK</p>
        </div>
        <StatusBadge status={status} />
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 flex flex-col gap-8">

        {/* Controls */}
        <section>
          <ControlBar
            status={status}
            onStart={startSession}
            onStop={stopSession}
            onFetchTranscript={fetchTranscript}
            sessionId={sessionMeta?.sessionId ?? null}
          />
        </section>

        {/* Config inputs — locked while session is live */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { label: "Avatar ID", value: avatarId, onChange: setAvatarId, placeholder: "e.g. Anna_public_3_20240108" },
            { label: "Knowledge Base ID", value: contextId, onChange: setContextId, placeholder: "Context / persona ID" },
            { label: "Voice ID", value: voiceId, onChange: setVoiceId, placeholder: "Optional voice ID" },
          ].map(({ label, value, onChange, placeholder }) => (
            <label key={label} className="flex flex-col gap-1">
              <span className="text-[10px] text-zinc-500 uppercase tracking-widest">{label}</span>
              <input
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                disabled={!isEditable}
                className="bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 disabled:opacity-50"
              />
            </label>
          ))}
        </section>

        {/* Video stream */}
        <section>
          <AvatarPanel ref={videoRef} status={status} />
        </section>

        {/* Transcripts */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <TranscriptPanel
            title="User transcript"
            entries={transcript}
            role="user"
            liveChunk={userChunk || undefined}
          />
          <TranscriptPanel
            title="Avatar transcript"
            entries={transcript}
            role="avatar"
            liveChunk={avatarChunk || undefined}
          />
        </section>

        {/* Session metadata */}
        {sessionMeta && (
          <section>
            <h3 className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-2">Session metadata</h3>
            <pre className="bg-zinc-900 border border-zinc-700 rounded p-4 text-xs text-zinc-400 overflow-x-auto">
              {JSON.stringify(sessionMeta, null, 2)}
            </pre>
          </section>
        )}

        {/* Fetched transcript */}
        {fetchedTranscript && (
          <section>
            <h3 className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-2">
              Fetched transcript ({fetchedTranscript.entries?.length ?? 0} entries)
            </h3>
            <div className="space-y-1 mb-4">
              {(fetchedTranscript.entries ?? []).map((e, i) => (
                <div key={i} className="flex gap-3 text-sm">
                  <span className={`shrink-0 w-12 text-xs font-semibold ${e.role === "user" ? "text-sky-500" : "text-indigo-400"}`}>
                    {e.role}
                  </span>
                  <span className="text-zinc-300">{e.text}</span>
                </div>
              ))}
            </div>
            <details>
              <summary className="text-xs text-zinc-600 cursor-pointer hover:text-zinc-400">Raw JSON ▾</summary>
              <pre className="mt-2 bg-zinc-900 border border-zinc-700 rounded p-3 text-xs text-zinc-500 overflow-x-auto">
                {JSON.stringify(fetchedTranscript, null, 2)}
              </pre>
            </details>
          </section>
        )}

        {/* Error panel */}
        {error && (
          <section>
            <h3 className="text-[10px] font-semibold uppercase tracking-widest text-red-500 mb-2">Error</h3>
            <div className="bg-red-950 border border-red-800 rounded p-4 text-sm text-red-300 break-all">
              {error}
            </div>
          </section>
        )}

        {/* Debug log */}
        <section>
          <h3 className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-2">Debug log</h3>
          <div className="bg-zinc-900 border border-zinc-700 rounded p-3 h-48 overflow-y-auto space-y-px">
            {debugLog.length === 0
              ? <p className="text-zinc-700 text-xs italic">No events yet.</p>
              : debugLog.map((line, i) => (
                  <div key={i} className="text-xs text-zinc-500">{line}</div>
                ))
            }
          </div>
        </section>

      </main>

      <footer className="border-t border-zinc-800 px-6 py-3 text-[10px] text-zinc-700 text-center">
        Educational simulation only · Not a medical device · Not a diagnostic tool
      </footer>
    </div>
  );
}
