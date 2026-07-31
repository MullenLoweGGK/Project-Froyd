"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CREDITS_EXHAUSTED_STORAGE_KEY,
  isCreditLimitPayload,
} from "@/lib/liveavatar-errors";

const CREDITS_EVENT = "froyd:credits-exhausted";
const CREDITS_CLEARED_EVENT = "froyd:credits-available";
const POLL_MS = 60_000;

function readStoredCreditsExhausted(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(CREDITS_EXHAUSTED_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

/** Optimistic local mark after a credit_limit API response. */
export function markCreditsExhausted(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(CREDITS_EXHAUSTED_STORAGE_KEY, "1");
  } catch {
    /* private mode / blocked storage */
  }
  window.dispatchEvent(new Event(CREDITS_EVENT));
}

/** Clear local mark after a successful session or live balance check. */
export function clearCreditsExhausted(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(CREDITS_EXHAUSTED_STORAGE_KEY);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(CREDITS_CLEARED_EVENT));
}

export function isCreditsExhaustedFromResponse(
  status: number,
  body: unknown
): boolean {
  return status === 402 || isCreditLimitPayload(body);
}

async function fetchCreditsExhausted(): Promise<boolean | null> {
  try {
    const res = await fetch("/api/liveavatar/credits", { cache: "no-store" });
    if (!res.ok) return null;
    const body = (await res.json()) as { exhausted?: boolean };
    return Boolean(body.exhausted);
  } catch {
    return null;
  }
}

/**
 * LiveAvatar credit-limit banner state.
 * Driven by real session create failures (402 / credit_limit), not credits_left —
 * overage can keep sessions working at zero balance until the spending cap is hit.
 */
export function useCreditsExhausted() {
  const [exhausted, setExhausted] = useState(false);

  const applyServerState = useCallback(async () => {
    const fromApi = await fetchCreditsExhausted();
    if (fromApi === null) {
      setExhausted(readStoredCreditsExhausted());
      return;
    }
    if (fromApi) {
      markCreditsExhausted();
      setExhausted(true);
    } else {
      clearCreditsExhausted();
      setExhausted(false);
    }
  }, []);

  useEffect(() => {
    void applyServerState();

    const onMark = () => setExhausted(true);
    const onClear = () => setExhausted(false);
    const onFocus = () => void applyServerState();

    window.addEventListener(CREDITS_EVENT, onMark);
    window.addEventListener(CREDITS_CLEARED_EVENT, onClear);
    window.addEventListener("focus", onFocus);

    const timer = window.setInterval(() => {
      void applyServerState();
    }, POLL_MS);

    return () => {
      window.removeEventListener(CREDITS_EVENT, onMark);
      window.removeEventListener(CREDITS_CLEARED_EVENT, onClear);
      window.removeEventListener("focus", onFocus);
      window.clearInterval(timer);
    };
  }, [applyServerState]);

  const mark = useCallback(() => {
    markCreditsExhausted();
    setExhausted(true);
  }, []);

  return { creditsExhausted: exhausted, markCreditsExhausted: mark };
}
