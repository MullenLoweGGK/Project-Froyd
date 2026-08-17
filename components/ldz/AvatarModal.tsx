"use client";

import { useEffect, useId, useRef } from "react";
import Image from "next/image";
import type { AvatarScenario } from "@/lib/avatar-scenarios";
import { useLiveAvatarSession } from "@/hooks/useLiveAvatarSession";
import { AiSimulationLabel } from "@/components/ldz/AiSimulationLabel";
import { froydContent } from "@/lib/ldz-content";
import type { AppStatus } from "@/lib/types";

const READY_COUNTDOWN_MS = 30_000;

type Props = {
  scenario: AvatarScenario;
  open: boolean;
  creditsExhausted?: boolean;
  onClose: () => void;
};

function statusLabel(status: AppStatus): string {
  switch (status) {
    case "creating-session":
    case "connecting":
      return "Pripravujeme avatara…";
    case "awaiting-ready":
      return "Predtým než začnete";
    case "ready":
      return "Teraz môžete hovoriť";
    case "user-speaking":
      return "Počúvame vás…";
    case "avatar-speaking":
      return "Avatar hovorí — počkajte, kým dohovorí";
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

export function AvatarModal({
  scenario,
  open,
  creditsExhausted = false,
  onClose,
}: Props) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const readyStartedRef = useRef(false);
  const {
    videoRef,
    status,
    error,
    micMuted,
    isIdle,
    startSession,
    stopSession,
    toggleMic,
    confirmReady,
    preparingIntro,
    questionLimitReached,
    micPermissionGranted,
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
      readyStartedRef.current = false;
      void stopSession();
    }
  }, [open, stopSession]);

  const awaitingReady = status === "awaiting-ready" && !preparingIntro;

  // After 30s, auto-start only if mic was already granted on "Spustiť".
  // On iOS, a timer has no user gesture — without prior grant getUserMedia fails
  // silently (no prompt) and only shows a red error.
  useEffect(() => {
    if (!awaitingReady) {
      readyStartedRef.current = false;
      return;
    }
    if (!micPermissionGranted) return;

    const timer = window.setTimeout(() => {
      if (readyStartedRef.current) return;
      readyStartedRef.current = true;
      void confirmReady();
    }, READY_COUNTDOWN_MS);

    return () => window.clearTimeout(timer);
  }, [awaitingReady, confirmReady, micPermissionGranted]);

  if (!open) return null;

  const canControlMic = status === "ready" || status === "user-speaking";
  // Live stream only after disclaimer — during awaiting-ready show static photo.
  const streamVisible =
    status === "ready" ||
    status === "user-speaking" ||
    status === "avatar-speaking" ||
    preparingIntro;
  const showStaticReady = awaitingReady && Boolean(scenario.image);

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
      openingText: scenario.openingText,
      questionLimit: scenario.questionLimit,
      questionLimitMessage: scenario.questionLimitMessage,
      questionLimitFollowupMessage: scenario.questionLimitFollowupMessage,
    });
  }

  async function handleStartNow() {
    if (readyStartedRef.current || preparingIntro) return;
    readyStartedRef.current = true;
    const ok = await confirmReady();
    if (!ok) readyStartedRef.current = false;
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
            <h2 id={titleId}>Rozhovor s {scenario.nameInstrumental}</h2>
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

        <div className="ldz-modal__stage">
          <div className="ldz-modal__video-wrap">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className={`ldz-modal__video${streamVisible ? " is-visible" : ""}`}
            />
            {showStaticReady ? (
              <Image
                src={scenario.image!}
                alt=""
                fill
                sizes="(max-width: 480px) 100vw, 480px"
                className="ldz-modal__static-avatar"
                priority
              />
            ) : null}
            {!streamVisible && !showStaticReady && (
              <div className="ldz-modal__placeholder">
                <p>{statusLabel(status)}</p>
                {isIdle && (
                  <p className="ldz-modal__hint">
                    Najprv si vypočujte predstavenie avatara. Hovorte až keď
                    dohovorí. Maximálny čas rozhovoru je 120 sekúnd.
                  </p>
                )}
              </div>
            )}
            {awaitingReady ? (
              <div className="ldz-modal__ready-overlay" role="status">
                <p className="ldz-modal__ready-title">Predtým než začnete</p>
                <p className="ldz-modal__ready-copy">
                  Nastavte si hlasitosť vášho zariadenia aby ste avatara zreteľne
                  počuli. Po pripojení začne avatar svoje predstavenie —
                  vypočujte si ho pozorne až do konca.
                </p>
                <p className="ldz-modal__ready-copy ldz-modal__ready-copy--emphasis">
                  Neskáčte avatarovi do reči. Ak začnete hovoriť skôr než
                  dohovorí, začne vás okamžite počúvať a hneď odpovie na vašu
                  otázku a predošlú odpoveď predčasne ukončí.
                </p>
                {!micPermissionGranted ? (
                  <p className="ldz-modal__ready-copy ldz-modal__ready-copy--emphasis">
                    Ťuknite na „Začať rozhovor hneď“ a povoľte mikrofón, keď vás
                    iPhone vyzve.
                  </p>
                ) : (
                  <div
                    className="ldz-modal__ready-progress"
                    aria-hidden="true"
                  >
                    <div
                      key={status}
                      className="ldz-modal__ready-progress-fill"
                      style={{
                        animationDuration: `${READY_COUNTDOWN_MS}ms`,
                      }}
                    />
                  </div>
                )}
              </div>
            ) : null}
            {preparingIntro ? (
              <div className="ldz-modal__ready-overlay" role="status">
                <p className="ldz-modal__ready-title">Pripravujeme zvuk…</p>
                <p className="ldz-modal__ready-copy">
                  Hneď začne predstavenie. Pripravte sa počúvať.
                </p>
              </div>
            ) : null}
          </div>
        </div>

        {status !== "idle" && !awaitingReady && !preparingIntro ? (
          <p className="ldz-modal__status" role="status" aria-live="polite">
            {questionLimitReached
              ? "Limit otázok — ďalšie na kurze Prvá pomoc pre dušu"
              : statusLabel(status)}
            {canControlMic && !questionLimitReached && !micMuted
              ? " · Mikrofón zapnutý"
              : null}
            {canControlMic && !questionLimitReached && micMuted
              ? " · Mikrofón stlmený"
              : null}
          </p>
        ) : null}

        {error ? (
          <p className="ldz-modal__error" role="alert">
            {error}
          </p>
        ) : creditsExhausted ? (
          <p className="ldz-modal__error" role="alert">
            {froydContent.creditLimit.message}
          </p>
        ) : null}

        <div className="ldz-modal__controls">
          {isIdle ? (
            <button
              type="button"
              className="ldz-btn ldz-btn--secondary"
              onClick={() => void handleStart()}
              disabled={creditsExhausted}
            >
              {creditsExhausted
                ? froydContent.creditLimit.ctaDisabledLabel
                : "Spustiť rozhovor"}
            </button>
          ) : awaitingReady ? (
            <>
              <button
                type="button"
                className="ldz-btn ldz-btn--secondary"
                onClick={() => void handleStartNow()}
                disabled={preparingIntro}
              >
                {micPermissionGranted
                  ? "Začať rozhovor hneď"
                  : "Povoliť mikrofón a začať"}
              </button>
              <button
                type="button"
                className="ldz-btn ldz-btn--danger"
                onClick={() => void handleClose()}
              >
                Ukončiť
              </button>
            </>
          ) : canControlMic ? (
            <>
              <button
                type="button"
                className="ldz-btn ldz-btn--primary"
                onClick={() => void toggleMic()}
                aria-pressed={micMuted}
              >
                {micMuted ? "Zapnúť mikrofón" : "Stlmiť mikrofón"}
              </button>
              <button
                type="button"
                className="ldz-btn ldz-btn--danger"
                onClick={() => void handleClose()}
              >
                Ukončiť rozhovor
              </button>
            </>
          ) : (
            <button
              type="button"
              className="ldz-btn ldz-btn--danger"
              onClick={() => void handleClose()}
              disabled={status === "stopping"}
            >
              Ukončiť rozhovor
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
