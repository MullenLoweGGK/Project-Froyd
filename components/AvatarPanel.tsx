"use client";

import { forwardRef } from "react";
import type { AppStatus } from "@/lib/types";

interface AvatarPanelProps {
  status: AppStatus;
}

const AvatarPanel = forwardRef<HTMLVideoElement, AvatarPanelProps>(({ status }, ref) => {
  const isActive = status === "ready" || status === "user-speaking" || status === "avatar-speaking";

  return (
    <div className="relative w-full aspect-video bg-zinc-900 rounded-lg overflow-hidden border border-zinc-700">
      {/* The SDK's session.attach() writes directly to this element */}
      <video
        ref={ref}
        autoPlay
        playsInline
        className={`w-full h-full object-cover transition-opacity duration-500 ${isActive ? "opacity-100" : "opacity-0"}`}
      />

      {!isActive && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 select-none">
          <svg className="w-14 h-14 text-zinc-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
          </svg>
          <span className="text-zinc-600 text-sm">Avatar stream will appear here</span>
        </div>
      )}
    </div>
  );
});

AvatarPanel.displayName = "AvatarPanel";
export { AvatarPanel };
