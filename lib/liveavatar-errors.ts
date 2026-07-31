/**
 * LiveAvatar / HeyGen API error helpers — credit & quota detection.
 */

export type LiveAvatarErrorCode =
  | "credit_limit"
  | "rate_limit"
  | "unauthorized"
  | "validation"
  | "upstream";

export class LiveAvatarApiError extends Error {
  readonly status: number;
  readonly code: LiveAvatarErrorCode;
  readonly detail: string;

  constructor(status: number, code: LiveAvatarErrorCode, detail: string) {
    super(`LiveAvatar API ${status}: ${detail}`);
    this.name = "LiveAvatarApiError";
    this.status = status;
    this.code = code;
    this.detail = detail;
  }
}

function extractApiCode(raw: unknown): string {
  if (!raw || typeof raw !== "object") return "";
  const obj = raw as Record<string, unknown>;
  const nested = obj.error;
  if (nested && typeof nested === "object") {
    const code = (nested as { code?: unknown }).code;
    if (typeof code === "string") return code;
  }
  if (typeof obj.code === "string" && Number.isNaN(Number(obj.code))) {
    return obj.code;
  }
  return "";
}

function extractApiMessage(raw: unknown): string {
  if (!raw || typeof raw !== "object") return "";
  const obj = raw as Record<string, unknown>;
  const nested = obj.error;
  if (nested && typeof nested === "object") {
    const message = (nested as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  if (typeof obj.message === "string") return obj.message;
  if (typeof obj.detail === "string") return obj.detail;
  if (Array.isArray(obj.detail)) {
    return obj.detail
      .map((d) =>
        d && typeof d === "object" && "msg" in d
          ? String((d as { msg: unknown }).msg)
          : String(d)
      )
      .join("; ");
  }
  return JSON.stringify(raw);
}

const CREDIT_API_CODES = new Set([
  "insufficient_credit",
  "quota_exceeded",
  "trial_limit_exceeded",
  "plan_upgrade_required",
  "resource_limit_reached",
]);

const CREDIT_MESSAGE_RE =
  /insufficient[_\s-]?credit|out of credit|no credits?|credit limit|credits?\s+(exhausted|depleted)|quota[_\s-]?(exceed|limit)|payment required|billing|plan upgrade|allow overage/i;

export function classifyLiveAvatarHttpError(
  status: number,
  raw: unknown
): LiveAvatarApiError {
  const detail = extractApiMessage(raw) || `HTTP ${status}`;
  const apiCode = extractApiCode(raw).toLowerCase();

  if (
    status === 402 ||
    CREDIT_API_CODES.has(apiCode) ||
    CREDIT_MESSAGE_RE.test(detail)
  ) {
    return new LiveAvatarApiError(status, "credit_limit", detail);
  }

  if (status === 429 || apiCode === "rate_limit_exceeded") {
    return new LiveAvatarApiError(status, "rate_limit", detail);
  }

  if (status === 401 || apiCode === "unauthorized") {
    return new LiveAvatarApiError(status, "unauthorized", detail);
  }

  if (status === 400 || status === 422) {
    return new LiveAvatarApiError(status, "validation", detail);
  }

  return new LiveAvatarApiError(status, "upstream", detail);
}

/** Client-side: detect credit exhaustion from API JSON or thrown text. */
export function isCreditLimitPayload(body: unknown, fallbackText = ""): boolean {
  if (body && typeof body === "object") {
    const code = (body as { code?: unknown }).code;
    if (code === "credit_limit") return true;
    const detail = String(
      (body as { detail?: unknown }).detail ??
        (body as { error?: unknown }).error ??
        ""
    );
    if (CREDIT_MESSAGE_RE.test(detail)) return true;
  }
  return CREDIT_MESSAGE_RE.test(fallbackText);
}

export const CREDITS_EXHAUSTED_STORAGE_KEY = "froyd.heygen.credits_exhausted";
