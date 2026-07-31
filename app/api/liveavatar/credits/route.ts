import { NextResponse } from "next/server";
import { getLiveAvatarCredits } from "@/lib/liveavatar";
import { LiveAvatarApiError } from "@/lib/liveavatar-errors";

/**
 * Public availability probe for the microsite banner.
 * Does not expose the raw credit balance — only whether sessions can start.
 */
export async function GET() {
  try {
    const credits = await getLiveAvatarCredits();
    return NextResponse.json(
      { exhausted: credits.exhausted },
      {
        headers: {
          // Short cache so refill clears the banner without hammering HeyGen.
          "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
        },
      }
    );
  } catch (err) {
    console.error("[credits] LiveAvatar credits check failed:", err);

    if (err instanceof LiveAvatarApiError && err.code === "credit_limit") {
      return NextResponse.json({ exhausted: true });
    }

    // Fail open: don't block the whole site if the balance endpoint is down.
    return NextResponse.json(
      { exhausted: false, unavailable: true },
      { status: 200 }
    );
  }
}
