import { NextRequest, NextResponse } from "next/server";
import { transcriptStore } from "@/lib/liveavatar";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;

  if (!sessionId) {
    return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
  }

  const stored = transcriptStore.get(sessionId);
  if (!stored) {
    return NextResponse.json(
      {
        sessionId,
        entries: [],
        raw: null,
        note: "Transcript not found. Transcripts are stored when the client calls POST /api/session/save after stopping.",
      },
      { status: 200 }
    );
  }

  return NextResponse.json({
    sessionId,
    entries: stored.entries,
    savedAt: stored.savedAt,
    raw: stored.meta,
  });
}
