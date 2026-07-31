"use client";

import Image from "next/image";
import type { AvatarScenario } from "@/lib/avatar-scenarios";
import { isScenarioReady } from "@/lib/avatar-scenarios";
import { froydContent } from "@/lib/ldz-content";
import { AiSimulationLabel } from "@/components/ldz/AiSimulationLabel";

type Props = {
  scenario: AvatarScenario;
  isActiveSession: boolean;
  onLaunch: (scenario: AvatarScenario) => void;
};

export function AvatarScenarioCard({ scenario, isActiveSession, onLaunch }: Props) {
  const ready = isScenarioReady(scenario);
  const showDevHint =
    process.env.NODE_ENV === "development" && !ready && scenario.quote;

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
              width={775}
              height={368}
              className="ldz-scenario-card__name-badge"
              sizes="(max-width: 960px) 14rem, 18vw"
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

        <button
          type="button"
          className="ldz-btn ldz-btn--secondary"
          disabled={!ready || isActiveSession}
          onClick={() => onLaunch(scenario)}
          aria-label={
            ready
              ? scenario.ctaLabel
              : `${scenario.ctaLabel} — zatiaľ nedostupné`
          }
        >
          {ready ? scenario.ctaLabel : `${scenario.ctaLabel}`}
        </button>

        <p className="ldz-scenario-card__disclosure">
          {froydContent.aiDisclosure.note}
        </p>

        {!ready && scenario.quote ? (
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
