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
 * Eva uses the existing public env defaults (the currently working avatar).
 * Remaining scenarios are explicit placeholders until IDs are provided.
 * Five slots are reserved for future expansion.
 */
const envAvatarId = process.env.NEXT_PUBLIC_DEFAULT_AVATAR_ID ?? "";
const envContextId = process.env.NEXT_PUBLIC_DEFAULT_CONTEXT_ID ?? "";
const envVoiceId = process.env.NEXT_PUBLIC_DEFAULT_VOICE_ID ?? "";

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
    avatarId: envAvatarId,
    contextId: envContextId,
    voiceId: envVoiceId || undefined,
    image: "/ldz/avatars/eva.jpg",
    aspect: "9:16",
    available: Boolean(envAvatarId),
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
    avatarId: process.env.NEXT_PUBLIC_PETER_AVATAR_ID ?? "",
    contextId: process.env.NEXT_PUBLIC_PETER_CONTEXT_ID ?? "",
    voiceId: process.env.NEXT_PUBLIC_PETER_VOICE_ID || undefined,
    image: "/ldz/avatars/peter.jpg",
    aspect: "9:16",
    available: Boolean(process.env.NEXT_PUBLIC_PETER_AVATAR_ID),
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
    avatarId: process.env.NEXT_PUBLIC_TOMAS_AVATAR_ID ?? "",
    contextId: process.env.NEXT_PUBLIC_TOMAS_CONTEXT_ID ?? "",
    voiceId: process.env.NEXT_PUBLIC_TOMAS_VOICE_ID || undefined,
    image: "/ldz/avatars/tomas.jpg",
    aspect: "9:16",
    available: Boolean(process.env.NEXT_PUBLIC_TOMAS_AVATAR_ID),
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
