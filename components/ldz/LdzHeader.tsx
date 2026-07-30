import Image from "next/image";
import { LDZ_HOME_URL } from "@/lib/ldz-content";

export function LdzHeader() {
  return (
    <header className="ldz-header">
      <div className="ldz-header__inner">
        <a
          href={LDZ_HOME_URL}
          className="ldz-header__brand"
          aria-label="Liga za duševné zdravie — späť na hlavný web"
        >
          <Image
            src="/ldz/logo.svg"
            alt="Liga za duševné zdravie"
            width={155}
            height={64}
            className="ldz-header__logo"
            priority
          />
        </a>

        <p className="ldz-header__title">Project Froyd</p>
      </div>
    </header>
  );
}
