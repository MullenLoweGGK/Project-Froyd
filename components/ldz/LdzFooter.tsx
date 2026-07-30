import { froydContent, LDZ_HOME_URL } from "@/lib/ldz-content";

export function LdzFooter() {
  return (
    <footer className="ldz-footer">
      <div className="ldz-footer__bg" aria-hidden="true" />
      <div className="ldz-container ldz-footer__inner">
        <div className="ldz-footer__brand">
          <p className="ldz-footer__org">Liga za duševné zdravie</p>
          <p className="ldz-footer__tag">FROYD — vzdelávacia AI simulácia</p>
          <p className="ldz-footer__disclosure">{froydContent.aiDisclosure.note}</p>
        </div>
      </div>
      <div className="ldz-footer__bar">
        <div className="ldz-container ldz-footer__bar-inner">
          <p>© 2026 Liga za duševné zdravie</p>
          <a
            href={LDZ_HOME_URL}
            className="ldz-footer__site-link"
            target="_blank"
            rel="noopener noreferrer"
          >
            dusevnezdravie.sk
          </a>
        </div>
      </div>
    </footer>
  );
}
