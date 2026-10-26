export type ConversationLanguage = "sk" | "en";

/** Optional English pack — when present, the card can launch an EN session. */
export type ScenarioEnglishPack = {
  /** HeyGen Knowledge Base / Context UUID for English */
  contextId: string;
  /** Optional EN voice; falls back to the scenario’s default voice */
  voiceId?: string;
  ctaLabel?: string;
  openingText?: string;
  questionLimitMessage?: string;
  questionLimitFollowupMessage?: string;
};

export type ResolvedScenarioSession = {
  language: ConversationLanguage;
  avatarId: string;
  contextId?: string;
  voiceId?: string;
  openingText?: string;
  /** Omit / undefined = no hard question limit */
  questionLimit?: number;
  questionLimitMessage?: string;
  questionLimitFollowupMessage?: string;
  /** Talk clock after first mic unmute (ms). */
  maxSessionMs?: number;
};

export type AvatarScenario = {
  id: string;
  slug: string;
  name: string;
  /** Instrumental case for “Rozhovor s …” headlines (Evou, Petrom, Tomášom) */
  nameInstrumental: string;
  title: string;
  description: string;
  /** Long first-person profile shown on the courses listing */
  profile: string;
  quote: string;
  ctaLabel: string;
  /** HeyGen LiveAvatar UUID — empty string means not configured yet */
  avatarId: string;
  /** Knowledge-base / context UUID — empty string means not configured yet */
  contextId: string;
  voiceId?: string;
  image?: string;
  /** Speech-bubble nameplate under the portrait */
  nameImage?: string;
  label?: string;
  /** Portrait interaction as specified in content doc */
  aspect: "9:16";
  /** When false, launch CTA is disabled */
  available: boolean;
  /**
   * Spoken intro after stream is ready (session.repeat).
   * Empty/undefined on the courses site — participant speaks first.
   */
  openingText?: string;
  /** Hard client-side stop after N user turns. Omit = unlimited. */
  questionLimit?: number;
  /** Forced closing line when questionLimit is hit (session.repeat). */
  questionLimitMessage?: string;
  /** Spoken on every further user turn after the limit (5th+). */
  questionLimitFollowupMessage?: string;
  /** Talk clock after first mic unmute. Default applied in session hook if omitted. */
  maxSessionMs?: number;
  /** English session override (context + scripted lines). */
  english?: ScenarioEnglishPack;
};

/** Courses site: 10 minutes after first mic unmute. */
export const COURSE_MAX_SESSION_MS = 600_000;

/**
 * Minimal spoken line so we keep the proven main flow:
 * ready gate → repeat(opening) → AVATAR_SPEAK_ENDED → unmute.
 * Empty intro skipped that path and broke Safari mic activation.
 */
export const COURSE_OPENING_TEXT = "Ahoj";

/**
 * Scenario configuration for the PPDZ courses microsite (branch: courses).
 *
 * Env naming (avatar / context / voice per person):
 * - Eva:   NEXT_PUBLIC_EVA_*   (falls back to legacy NEXT_PUBLIC_DEFAULT_*)
 * - Peter: NEXT_PUBLIC_PETER_*
 * - Tomáš: NEXT_PUBLIC_TOMAS_*
 *
 * IMPORTANT: Next.js only inlines NEXT_PUBLIC_* when accessed via a static
 * `process.env.NEXT_PUBLIC_…` expression. Dynamic `process.env[key]` stays empty
 * in the client bundle — never use that pattern here.
 */
function pickEnv(...values: Array<string | undefined>): string {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return "";
}

const evaAvatarId = pickEnv(
  process.env.NEXT_PUBLIC_EVA_AVATAR_ID,
  process.env.NEXT_PUBLIC_DEFAULT_AVATAR_ID
);
const evaContextId = pickEnv(
  process.env.NEXT_PUBLIC_EVA_CONTEXT_ID,
  process.env.NEXT_PUBLIC_DEFAULT_CONTEXT_ID
);
const evaVoiceId = pickEnv(
  process.env.NEXT_PUBLIC_EVA_VOICE_ID,
  process.env.NEXT_PUBLIC_DEFAULT_VOICE_ID
);

const peterAvatarId = pickEnv(process.env.NEXT_PUBLIC_PETER_AVATAR_ID);
const peterContextId = pickEnv(process.env.NEXT_PUBLIC_PETER_CONTEXT_ID);
const peterVoiceId = pickEnv(process.env.NEXT_PUBLIC_PETER_VOICE_ID);

