import { NextResponse } from "next/server";
import { isLiveAvatarCreditsExhausted } from "@/lib/liveavatar-credits-state";

/**
 * Public availability for the microsite banner.
 * Exhausted only after a real session create credit_limit / 402 — not from balance.
 */
export async function GET() {
  return NextResponse.json(
    { exhausted: isLiveAvatarCreditsExhausted() },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
