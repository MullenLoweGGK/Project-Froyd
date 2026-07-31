import Image from "next/image";
import { LDZ_HOME_URL } from "@/lib/ldz-content";

export function LdzHeader() {
  return (
    <header className="ldz-header">
      <div className="ldz-header__inner">
        <p className="ldz-header__title">
          <Image
            src="/ldz/logo-froyd.png"
            alt="Projekt Froyd"
            width={838}
            height={256}
            className="ldz-header__title-logo"
            sizes="(max-width: 1024px) 18rem, 22rem"
            quality={100}
            priority
          />
        </p>

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
      </div>
    </header>
  );
}
