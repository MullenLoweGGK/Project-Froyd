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
    <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-3">
      <button
        onClick={onStart}
        disabled={!isIdle}
        className="col-span-1 min-h-[48px] px-5 py-3 rounded text-sm font-semibold bg-emerald-700 text-white hover:bg-emerald-600 active:bg-emerald-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        Start session
      </button>

      <button
        onClick={onStop}
        disabled={!isActive}
        className="col-span-1 min-h-[48px] px-5 py-3 rounded text-sm font-semibold bg-red-800 text-white hover:bg-red-700 active:bg-red-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        Stop session
      </button>

      <button
        onClick={onFetchTranscript}
        disabled={!canFetch}
        className="col-span-2 sm:col-span-1 min-h-[48px] px-5 py-3 rounded text-sm font-semibold bg-zinc-700 text-zinc-200 hover:bg-zinc-600 active:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        Fetch transcript
      </button>
    </div>
  );
}
