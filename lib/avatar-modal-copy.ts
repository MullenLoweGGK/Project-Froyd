import type { AppStatus } from "@/lib/types";
import type { ConversationLanguage } from "@/lib/avatar-scenarios";

type ModalCopy = {
  title: (nameInstrumental: string, name: string) => string;
  close: string;
  closeAria: string;
  idleHint: string;
  readyTitle: string;
  readyCopy: string;
  readyEmphasis: string;
  readyMicHint: string;
  preparingTitle: string;
  preparingCopy: string;
  questionLimitStatus: string;
  micOn: string;
  micOff: string;
  start: string;
  startNow: string;
  allowMicAndStart: string;
  end: string;
  endSession: string;
  unmute: string;
  mute: string;
  status: (status: AppStatus) => string;
};

/** Courses / PPDZ copy — participant speaks first, 10 min, no scripted intro. */
const sk: ModalCopy = {
  title: (nameInstrumental) => `Rozhovor s ${nameInstrumental}`,
  close: "Zavrieť",
  closeAria: "Zavrieť rozhovor",
  idleHint:
    "Po spustení sa prihovorte avatarovi ako prví. Maximálny čas rozhovoru je 10 minút.",
  readyTitle: "Predtým než začnete",
  readyCopy:
    "Nastavte si hlasitosť zariadenia, aby ste avatara zreteľne počuli. Po štarte sa prihovorte vy — avatar sa sám nepredstaví.",
  readyEmphasis:
    "Hovorte prirodzene, ako na kurze. Počkajte, kým avatar dohovorí, a až potom pokračujte.",
  readyMicHint:
    "Kliknite na tlačidlo nižšie. Ak prehliadač vypýta prístup k mikrofónu, povoľte ho a potom začnite hovoriť.",
  preparingTitle: "Pripravujeme mikrofón…",
  preparingCopy: "Ešte chvíľu — zapíname počúvanie.",
  questionLimitStatus: "Limit otázok — rozhovor môžete ukončiť",
  micOn: " · Mikrofón zapnutý",
  micOff: " · Mikrofón stlmený",
  start: "Spustiť rozhovor",
  startNow: "Začať rozhovor",
  allowMicAndStart: "Povoliť mikrofón a začať",
  end: "Ukončiť",
  endSession: "Ukončiť rozhovor",
  unmute: "Zapnúť mikrofón",
  mute: "Stlmiť mikrofón",
  status: (status) => {
    switch (status) {
      case "creating-session":
      case "connecting":
        return "Pripravujeme avatara…";
      case "awaiting-ready":
        return "Predtým než začnete";
      case "ready":
        return "Teraz môžete hovoriť";
      case "user-speaking":
        return "Počúvame vás…";
      case "avatar-speaking":
        return "Avatar hovorí — počkajte, kým dohovorí";
      case "stopping":
        return "Ukončujeme rozhovor…";
      case "stopped":
        return "Rozhovor ukončený";
      case "disconnected":
        return "Odpojené";
      case "error":
        return "Nepodarilo sa spojiť";
      default:
        return "Pripravené na spustenie";
    }
  },
};

const en: ModalCopy = {
  title: (_nameInstrumental, name) => `Conversation with ${name}`,
  close: "Close",
  closeAria: "Close conversation",
  idleHint:
    "After starting, speak to the avatar first. Maximum conversation time is 10 minutes.",
  readyTitle: "Before you start",
  readyCopy:
    "Set your device volume so you can hear the avatar clearly. After you start, you speak first — the avatar will not introduce themselves.",
  readyEmphasis:
    "Speak naturally. Wait until the avatar finishes before continuing.",
  readyMicHint:
    "Click the button below. If the browser asks for microphone access, allow it, then start speaking.",
  preparingTitle: "Preparing microphone…",
  preparingCopy: "One moment — enabling listening.",
  questionLimitStatus: "Question limit — you can end the conversation",
  micOn: " · Microphone on",
  micOff: " · Microphone muted",
  start: "Start conversation",
  startNow: "Start conversation",
  allowMicAndStart: "Allow microphone and start",
  end: "End",
  endSession: "End conversation",
  unmute: "Unmute microphone",
  mute: "Mute microphone",
  status: (status) => {
    switch (status) {
      case "creating-session":
      case "connecting":
        return "Preparing the avatar…";
      case "awaiting-ready":
        return "Before you start";
      case "ready":
        return "You can speak now";
      case "user-speaking":
        return "Listening…";
      case "avatar-speaking":
        return "Avatar is speaking — wait until they finish";
      case "stopping":
        return "Ending conversation…";
      case "stopped":
        return "Conversation ended";
      case "disconnected":
        return "Disconnected";
      case "error":
        return "Could not connect";
      default:
        return "Ready to start";
    }
  },
};

export function getAvatarModalCopy(language: ConversationLanguage): ModalCopy {
  return language === "en" ? en : sk;
}
