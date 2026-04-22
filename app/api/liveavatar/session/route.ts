import { NextRequest, NextResponse } from "next/server";
import { createLiveAvatarSession } from "@/lib/liveavatar";
import { CreateSessionSchema } from "@/lib/validators";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = CreateSessionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", detail: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const { avatarId, contextId, voiceId, language } = parsed.data;

  try {
    const result = await createLiveAvatarSession({ avatarId, contextId, voiceId, language });
    console.log(`[session] Created session ${result.sessionId} for avatar ${avatarId}`);
    return NextResponse.json({
      sessionToken: result.sessionToken,
      sessionId: result.sessionId,
    });
  } catch (err) {
    console.error("[session] LiveAvatar API error:", err);
    return NextResponse.json(
      { error: "Failed to create LiveAvatar session", detail: String(err) },
      { status: 502 }
    );
  }
}
