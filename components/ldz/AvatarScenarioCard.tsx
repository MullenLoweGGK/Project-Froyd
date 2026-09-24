"use client";

import Image from "next/image";
import type {
  AvatarScenario,
  ConversationLanguage,
} from "@/lib/avatar-scenarios";
import {
  isScenarioReady,
  scenarioSupportsEnglish,
} from "@/lib/avatar-scenarios";
import { froydContent } from "@/lib/ldz-content";
import { AiSimulationLabel } from "@/components/ldz/AiSimulationLabel";

type Props = {
  scenario: AvatarScenario;
  isActiveSession: boolean;
  creditsExhausted?: boolean;
  onLaunch: (scenario: AvatarScenario, language: ConversationLanguage) => void;
};

export function AvatarScenarioCard({
  scenario,
  isActiveSession,
  creditsExhausted = false,
  onLaunch,
}: Props) {
  const ready = isScenarioReady(scenario);
  const launchDisabled = !ready || isActiveSession || creditsExhausted;
  const showEnglish = scenarioSupportsEnglish(scenario);
  const showDevHint =
    process.env.NODE_ENV === "development" && !ready && scenario.quote;

  const buttonLabel = creditsExhausted
    ? froydContent.creditLimit.ctaDisabledLabel
    : scenario.ctaLabel;

  const englishLabel =
    scenario.english?.ctaLabel?.trim() || "Talk in English";

  return (
    <article className="ldz-scenario-card" id={`scenario-${scenario.slug}`}>
      <div className="ldz-scenario-card__portrait">
        {scenario.image ? (
          <Image
            src={scenario.image}
            alt={`Portrét — ${scenario.name}`}
            fill
            className="ldz-scenario-card__photo"
            sizes="(max-width: 960px) 26rem, 33vw"
          />
        ) : (
          <div className="ldz-scenario-card__avatar-placeholder" aria-hidden="true">
            <span>{scenario.name.charAt(0)}</span>
          </div>
        )}
        <AiSimulationLabel compact />
      </div>

      <div className="ldz-scenario-card__body">
        <h3 className="ldz-scenario-card__name">
          {scenario.nameImage ? (
            <Image
              src={scenario.nameImage}
              alt={scenario.name}
              width={620}
              height={294}
              className="ldz-scenario-card__name-badge"
              sizes="11.2rem"
            />
          ) : (
            scenario.name
          )}
        </h3>
        {scenario.quote ? (
          <blockquote className="ldz-scenario-card__quote">
            <p>„{scenario.quote.replace(/^"|"$/g, "")}“</p>
          </blockquote>
        ) : null}

        <div className="ldz-scenario-card__actions">
          <button
            type="button"
            className="ldz-btn ldz-btn--secondary"
            disabled={launchDisabled}
            onClick={() => onLaunch(scenario, "sk")}
            aria-label={
              creditsExhausted
                ? `${scenario.ctaLabel} — ${froydContent.creditLimit.ctaDisabledLabel}`
                : ready
                  ? scenario.ctaLabel
                  : `${scenario.ctaLabel} — zatiaľ nedostupné`
            }
          >
            {buttonLabel}
          </button>

          {showEnglish ? (
            <button
              type="button"
              className="ldz-btn ldz-btn--primary"
              disabled={launchDisabled}
              lang="en"
              onClick={() => onLaunch(scenario, "en")}
              aria-label={
                creditsExhausted
                  ? `${englishLabel} — ${froydContent.creditLimit.ctaDisabledLabel}`
                  : englishLabel
              }
            >
              {creditsExhausted
                ? froydContent.creditLimit.ctaDisabledLabel
                : englishLabel}
            </button>
          ) : null}
        </div>

        <p className="ldz-scenario-card__disclosure">
          {froydContent.aiDisclosure.note}
        </p>

        {!ready && scenario.quote && !creditsExhausted ? (
          <p className="ldz-scenario-card__soon" role="status">
            Tento scenár pripravujeme.
          </p>
        ) : null}

        {showDevHint ? (
          <p className="ldz-scenario-card__dev" aria-hidden="true">
            [dev] Chýba avatarId / contextId
          </p>
        ) : null}
      </div>
    </article>
  );
}
