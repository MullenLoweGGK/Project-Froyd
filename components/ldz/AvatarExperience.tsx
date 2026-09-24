"use client";

import { useCallback, useState } from "react";
import dynamic from "next/dynamic";
import type {
  AvatarScenario,
  ConversationLanguage,
} from "@/lib/avatar-scenarios";
import { PUBLIC_AVATAR_SCENARIOS } from "@/lib/avatar-scenarios";
import { froydContent } from "@/lib/ldz-content";
import { AvatarScenarioCard } from "@/components/ldz/AvatarScenarioCard";
import { CreditLimitAnnouncement } from "@/components/ldz/CreditLimitAnnouncement";
import { useCreditsExhausted } from "@/hooks/useCreditsExhausted";

const AvatarModal = dynamic(
  () => import("@/components/ldz/AvatarModal").then((m) => m.AvatarModal),
  { ssr: false }
);

type ActiveSession = {
  scenario: AvatarScenario;
  language: ConversationLanguage;
};

export function AvatarExperience() {
  const [active, setActive] = useState<ActiveSession | null>(null);
  const { creditsExhausted } = useCreditsExhausted();

  const handleLaunch = useCallback(
    (scenario: AvatarScenario, language: ConversationLanguage) => {
      setActive({ scenario, language });
    },
    []
  );

  const handleClose = useCallback(() => {
    setActive(null);
  }, []);

  return (
    <section
      id="scenare"
      className="ldz-section ldz-scenarios"
      aria-labelledby="challenge-heading"
    >
      <div className="ldz-container">
        <div className="ldz-scenarios__intro">
          <h2 id="challenge-heading" className="ldz-scenarios__headline">
            {froydContent.infoCta.challengeHeadline}
          </h2>
        </div>

        <CreditLimitAnnouncement visible={creditsExhausted} />

        <div className="ldz-scenarios__grid">
          {PUBLIC_AVATAR_SCENARIOS.map((scenario) => (
            <AvatarScenarioCard
              key={scenario.id}
              scenario={scenario}
              isActiveSession={Boolean(active)}
              creditsExhausted={creditsExhausted}
              onLaunch={handleLaunch}
            />
          ))}
        </div>
      </div>

      {active ? (
        <AvatarModal
          key={`${active.scenario.id}-${active.language}`}
          scenario={active.scenario}
          language={active.language}
          open
          creditsExhausted={creditsExhausted}
          onClose={handleClose}
        />
      ) : null}
    </section>
  );
}
