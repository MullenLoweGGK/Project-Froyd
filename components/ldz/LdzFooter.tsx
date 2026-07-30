import {
  froydContent,
  LDZ_ABOUT_URL,
  LDZ_CONTACT_URL,
  LDZ_HOME_URL,
  LDZ_PRIVACY_URL,
} from "@/lib/ldz-content";

export function LdzFooter() {
  return (
    <footer className="ldz-footer">
      <div className="ldz-container ldz-footer__inner">
        <div className="ldz-footer__brand">
          <p className="ldz-footer__org">Liga za duševné zdravie</p>
          <p className="ldz-footer__tag">FROYD — vzdelávacia AI simulácia</p>
          <p className="ldz-footer__disclosure">{froydContent.aiDisclosure.note}</p>
        </div>

        <ul className="ldz-footer__links">
          <li>
            <a href={LDZ_HOME_URL}>dusevnezdravie.sk</a>
          </li>
          <li>
            <a href={LDZ_ABOUT_URL}>O nás</a>
          </li>
          <li>
            <a href={LDZ_CONTACT_URL}>Kontakty</a>
          </li>
          <li>
            <a href={LDZ_PRIVACY_URL}>Ochrana osobných údajov</a>
          </li>
        </ul>
      </div>
      <div className="ldz-footer__bar">
        <div className="ldz-container">
          <p>© {new Date().getFullYear()} Liga za duševné zdravie</p>
        </div>
      </div>
    </footer>
  );
}