const tomasAvatarId = pickEnv(process.env.NEXT_PUBLIC_TOMAS_AVATAR_ID);
const tomasContextId = pickEnv(process.env.NEXT_PUBLIC_TOMAS_CONTEXT_ID);
const tomasVoiceId = pickEnv(process.env.NEXT_PUBLIC_TOMAS_VOICE_ID);

export const AVATAR_SCENARIOS: AvatarScenario[] = [
  {
    id: "peter",
    slug: "peter",
    name: "Peter Horváth",
    nameInstrumental: "Petrom",
    title: "Peter Horváth",
    description:
      "AI simulácia vzdelávacieho rozhovoru. Nie je diagnostický ani medicínsky nástroj.",
    profile:
      "Peter má 45 rokov, je otcom kamaráta vášho syna a poznáte sa z rôznych rodičovských stretnutí a strávili ste spolu aj niekoľko neformálnych výletov s deťmi. Vždy bol dosť tichý, ale v rozhovoroch ste ho vnímali ako citlivého človeka, ktorý vždy aktívne podporoval spoločné veci. Robí účtovníka v stredne veľkej firme. Pred niekoľkými dňami ste sa stretli pred školou a zdal sa vám dosť smutný. Na vašu otázku „Ako sa máš?“ len mykol plecami a niečo potichu povedal. Večer ste mu poslali správu do četu a v odpovedi vám napísal, že je to teraz celé komplikované a že ho už ani práca a ani iné aktivity veľmi nebavia. Máte o neho obavy, tak ste mu navrhli rozhovor pri káve. Súhlasil. Stretli ste sa v kaviarni kúsok od školy a vy otvárate rozhovor.",
    quote: "",
    ctaLabel: "Porozprávať sa s Petrom",
    avatarId: peterAvatarId,
    contextId: peterContextId,
    voiceId: peterVoiceId || undefined,
    image: "/ldz/avatars/peter.jpg",
    nameImage: "/ldz/avatars/name-peter.png",
    aspect: "9:16",
    available: Boolean(peterAvatarId),
    label: "AI simulácia",
    openingText: COURSE_OPENING_TEXT,
    maxSessionMs: COURSE_MAX_SESSION_MS,
  },
  {
    id: "tomas",
    slug: "tomas",
    name: "Tomáš Novák",
    nameInstrumental: "Tomášom",
    title: "Tomáš Novák",
    description:
      "AI simulácia vzdelávacieho rozhovoru. Nie je diagnostický ani medicínsky nástroj.",
    profile:
      "Tomáš má 22 rokov, študuje informatiku na vysokej škole a popri štúdiu pracuje na čiastočný úväzok ako programátor. Ste jeho kolega v práci. Je skôr tichý, ľudia ho vnímajú ako introverta, ale vy ste si viackrát všimli, že pri rozhovore s vami alebo s inými kolegami býva dosť nervózny. Na spoločné porady chodí len zriedkavo a do práce chodí väčšinou len vtedy, keď porady nie sú, aby vybavil najnutnejšie veci. Najradšej robí z domu a komunikuje emailom. Často sa mu neviete dovolať a keď máte online stretnutie, tak nikdy si nezapína kameru a vždy má na to nejaký dôvod. S kolegami ste už hovorili, že vyzerá fajn, je šikovný a radi by ste ho viac spoznali. Preto ste ho pozvali na spoločné neformálne posedenie v piatok večer do podniku, kde chodíte pravidelne s viacerými kolegami. Najprv sa tváril, že rád príde, ale potom to na poslednú chvíľu zrušil kvôli nejakým osobným veciam. Podobná situácia sa zopakovala aj druhýkrát. Napadlo vám, že sa ľuďom vyhýba zámerne a keď sa už s niekým stretne, tak pôsobí veľmi napäto. Dnes sa objavil v práci a náhodou ste ho stretli v kuchynke, ako si varí kávu. Rozhodli ste sa, že to využijete, pridali ste sa k nemu a spýtali ste sa, či si chce s vami vypiť kávu – hoci bol v rozpakoch, tak súhlasil. Otvorte s ním rozhovor o vašich obavách.",
    quote: "",
    ctaLabel: "Porozprávať sa s Tomášom",
    avatarId: tomasAvatarId,
    contextId: tomasContextId,
    voiceId: tomasVoiceId || undefined,
    image: "/ldz/avatars/tomas.jpg",
    nameImage: "/ldz/avatars/name-tomas.png",
    aspect: "9:16",
    available: Boolean(tomasAvatarId),
    label: "AI simulácia",
    openingText: COURSE_OPENING_TEXT,
    maxSessionMs: COURSE_MAX_SESSION_MS,
  },
  {
    id: "eva",
    slug: "eva",
    name: "Eva Kováčová",
    nameInstrumental: "Evou",
    title: "Eva Kováčová",
    description:
      "AI simulácia vzdelávacieho rozhovoru. Nie je diagnostický ani medicínsky nástroj.",
    profile:
      "Eva má 56 rokov, pracuje ako vedúca sestra na internej klinike v krajskom meste. Býva vo vedľajšom byte na rovnakom poschodí ako vy. Vždy ste ju poznali ako energetickú a silnú ženu. Pomerne rýchlo ste sa spriatelili po tom, čo ste sa nasťahovali do súčasného bytu. Zvyknete si občas spolu neformálne posedieť pri príležitosti narodenín alebo menín spolu so svojimi rodinami. Poznáte veľa zaujímavých príhod z jej práce – pracovala vždy tvrdo, ťahala nočné aj víkendové služby, riešila na klinike veľmi vážne stavy. V poslednej dobe je menej komunikatívna, máte pocit, že sa do seba uzatvára, keď sa rozprávate tak hovorí o tom, ako nemá energiu, práca ju už nebaví a najradšej by tam už nechodila. Keď bola naposledy príležitosť na rodinné stretnutie, tak sa deň predtým ospravedlnila a zrušila ho s tým, že sa môžete stretnúť niekedy neskôr. Na druhý deň ste sa vo výťahu stretli s jej manželom a ten vám povedal, že netuší, čo sa s ňou deje, že je v poslednej dobe veľmi nervózna, konfliktná a napriek tomu, že aj on a aj deti sa veľmi snažia, aby mala čas na oddych, tak je stále veľmi vyčerpaná. Napísali ste jej do četu, že by ste sa s ňou chceli stretnúť a súhlasila s krátkou prechádzkou vonku v sobotu večer. Ste spolu vonku a otvárate rozhovor o tom, ako sa má.",
    quote: "",
    ctaLabel: "Porozprávať sa s Evou",
    avatarId: evaAvatarId,
    contextId: evaContextId,
    voiceId: evaVoiceId || undefined,
    image: "/ldz/avatars/eva.jpg",
    nameImage: "/ldz/avatars/name-eva.png",
    aspect: "9:16",
    available: Boolean(evaAvatarId),
    label: "AI simulácia",
    openingText: COURSE_OPENING_TEXT,
    maxSessionMs: COURSE_MAX_SESSION_MS,
  },
];

