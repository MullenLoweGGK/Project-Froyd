"use client";

import type { AppStatus } from "@/lib/types";

const STATUS_CONFIG: Record<AppStatus, { label: string; cls: string }> = {
  idle:              { label: "Idle",               cls: "bg-zinc-700 text-zinc-300" },
  "creating-session":{ label: "Creating session…",  cls: "bg-yellow-800 text-yellow-200" },
  connecting:        { label: "Connecting…",         cls: "bg-blue-800 text-blue-200" },
  ready:             { label: "Ready",               cls: "bg-emerald-800 text-emerald-200" },
  "user-speaking":   { label: "User speaking",       cls: "bg-sky-700 text-sky-100" },
  "avatar-speaking": { label: "Avatar speaking",     cls: "bg-indigo-700 text-indigo-200" },
  stopping:          { label: "Stopping…",           cls: "bg-orange-800 text-orange-200" },
  stopped:           { label: "Stopped",             cls: "bg-zinc-700 text-zinc-300" },
  disconnected:      { label: "Disconnected",        cls: "bg-red-900 text-red-200" },
  error:             { label: "Error",               cls: "bg-red-700 text-red-100" },
};

export function StatusBadge({ status }: { status: AppStatus }) {
  const { label, cls } = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold tracking-wide ${cls}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70 animate-pulse" />
      {label}
    </span>
  );
}
