import { z } from "zod";

// LiveAvatar API requires UUIDs for avatar_id, context_id, voice_id.
// We accept the full UUID string (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx).
const uuid = z.string().uuid("Must be a valid UUID (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)");

export const CreateSessionSchema = z.object({
  avatarId: uuid,
  contextId: uuid.optional(),
  voiceId: uuid.optional(),
  language: z.string().min(2).max(10).default("sk"),
  isSandbox: z.boolean().default(false),
});

export const TranscriptEntrySchema = z.object({
  role: z.enum(["user", "avatar", "system"]),
  text: z.string(),
  timestamp: z.string(),
});

export const SaveSessionSchema = z.object({
  sessionId: z.string().min(1),
  avatarId: z.string().min(1),
  contextId: z.string().optional(),
  voiceId: z.string().optional(),
  language: z.string().min(2).max(10).optional(),
  startedAt: z.string().optional(),
  endedAt: z.string().optional(),
  entries: z.array(TranscriptEntrySchema).default([]),
});

export type CreateSessionInput = z.infer<typeof CreateSessionSchema>;
export type SaveSessionInput = z.infer<typeof SaveSessionSchema>;