/** Scenarios shown on the PPDZ courses microsite. */
export const PUBLIC_AVATAR_SCENARIOS = AVATAR_SCENARIOS.filter((s) =>
  ["peter", "tomas", "eva"].includes(s.id)
);

export function getScenarioById(id: string): AvatarScenario | undefined {
  return AVATAR_SCENARIOS.find((s) => s.id === id);
}

export function isScenarioReady(scenario: AvatarScenario): boolean {
  return Boolean(scenario.available && scenario.avatarId);
}

export function scenarioSupportsEnglish(scenario: AvatarScenario): boolean {
  return Boolean(scenario.english?.contextId && scenario.avatarId);
}

/** Pick SK/EN context + scripted lines for a LiveAvatar session. */
export function resolveScenarioSession(
  scenario: AvatarScenario,
  language: ConversationLanguage = "sk"
): ResolvedScenarioSession {
  if (language === "en" && scenario.english?.contextId) {
    const en = scenario.english;
    return {
      language: "en",
      avatarId: scenario.avatarId,
      contextId: en.contextId,
      voiceId: en.voiceId || scenario.voiceId,
      openingText: en.openingText,
      questionLimit: scenario.questionLimit,
      questionLimitMessage: en.questionLimitMessage,
      questionLimitFollowupMessage: en.questionLimitFollowupMessage,
      maxSessionMs: scenario.maxSessionMs,
    };
  }

  return {
    language: "sk",
    avatarId: scenario.avatarId,
    contextId: scenario.contextId || undefined,
    voiceId: scenario.voiceId,
    openingText: scenario.openingText,
    questionLimit: scenario.questionLimit,
    questionLimitMessage: scenario.questionLimitMessage,
    questionLimitFollowupMessage: scenario.questionLimitFollowupMessage,
    maxSessionMs: scenario.maxSessionMs,
  };
}
