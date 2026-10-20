/**
 * Structured content for the PPDZ courses microsite (branch: courses).
 * Campaign landing stays on main / froyd.app.
 */

export const PRVA_POMOC_URL = "https://dusevnezdravie.sk/stranka/prva-pomoc/";
export const LDZ_HOME_URL = "https://dusevnezdravie.sk/";
export const LDZ_PRIVACY_URL = "https://dusevnezdravie.sk/ochrana-osobnych-udajov";
export const LDZ_CONTACT_URL = "https://dusevnezdravie.sk/o-nas/kontakty";
export const LDZ_ABOUT_URL = "https://dusevnezdravie.sk/o-nas/kto-sme";
export const HELPLINE_PHONE = "0800 800 566";
export const HELPLINE_LABEL = "Linka dôvery Nezábudka";

export const froydContent = {
  meta: {
    title:
      "PPDZ — Nácvik rozhovoru s AI avatarmi | Liga za duševné zdravie",
    description:
      "Súkromné prostredie pre účastníkov kurzu Prvá pomoc pre dušu. Vzdelávacia AI simulácia rozhovoru — nie diagnostický nástroj.",
  },
  /** Challenge headline sits above avatar cards; navy band = course guidance */
  infoCta: {
    challengeHeadline: "Nácvik citlivého rozhovoru",
    challengeParagraphs: [
      "Toto prostredie je určené účastníkom kurzu Prvá pomoc pre dušu. S AI avatarmi si môžete bezpečne vyskúšať vedenie citlivého rozhovoru — skúšať, robiť chyby a pýtať sa bez strachu, že niekomu ublížite.",
      "Nie všetky duševné problémy sú viditeľné na prvý pohľad. Nácvik na simulácii vám pomôže všimnúť si signály a viesť rozhovor s väčšou istotou.",
    ],
    courseHeadline: "Ako na to",
    courseParagraphs: [
      "Vyberte si avatara, vypočujte predstavenie a položte niekoľko otázok. Hovorte prirodzene — rovnako ako na kurze. Scenár je vzdelávacia simulácia, nie diagnostika.",
    ],
    /** Empty = no public signup CTA on the courses site */
    buttonLabel: "",
    href: PRVA_POMOC_URL,
  },
  aiDisclosure: {
    label: "AI simulácia",
    note:
      "Interagujete s AI avatarom vo vzdelávacej simulácii. Scenár nevyjadruje všetkých ľudí s daným prežívaním, nie je diagnostickým ani medicínskym nástrojom.",
  },
  /** Shown when HeyGen LiveAvatar credits / quota are exhausted */
  creditLimit: {
    body: "Prepáčte, limit rozhovorov s AI avatarmi je momentálne vyčerpaný. Skúste to prosím neskôr alebo sa obráťte na lektora kurzu.",
    moreInfoBefore: "Viac o kurze nájdete na webe ",
    moreInfoLinkLabel: "Ligy za duševné zdravie",
    moreInfoHref: PRVA_POMOC_URL,
    message:
      "Prepáčte, limit rozhovorov s AI avatarmi je momentálne vyčerpaný. Skúste to prosím neskôr alebo sa obráťte na lektora kurzu.",
    ctaDisabledLabel: "Dočasne nedostupné",
  },
} as const;
