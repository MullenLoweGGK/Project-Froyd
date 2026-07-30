"use client";

import { useCallback, useState } from "react";
import dynamic from "next/dynamic";
import type { AvatarScenario } from "@/lib/avatar-scenarios";
import { PUBLIC_AVATAR_SCENARIOS } from "@/lib/avatar-scenarios";
import { froydContent } from "@/lib/ldz-content";
import { AvatarScenarioCard } from "@/components/ldz/AvatarScenarioCard";

const AvatarModal = dynamic(
  () => import("@/components/ldz/AvatarModal").then((m) => m.AvatarModal),
  { ssr: false }
);

export function AvatarExperience() {
  const [active, setActive] = useState<AvatarScenario | null>(null);

  const handleLaunch = useCallback((scenario: AvatarScenario) => {
    setActive(scenario);
  }, []);

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

        <div className="ldz-scenarios__grid">
          {PUBLIC_AVATAR_SCENARIOS.map((scenario) => (
            <AvatarScenarioCard
              key={scenario.id}
              scenario={scenario}
              isActiveSession={Boolean(active)}
              onLaunch={handleLaunch}
            />
          ))}
        </div>
      </div>

      {active ? (
        <AvatarModal
          key={active.id}
          scenario={active}
          open
          onClose={handleClose}
        />
      ) : null}
    </section>
  );
}
