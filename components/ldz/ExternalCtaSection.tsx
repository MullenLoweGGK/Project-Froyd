import { froydContent } from "@/lib/ldz-content";

/**
 * Merged lower band: challenge copy + course CTA on the orange case graphic.
 */
export function ExternalCtaSection() {
  const {
    challengeHeadline,
    challengeParagraphs,
    courseHeadline,
    courseParagraphs,
    buttonLabel,
    href,
  } = froydContent.infoCta;

  return (
    <section
      id="kurz"
      className="ldz-info-cta"
      aria-labelledby="challenge-heading"
    >
      <div className="ldz-info-cta__bg" aria-hidden="true" />
      <div className="ldz-container ldz-info-cta__inner">
        <div className="ldz-info-cta__block">
          <h2 id="challenge-heading">{challengeHeadline}</h2>
          {challengeParagraphs.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>

        <div className="ldz-info-cta__block">
          <h2 id="course-cta-heading">{courseHeadline}</h2>
          {courseParagraphs.map((p) => (
            <p key={p}>{p}</p>
          ))}
          <a
            href={href}
            className="ldz-btn ldz-btn--on-hero"
            target="_blank"
            rel="noopener noreferrer"
          >
            {buttonLabel}
          </a>
        </div>
      </div>
    </section>
  );
}
