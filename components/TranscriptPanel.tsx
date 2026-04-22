"use client";

import { useEffect, useRef } from "react";
import type { TranscriptEntry } from "@/lib/types";

interface TranscriptPanelProps {
  title: string;
  entries: TranscriptEntry[];
  role: "user" | "avatar";
  liveChunk?: string;
}

export function TranscriptPanel({ title, entries, role, liveChunk }: TranscriptPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const filtered = entries.filter((e) => e.role === role);

  useEffect(() => {
    const el = containerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [filtered.length, liveChunk]);

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold uppercase tracking-widest text-zinc-400">{title}</h3>
      <div ref={containerRef} className="h-40 overflow-y-auto rounded-md border border-zinc-700 bg-zinc-900 p-3 space-y-1.5">
        {filtered.length === 0 && !liveChunk ? (
          <p className="text-zinc-600 text-xs italic">No messages yet.</p>
        ) : (
          filtered.map((entry, i) => (
            <div key={i} className="flex gap-2 text-sm leading-snug">
              <span className="text-zinc-600 text-[10px] shrink-0 mt-0.5 tabular-nums">
                {new Date(entry.timestamp).toLocaleTimeString("sk-SK", {
                  hour: "2-digit", minute: "2-digit", second: "2-digit",
                })}
              </span>
              <span className="text-zinc-200">{entry.text}</span>
            </div>
          ))
        )}
        {/* Live chunk — shows partial transcription while speaking */}
        {liveChunk && (
          <div className="flex gap-2 text-sm leading-snug opacity-60 italic">
            <span className="text-zinc-600 text-[10px] shrink-0 mt-0.5">live</span>
            <span className="text-zinc-300">{liveChunk}</span>
          </div>
        )}
      </div>
    </div>
  );
}
