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
  questionLimit?: number;
  questionLimitMessage?: string;
  questionLimitFollowupMessage?: string;
};

export type AvatarScenario = {
  id: string;
  slug: string;
  name: string;
  /** Instrumental case for “Rozhovor s …” headlines (Evou, Petrom, Tomášom) */
  nameInstrumental: string;
  title: string;
  description: string;
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
   * HeyGen Context Opening Text must be empty/disabled so this does not double-fire.
   */
  openingText?: string;
  /** Hard client-side stop after N user turns. */
  questionLimit?: number;
  /** Forced closing line when questionLimit is hit (session.repeat). */
  questionLimitMessage?: string;
  /** Spoken on every further user turn after the limit (5th+). */
  questionLimitFollowupMessage?: string;
  /** English session override (context + scripted lines). */
  english?: ScenarioEnglishPack;
};

/**
 * Scenario configuration for the FROYD microsite.
 *
 * Env naming (avatar / context / voice per person):
 * - Eva:   NEXT_PUBLIC_EVA_*   (falls back to legacy NEXT_PUBLIC_DEFAULT_*)
 * - Peter: NEXT_PUBLIC_PETER_*  (+ optional NEXT_PUBLIC_PETER_CONTEXT_ID_EN / VOICE_ID_EN)
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

/** LiveAvatar EN context for Peter — override via env without a redeploy of the default. */
const PETER_EN_CONTEXT_FALLBACK = "f107a300-f8bb-48c9-b6a5-47281469bcc5";

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
const peterContextIdEn = pickEnv(
  process.env.NEXT_PUBLIC_PETER_CONTEXT_ID_EN,
  PETER_EN_CONTEXT_FALLBACK
);
const peterVoiceIdEn = pickEnv(process.env.NEXT_PUBLIC_PETER_VOICE_ID_EN);

