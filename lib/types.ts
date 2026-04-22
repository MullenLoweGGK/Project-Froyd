// SDK-aligned session states mapped to our UI vocabulary
export type AppStatus =
  | "idle"
  | "creating-session"
  | "connecting"
  | "ready"
  | "user-speaking"
  | "avatar-speaking"
  | "stopping"
  | "stopped"
  | "disconnected"
  | "error";

// What our backend returns after creating a session
export interface SessionApiResponse {
  sessionToken: string;
  sessionId: string;
  raw?: unknown;
}

// Local metadata we track client-side
export interface SessionMetadata {
  sessionId: string;
  avatarId: string;
  contextId?: string;
  voiceId?: string;
  language: string;
  startedAt: string;
  endedAt?: string;
  sandbox: boolean;
}

// A single line in the transcript
export interface TranscriptEntry {
  role: "user" | "avatar" | "system";
  text: string;
  timestamp: string;
}

// What GET /api/liveavatar/transcript/[sessionId] returns
export interface TranscriptResponse {
  sessionId: string;
  entries: TranscriptEntry[];
  savedAt?: string;
  raw?: unknown;
}

// Request body for POST /api/liveavatar/session
export interface CreateSessionRequest {
  avatarId: string;
  contextId?: string;
  voiceId?: string;
  language?: string;
  sandbox?: boolean;
}

// Request body for POST /api/session/save
export interface SaveSessionRequest {
  sessionId: string;
  avatarId: string;
  contextId?: string;
  voiceId?: string;
  language?: string;
  startedAt?: string;
  endedAt?: string;
  entries: TranscriptEntry[];
}
