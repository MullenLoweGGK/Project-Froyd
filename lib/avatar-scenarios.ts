export type AvatarScenario = {
  id: string;
  slug: string;
  name: string;
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
  label?: string;
  /** Portrait interaction as specified in content doc */
  aspect: "9:16";
  /** When false, launch CTA is disabled */
  available: boolean;
};

/**
 * Scenario configuration for the FROYD microsite.
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
    id: "eva",
    slug: "eva",
    name: "Eva",
    title: "Eva",
    description:
      "AI simulácia vzdelávacieho rozhovoru. Nie je diagnostický ani medicínsky nástroj.",
    quote: "Ľudia hovoria, že vyzerám nejaká unavená.",
    ctaLabel: "Porozprávať sa s Evou",
    avatarId: evaAvatarId,
    contextId: evaContextId,
    voiceId: evaVoiceId || undefined,
    image: "/ldz/avatars/eva.jpg",
    aspect: "9:16",
    available: Boolean(evaAvatarId),
    label: "AI simulácia",
  },
  {
    id: "peter",
    slug: "peter",
    name: "Peter",
    title: "Peter",
    description:
      "AI simulácia vzdelávacieho rozhovoru. Nie je diagnostický ani medicínsky nástroj.",
    quote: "Niektoré veci sa hovoria veľmi ťažko.",
    ctaLabel: "Porozprávať sa s Petrom",
    // Placeholder — do not invent production IDs
    avatarId: peterAvatarId,
    contextId: peterContextId,
    voiceId: peterVoiceId || undefined,
    image: "/ldz/avatars/peter.jpg",
    aspect: "9:16",
    available: Boolean(peterAvatarId),
    label: "AI simulácia",
  },
  {
    id: "tomas",
    slug: "tomas",
    name: "Tomáš",
    title: "Tomáš",
    description:
      "AI simulácia vzdelávacieho rozhovoru. Nie je diagnostický ani medicínsky nástroj.",
    quote: "Najťažšie je vysvetliť ostatným, čo sa deje vo vašej hlave.",
    ctaLabel: "Porozprávať sa s Tomášom",
    avatarId: tomasAvatarId,
    contextId: tomasContextId,
    voiceId: tomasVoiceId || undefined,
    image: "/ldz/avatars/tomas.jpg",
    aspect: "9:16",
    available: Boolean(tomasAvatarId),
    label: "AI simulácia",
  },
  {
    id: "scenario-4",
    slug: "scenario-4",
    name: "Scenár 4",
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
