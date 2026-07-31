/**
 * Structured content for the FROYD microsite.
 * Source of truth: docs/froyd-content.md + client layout updates.
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
    title: "FROYD — Vyskúšajte si rozhovor, ktorý môže pomôcť | Liga za duševné zdravie",
    description:
      "Porozprávajte sa s AI avatarmi Ligy za duševné zdravie. Položte tri otázky a skúste odhaliť, čo človek prežíva. Vzdelávacia simulácia — nie diagnostický nástroj.",
  },
  /** Challenge headline sits above avatar cards; course CTA is the navy band */
  infoCta: {
    challengeHeadline: "Dokážete spoznať, čo ich trápi?",
    challengeParagraphs: [
      "Nie všetky duševné problémy sú viditeľné na prvý pohľad. Niekedy však veľa prezradí aj obyčajný rozhovor. Na Slovensku je pritom duševné zdravie stále témou, o ktorej sa mnohí ostýchajú hovoriť. Zo strachu, hanby alebo jednoducho preto, že nevedia, ako začať.",
      "Preto sme vytvorili Projekt FROYD - AI avatarov, ktorí dokonale imitujú rôzne duševné problémy. AI avatar vám umožní skúšať, robiť chyby alebo sa pýtať citlivé otázky v bezpečnom prostredí. Bez strachu, že niekomu ublížite.",
    ],
    courseHeadline: "Chcete vedieť viac?",
    courseParagraphs: [
      "Ak vás rozhovor zaujal, na kurze Prvá pomoc pre dušu sa naučíte rozpoznávať varovné signály, viesť citlivý rozhovor a nasmerovať človeka k odbornej pomoci.",
    ],
    buttonLabel: "Prihlásiť sa na kurz",
    href: PRVA_POMOC_URL,
  },
  aiDisclosure: {
    label: "AI simulácia",
    note:
      "Interagujete s AI avatarom vo vzdelávacej simulácii. Scenár nevyjadruje všetkých ľudí s daným prežívaním, nie je diagnostickým ani medicínskym nástrojom.",
  },
} as const;
