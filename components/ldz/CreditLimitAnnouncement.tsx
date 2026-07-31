"use client";

import { froydContent } from "@/lib/ldz-content";

type Props = {
  visible: boolean;
};

export function CreditLimitAnnouncement({ visible }: Props) {
  if (!visible) return null;

  const {
    body,
    moreInfoBefore,
    moreInfoLinkLabel,
    moreInfoHref,
  } = froydContent.creditLimit;

  return (
    <aside
      className="ldz-credit-banner"
      role="alert"
      aria-live="assertive"
    >
      <p className="ldz-credit-banner__body">{body}</p>
      <p className="ldz-credit-banner__more">
        {moreInfoBefore}
        <a
          href={moreInfoHref}
          target="_blank"
          rel="noopener noreferrer"
        >
          {moreInfoLinkLabel}
        </a>
        .
      </p>
    </aside>
  );
}