const tomasAvatarId = pickEnv(process.env.NEXT_PUBLIC_TOMAS_AVATAR_ID);
const tomasContextId = pickEnv(process.env.NEXT_PUBLIC_TOMAS_CONTEXT_ID);
const tomasVoiceId = pickEnv(process.env.NEXT_PUBLIC_TOMAS_VOICE_ID);
export const AVATAR_SCENARIOS: AvatarScenario[] = [
  {
    id: "eva",
    slug: "eva",
    name: "Eva",
    nameInstrumental: "Evou",
    title: "Eva",
    description:
      "AI simulácia vzdelávacieho rozhovoru. Nie je diagnostický ani medicínsky nástroj.",
    quote: "Ľudia hovoria, že vyzerám nejaká unavená.",
    ctaLabel: "Porozprávať sa s Evou",
    avatarId: evaAvatarId,
    contextId: evaContextId,
    voiceId: evaVoiceId || undefined,
    image: "/ldz/avatars/eva.jpg",
    nameImage: "/ldz/avatars/name-eva.png",
    aspect: "9:16",
    available: Boolean(evaAvatarId),
    label: "AI simulácia",
    openingText:
      "Ahoj, volám sa Eva, mám 56 rokov a 31 rokov pracujem v zdravotníctve, z toho posledných sedem rokov ako vrchná sestra. Mám manžela a dve dospelé deti, ktoré už nežijú doma. Posledný rok sa starám o chorú mamu. Rada cestujem a chodím na túry do prírody. V poslednom čase sa k tomu však na nič nemám energiu.",
    questionLimit: 4,
    questionLimitMessage:
      "Toto je už štvrtá otázka. Na ďalšie otázky ti rada odpoviem na kurze Prvá pomoc pre dušu.",
    questionLimitFollowupMessage:
      "Na ďalšie otázky ti rada odpoviem na kurze prvej pomoci pre dušu.",
  },
  {
    id: "peter",
    slug: "peter",
    name: "Peter",
    nameInstrumental: "Petrom",
    title: "Peter",
    description:
      "AI simulácia vzdelávacieho rozhovoru. Nie je diagnostický ani medicínsky nástroj.",
    quote: "O niektorých veciach sa mne osobne hovorí len veľmi ťažko.",
    ctaLabel: "Porozprávať sa s Petrom",
    // Placeholder — do not invent production IDs
    avatarId: peterAvatarId,
    contextId: peterContextId,
    voiceId: peterVoiceId || undefined,
    image: "/ldz/avatars/peter.jpg",
    nameImage: "/ldz/avatars/name-peter.png",
    aspect: "9:16",
    available: Boolean(peterAvatarId),
    label: "AI simulácia",
    openingText:
      "Ahoj, volám sa Peter, mám 45 rokov a poslednú dobu rozmýšľam nad zmenou práce. Prestala mi dávať zmysel, ale neviem si predstaviť nájsť si niečo lepšie. Situácia je zlá. Zvykol som športovať, ale teraz radšej iba pozerám telku.",
    questionLimit: 4,
    questionLimitMessage:
      "Toto je už štvrtá otázka. Na ďalšie otázky ti rád odpoviem na kurze Prvá pomoc pre dušu.",
    questionLimitFollowupMessage:
      "Na ďalšie otázky ti rád odpoviem na kurze prvej pomoci pre dušu.",
    english: peterContextIdEn
      ? {
          contextId: peterContextIdEn,
          voiceId: peterVoiceIdEn || undefined,
          ctaLabel: "Talk in English",
          openingText:
            "Hi, my name is Peter, I'm 45, and lately I've been thinking about changing jobs. It stopped making sense to me, but I can't imagine finding something better. The situation is bad. I used to work out, but now I'd rather just watch TV.",
          questionLimitMessage:
            "That's already the fourth question. I'm happy to answer more on the First Aid for the Soul course.",
          questionLimitFollowupMessage:
            "I'm happy to answer more questions on the First Aid for the Soul course.",
        }
      : undefined,
  },
  {
    id: "tomas",
    slug: "tomas",
    name: "Tomáš",
    nameInstrumental: "Tomášom",
    title: "Tomáš",
    description:
      "AI simulácia vzdelávacieho rozhovoru. Nie je diagnostický ani medicínsky nástroj.",
    quote: "Najťažšie je vysvetliť ostatným, čo sa deje vo vašej hlave.",
    ctaLabel: "Porozprávať sa s Tomášom",
    avatarId: tomasAvatarId,
    contextId: tomasContextId,
    voiceId: tomasVoiceId || undefined,
    image: "/ldz/avatars/tomas.jpg",
    nameImage: "/ldz/avatars/name-tomas.png",
    aspect: "9:16",
    available: Boolean(tomasAvatarId),
    label: "AI simulácia",
    openingText:
      "Ahoj, volám sa Tomáš, mám 22 rokov a študujem informatiku. Popri tom už pracujem vo firme. Mám rád svoju prácu, lebo si môžem robiť svoje a nemusím sa baviť s druhými. Čoskoro ma čaká prezentovanie mojej práce pred kolegami. Nemôžem kvôli tomu spať.",
    questionLimit: 4,
    questionLimitMessage:
      "Toto je už štvrtá otázka. Na ďalšie otázky ti rád odpoviem na kurze Prvá pomoc pre dušu.",
    questionLimitFollowupMessage:
      "Na ďalšie otázky ti rád odpoviem na kurze prvej pomoci pre dušu.",
  },
  {
    id: "scenario-4",
    slug: "scenario-4",
    name: "Scenár 4",
    nameInstrumental: "Scenárom 4",
    title: "Scenár 4",
    description: "Pripravené miesto pre ďalší avatarový scenár.",
    quote: "",
    ctaLabel: "Čoskoro",
    avatarId: "",
    contextId: "",
    aspect: "9:16",
    available: false,
    label: "AI simulácia",
  },
  {
    id: "scenario-5",
    slug: "scenario-5",
    name: "Scenár 5",
    nameInstrumental: "Scenárom 5",
    title: "Scenár 5",
    description: "Pripravené miesto pre ďalší avatarový scenár.",
    quote: "",
    ctaLabel: "Čoskoro",
    avatarId: "",
    contextId: "",
    aspect: "9:16",
    available: false,
    label: "AI simulácia",
  },
];

/** Scenarios shown on the public microsite (DOCX lists three named avatars). */
export const PUBLIC_AVATAR_SCENARIOS = AVATAR_SCENARIOS.filter((s) =>
  ["eva", "peter", "tomas"].includes(s.id)
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
  };
}
