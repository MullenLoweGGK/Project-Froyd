import { NextRequest, NextResponse } from "next/server";
import { transcriptStore } from "@/lib/liveavatar";
import { SaveSessionSchema } from "@/lib/validators";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = SaveSessionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", detail: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const { sessionId, entries, ...meta } = parsed.data;

  transcriptStore.set(sessionId, {
    entries,
    savedAt: new Date().toISOString(),
    meta: meta as Record<string, unknown>,
  });

  console.log(`[session/save] Saved ${entries.length} transcript entries for session ${sessionId}`);

  return NextResponse.json({ ok: true, sessionId, entryCount: entries.length });
}
