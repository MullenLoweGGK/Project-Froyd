"use client";

import {
  froydContent,
  HELPLINE_LABEL,
  HELPLINE_PHONE,
} from "@/lib/ldz-content";

type Props = {
  visible: boolean;
};

export function CreditLimitAnnouncement({ visible }: Props) {
  if (!visible) return null;

  const { title, message } = froydContent.creditLimit;

  return (
    <aside
      className="ldz-credit-banner"
      role="alert"
      aria-live="assertive"
    >
      <p className="ldz-credit-banner__title">{title}</p>
      <p className="ldz-credit-banner__message">{message}</p>
      <p className="ldz-credit-banner__helpline">
        Ak potrebujete podporu, zavolajte {HELPLINE_LABEL}:{" "}
        <a href={`tel:${HELPLINE_PHONE.replace(/\s/g, "")}`}>
          {HELPLINE_PHONE}
        </a>
      </p>
    </aside>
  );
}
