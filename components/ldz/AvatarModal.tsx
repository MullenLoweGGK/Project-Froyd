"use client";

import { useEffect, useId, useRef } from "react";
import Image from "next/image";
import type {
  AvatarScenario,
  ConversationLanguage,
} from "@/lib/avatar-scenarios";
import { resolveScenarioSession } from "@/lib/avatar-scenarios";
import { getAvatarModalCopy } from "@/lib/avatar-modal-copy";
import { useLiveAvatarSession } from "@/hooks/useLiveAvatarSession";
import { AiSimulationLabel } from "@/components/ldz/AiSimulationLabel";
import { froydContent } from "@/lib/ldz-content";

const READY_COUNTDOWN_MS = 30_000;

type Props = {
  scenario: AvatarScenario;
  language?: ConversationLanguage;
  open: boolean;
  creditsExhausted?: boolean;
  onClose: () => void;
};

export function AvatarModal({
  scenario,
  language = "sk",
  open,
  creditsExhausted = false,
  onClose,
}: Props) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const readyStartedRef = useRef(false);
  const session = resolveScenarioSession(scenario, language);
  const copy = getAvatarModalCopy(session.language);
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
  const isCoursesFlow = !session.openingText;

  // Campaign only: auto-start after strip when mic was granted on "Spustiť".
  // Courses: never auto-start — mic+unmute must stay on the button click.
  useEffect(() => {
    if (!awaitingReady) {
      readyStartedRef.current = false;
      return;
    }
    if (isCoursesFlow) return;
    if (!micPermissionGranted) return;

    const timer = window.setTimeout(() => {
      if (readyStartedRef.current) return;
      readyStartedRef.current = true;
      void confirmReady();
    }, READY_COUNTDOWN_MS);

    return () => window.clearTimeout(timer);
  }, [awaitingReady, confirmReady, micPermissionGranted, isCoursesFlow]);

  if (!open) return null;

  const canControlMic = status === "ready" || status === "user-speaking";
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
      avatarId: session.avatarId,
      contextId: session.contextId,
      voiceId: session.voiceId,
      language: session.language,
      openingText: session.openingText,
      questionLimit: session.questionLimit,
      questionLimitMessage: session.questionLimitMessage,
      questionLimitFollowupMessage: session.questionLimitFollowupMessage,
      maxSessionMs: session.maxSessionMs,
    });
  }

  async function handleStartNow() {
    if (preparingIntro) return;
    // Always allow another attempt after a failed confirm — don't stick the latch.
    readyStartedRef.current = true;
    try {
      const ok = await confirmReady();
      if (!ok) readyStartedRef.current = false;
    } catch {
      readyStartedRef.current = false;
    }
  }

  const readyPrimaryLabel = micPermissionGranted
    ? copy.startNow
    : copy.allowMicAndStart;

  return (
    <div
      className="ldz-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      lang={session.language}
    >
      <button
        type="button"
        className="ldz-modal__backdrop"
        aria-label={copy.close}
        onClick={() => void handleClose()}
      />
      <div
        className={`ldz-modal__panel${awaitingReady || preparingIntro ? " ldz-modal__panel--ready" : ""}`}
      >
        <div className="ldz-modal__header">
          <div>
            <h2 id={titleId}>
              {copy.title(scenario.nameInstrumental, scenario.name)}
            </h2>
            <AiSimulationLabel compact />
          </div>
          <button
            ref={closeRef}
            type="button"
            className="ldz-modal__close"
            onClick={() => void handleClose()}
            aria-label={copy.closeAria}
          >
            {copy.close}
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
                <p>{copy.status(status)}</p>
                {isIdle && (
                  <p className="ldz-modal__hint">{copy.idleHint}</p>
                )}
              </div>
            )}
            {awaitingReady ? (
              <div className="ldz-modal__ready-overlay">
                <p className="ldz-modal__ready-title">{copy.readyTitle}</p>
                <p className="ldz-modal__ready-copy">{copy.readyCopy}</p>
                <p className="ldz-modal__ready-copy ldz-modal__ready-copy--emphasis">
                  {copy.readyEmphasis}
                </p>
                <p className="ldz-modal__ready-copy ldz-modal__ready-copy--emphasis">
                  {copy.readyMicHint}
                </p>
                {!isCoursesFlow && micPermissionGranted ? (
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
                ) : null}
                <div className="ldz-modal__ready-actions">
                  <button
                    type="button"
                    className="ldz-btn ldz-btn--secondary"
                    onClick={() => void handleStartNow()}
                    disabled={preparingIntro}
                  >
                    {readyPrimaryLabel}
                  </button>
                  <button
                    type="button"
                    className="ldz-btn ldz-btn--danger"
                    onClick={() => void handleClose()}
                  >
                    {copy.end}
                  </button>
                </div>
              </div>
            ) : null}
            {preparingIntro ? (
              <div className="ldz-modal__ready-overlay" role="status">
                <p className="ldz-modal__ready-title">{copy.preparingTitle}</p>
                <p className="ldz-modal__ready-copy">{copy.preparingCopy}</p>
              </div>
            ) : null}
          </div>
        </div>

        {status !== "idle" && !awaitingReady && !preparingIntro ? (
          <p className="ldz-modal__status" role="status" aria-live="polite">
            {questionLimitReached
              ? copy.questionLimitStatus
              : copy.status(status)}
            {canControlMic && !questionLimitReached && !micMuted
              ? copy.micOn
              : null}
            {canControlMic && !questionLimitReached && micMuted
              ? copy.micOff
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

        {/* Footer controls — hidden during ready gate (CTA lives in the overlay). */}
        {!awaitingReady && !preparingIntro ? (
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
                  : copy.start}
              </button>
            ) : canControlMic ? (
              <>
                <button
                  type="button"
                  className="ldz-btn ldz-btn--primary"
                  onClick={() => void toggleMic()}
                  aria-pressed={micMuted}
                >
                  {micMuted ? copy.unmute : copy.mute}
                </button>
                <button
                  type="button"
                  className="ldz-btn ldz-btn--danger"
                  onClick={() => void handleClose()}
                >
                  {copy.endSession}
                </button>
              </>
            ) : (
              <button
                type="button"
                className="ldz-btn ldz-btn--danger"
                onClick={() => void handleClose()}
                disabled={status === "stopping"}
              >
                {copy.endSession}
              </button>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
