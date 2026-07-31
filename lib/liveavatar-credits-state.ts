/**
 * Shared “can we start sessions?” state for the public announcement.
 *
 * Do NOT infer this from credits_left: with Allow Overage enabled, balance can
 * be 0 while sessions still succeed. Only a real credit_limit / 402 response
 * (e.g. overage cap reached) means exhausted; a successful session clears it.
 *
 * Note: module memory is per serverless instance — good enough for the banner;
 * clients also clear/set via sessionStorage after start attempts.
 */

const g = globalThis as typeof globalThis & {
  __froydCreditsExhausted?: boolean;
};

export function setLiveAvatarCreditsExhausted(exhausted: boolean): void {
  g.__froydCreditsExhausted = exhausted;
}

export function isLiveAvatarCreditsExhausted(): boolean {
  return g.__froydCreditsExhausted === true;
}
