import type { TranscriptEntry } from "./types";

// LiveAvatar REST API base (not api.heygen.com — this is the new platform)
const LIVEAVATAR_API = "https://api.liveavatar.com";

function getApiKey(): string {
  const key = process.env.LIVEAVATAR_API_KEY;
  if (!key) throw new Error("LIVEAVATAR_API_KEY is not configured in environment");
  return key;
}

export interface CreateSessionPayload {
  avatarId: string;       // UUID of the avatar
  contextId?: string;     // UUID of the knowledge-base / context (goes inside avatar_persona)
  voiceId?: string;       // UUID of the voice (goes inside avatar_persona)
  language?: string;      // BCP-47 language code, default "sk"
  isSandbox?: boolean;
}

export interface LiveAvatarSessionApiResponse {
  sessionToken: string;
  sessionId: string;
  raw: unknown;
}

/**
 * Creates a new LiveAvatar session token using FULL mode.
 *
 * Endpoint: POST https://api.liveavatar.com/v1/sessions/token
 * Auth: X-API-KEY header (server-side only — never expose to client)
 *
 * FULL mode: HeyGen handles the LLM, TTS, and STT entirely.
 * Returns sessionToken (passed to LiveAvatarSession on client) + sessionId.
 *
 * API schema reference: https://docs.liveavatar.com/api-reference/sessions/create-session-token
 */
export async function createLiveAvatarSession(
  payload: CreateSessionPayload
): Promise<LiveAvatarSessionApiResponse> {
  // Build avatar_persona — required in FULL mode
  const avatarPersona: Record<string, unknown> = {
    language: payload.language ?? "sk",
  };
  if (payload.voiceId) avatarPersona.voice_id = payload.voiceId;
  if (payload.contextId) avatarPersona.context_id = payload.contextId;

  const body: Record<string, unknown> = {
    mode: "FULL",
    avatar_id: payload.avatarId,
    avatar_persona: avatarPersona,
    interactivity_type: "CONVERSATIONAL",
    is_sandbox: payload.isSandbox ?? false,
  };

  let raw: unknown;
  let res: Response;

  try {
    res = await fetch(`${LIVEAVATAR_API}/v1/sessions/token`, {
      method: "POST",
      headers: {
        "X-API-KEY": getApiKey(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    raw = await res.json().catch(() => ({ error: "Non-JSON response" }));
  } catch (networkErr) {
    throw new Error(`Network error calling LiveAvatar API: ${String(networkErr)}`);
  }

  if (!res.ok) {
    // Surface the API's own error message when possible
    const apiMsg =
      (raw as { message?: string })?.message ??
      (raw as { detail?: string | { msg: string }[] })?.detail;
    const detail =
      typeof apiMsg === "string"
        ? apiMsg
        : Array.isArray(apiMsg)
          ? apiMsg.map((d) => `${d.msg}`).join("; ")
          : JSON.stringify(raw);
    throw new Error(`LiveAvatar API ${res.status}: ${detail}`);
  }

  // Response shape: { code: number, data: { session_id, session_token } }
  const data = (raw as { data?: { session_token?: string; session_id?: string } })?.data;
  const sessionToken = data?.session_token;
  const sessionId = data?.session_id;

  if (!sessionToken) throw new Error("LiveAvatar API response missing data.session_token");
  if (!sessionId) throw new Error("LiveAvatar API response missing data.session_id");

  return { sessionToken, sessionId, raw };
}

// ---------------------------------------------------------------------------
// In-memory transcript store.
// Lives in server process memory — fine for demo/MVP.
// Replace with a DB or file for production persistence.
// ---------------------------------------------------------------------------

interface StoredTranscript {
  entries: TranscriptEntry[];
  savedAt: string;
  meta: Record<string, unknown>;
}

export const transcriptStore = new Map<string, StoredTranscript>();
