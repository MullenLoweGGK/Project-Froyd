"use client";

import { useEffect, useId, useRef } from "react";
import type { AvatarScenario } from "@/lib/avatar-scenarios";
import { useLiveAvatarSession } from "@/hooks/useLiveAvatarSession";
import { AiSimulationLabel } from "@/components/ldz/AiSimulationLabel";
import type { AppStatus } from "@/lib/types";

type Props = {
  scenario: AvatarScenario;
  open: boolean;
  onClose: () => void;
};

function statusLabel(status: AppStatus): string {
  switch (status) {
    case "creating-session":
      return "Pripravujeme rozhovor…";
    case "connecting":
      return "Pripájame avatara…";
    case "ready":
      return "Môžete hovoriť";
    case "user-speaking":
      return "Počúvame vás…";
    case "avatar-speaking":
      return "Avatar hovorí…";
    case "stopping":
      return "Ukončujeme rozhovor…";
    case "stopped":
      return "Rozhovor ukončený";
    case "disconnected":
      return "Odpojené";
    case "error":
      return "Nepodarilo sa spojiť";
    default:
      return "Pripravené na spustenie";
  }
}

export function AvatarModal({ scenario, open, onClose }: Props) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const {
    videoRef,
    status,
    error,
    avatarChunk,
    lastAvatarText,
    micMuted,
    isActive,
    isIdle,
    startSession,
    stopSession,
    toggleMic,
  } = useLiveAvatarSession();

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        void (async () => {
          await stopSession();
          onClose();
        })();
      }
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose, stopSession]);

  // Stop session when modal closes
  useEffect(() => {
    if (!open) {
      void stopSession();
    }
  }, [open, stopSession]);

  if (!open) return null;

  const subtitle = avatarChunk || lastAvatarText;
  const streamVisible =
    status === "ready" ||
    status === "user-speaking" ||
    status === "avatar-speaking";

  async function handleClose() {
    await stopSession();
    onClose();
  }

  async function handleStart() {
    await startSession({
      avatarId: scenario.avatarId,
      contextId: scenario.contextId || undefined,
      voiceId: scenario.voiceId,
      language: "sk",
    });
  }

  return (
    <div
      className="ldz-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <button
        type="button"
        className="ldz-modal__backdrop"
        aria-label="Zavrieť"
        onClick={() => void handleClose()}
      />
      <div className="ldz-modal__panel">
        <div className="ldz-modal__header">
          <div>
            <h2 id={titleId}>Rozhovor s {scenario.name}</h2>
            <AiSimulationLabel compact />
          </div>
          <button
            ref={closeRef}
            type="button"
            className="ldz-modal__close"
            onClick={() => void handleClose()}
            aria-label="Zavrieť rozhovor"
          >
            Zavrieť
          </button>
        </div>

        <p className="ldz-modal__note">
          Interagujete s AI avatárom vo vzdelávacej simulácii. Scenár nie je
          diagnostickým ani medicínskym nástrojom.
        </p>

        <div className="ldz-modal__stage">
          <div className="ldz-modal__video-wrap">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className={`ldz-modal__video${streamVisible ? " is-visible" : ""}`}
            />
            {!streamVisible && (
              <div className="ldz-modal__placeholder">
                <p>{statusLabel(status)}</p>
                {isIdle && (
                  <p className="ldz-modal__hint">
                    Po spustení povoľte mikrofón a položte tri otázky.
                  </p>
                )}
              </div>
            )}
            {subtitle && streamVisible ? (
              <p className="ldz-modal__subtitle">{subtitle}</p>
            ) : null}
          </div>
        </div>

        <p className="ldz-modal__status" role="status" aria-live="polite">
          {statusLabel(status)}
          {isActive && !micMuted ? " · Mikrofón zapnutý" : null}
          {isActive && micMuted ? " · Mikrofón stlmený" : null}
        </p>

        {error ? (
          <p className="ldz-modal__error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="ldz-modal__controls">
          {isIdle ? (
            <button
              type="button"
              className="ldz-btn ldz-btn--secondary"
              onClick={() => void handleStart()}
            >
              Spustiť rozhovor
            </button>
          ) : (
            <>
              <button
                type="button"
                className="ldz-btn ldz-btn--primary"
                onClick={() => void toggleMic()}
                disabled={
                  !isActive ||
                  status === "creating-session" ||
                  status === "connecting"
                }
                aria-pressed={micMuted}
              >
                {micMuted ? "Zapnúť mikrofón" : "Stlmiť mikrofón"}
              </button>
              <button
                type="button"
                className="ldz-btn ldz-btn--danger"
                onClick={() => void handleClose()}
                disabled={status === "stopping"}
              >
                Ukončiť rozhovor
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
