import { froydContent } from "@/lib/ldz-content";

/**
 * Course CTA band on navy — intro copy + course CTA.
 */
export function ExternalCtaSection() {
  const {
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
      aria-labelledby="course-cta-heading"
    >
      <div className="ldz-container ldz-info-cta__inner">
        <div className="ldz-info-cta__block">
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
