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
      "Som Peter Horváth, mám 45 rokov a pracujem ako účtovník v stredne veľkej firme. Posledných niekoľko mesiacov mám pocit, akoby zo mňa niečo odišlo. Nejde ani tak o smútok. Skôr o to, že ma už skoro nič neteší, nič ma veľmi nezaujíma a všetko ma stojí veľa energie. Fungujem, chodím do práce, robím, čo treba, ale mám pocit, akoby som život len odžil. O tom, ako sa cítim, veľa nerozprávam. Mám pocit, že by som tým iba zaťažoval ostatných.",
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
      "Som Tomáš Novák, mám 22 rokov a študujem informatiku na vysokej škole. Popri škole pracujem na čiastočný úväzok ako programátor. Väčšina ľudí by povedala, že som tichý alebo introvert, ale pravda je, že medzi ľuďmi bývam veľmi nervózny.\n\nNeustále premýšľam nad tým, čo si o mne ostatní myslia, či som nepovedal niečo trápne alebo či nepôsobím divne. Navonok sa snažím tváriť pokojne, ale vo vnútri som často napätý. O svojich problémoch veľa nerozprávam, skôr ich skrývam. Často si myslím, že ostatní to zvládajú prirodzene a ja som v tomto akosi pokazený.",
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
      "Som Eva Kováčová, mám 56 rokov a posledný rok sa cítim dlhodobo vyčerpaná prácou aj všetkým okolo nej. Pracujem ako vedúca sestra na internej klinike v krajskom meste. Kedysi som bola človek, ktorý zvládol tlak, vedel podržať tím a mal k ľuďom prirodzenú trpezlivosť. Teraz mám pocit, že fungujem už len zo zvyku. Ráno vstávam unavená, v práci som podráždenejšia, častejšie zabúdam drobnosti a po službe nemám energiu ani chuť na rodinu, kamarátky či veci, ktoré ma kedysi tešili. O svojom stave hovorím opatrne, s hanbou a sebakritikou. Nepôsobím teatrálne, skôr ako žena, ktorá bola dlho silná a už jej dochádzajú sily.",
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
