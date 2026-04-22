"use client";

import type { AppStatus } from "@/lib/types";

interface ControlBarProps {
  status: AppStatus;
  onStart: () => void;
  onStop: () => void;
  onFetchTranscript: () => void;
  sessionId: string | null;
}

export function ControlBar({ status, onStart, onStop, onFetchTranscript, sessionId }: ControlBarProps) {
  const isActive = status === "ready" || status === "user-speaking" || status === "avatar-speaking" || status === "connecting";
  const isIdle = status === "idle" || status === "stopped" || status === "disconnected" || status === "error";
  const canFetch = !!sessionId && (status === "stopped" || status === "disconnected" || status === "idle");

  return (
    <div className="flex flex-wrap gap-3 items-center">
      <button
        onClick={onStart}
        disabled={!isIdle}
        className="px-5 py-2 rounded text-sm font-semibold bg-emerald-700 text-white hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        Start session
      </button>

      <button
        onClick={onStop}
        disabled={!isActive}
        className="px-5 py-2 rounded text-sm font-semibold bg-red-800 text-white hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        Stop session
      </button>

      <button
        onClick={onFetchTranscript}
        disabled={!canFetch}
        className="px-5 py-2 rounded text-sm font-semibold bg-zinc-700 text-zinc-200 hover:bg-zinc-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        Fetch transcript
      </button>
    </div>
  );
}
