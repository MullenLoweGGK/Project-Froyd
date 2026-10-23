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

const sk: ModalCopy = {
  title: (nameInstrumental) => `Rozhovor s ${nameInstrumental}`,
  close: "Zavrieť",
  closeAria: "Zavrieť rozhovor",
  idleHint: "Maximálny čas rozhovoru je 10 minút.",
  readyTitle: "Predtým než začnete",
  readyCopy:
    "Nastavte si hlasitosť. Po štarte avatar krátko pozdraví — potom sa prihovorte vy.",
  readyEmphasis: "Počkajte, kým dohovorí, a až potom pokračujte.",
  readyMicHint:
    "Ťuknite na „Začať rozhovor hneď“ a povoľte mikrofón, keď vás prehliadač vyzve.",
  preparingTitle: "Pripravujeme zvuk…",
  preparingCopy: "Ešte chvíľu.",
  questionLimitStatus: "Limit otázok — rozhovor môžete ukončiť",
  micOn: " · Mikrofón zapnutý",
  micOff: " · Mikrofón stlmený",
  start: "Spustiť rozhovor",
  startNow: "Začať rozhovor hneď",
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
  idleHint: "Maximum conversation time is 10 minutes.",
  readyTitle: "Before you start",
  readyCopy:
    "Set your volume. After start the avatar says a short hello — then you speak.",
  readyEmphasis: "Wait until they finish before continuing.",
  readyMicHint:
    "Tap “Start conversation now” and allow the microphone when the browser asks.",
  preparingTitle: "Preparing audio…",
  preparingCopy: "One moment.",
  questionLimitStatus: "Question limit — you can end the conversation",
  micOn: " · Microphone on",
  micOff: " · Microphone muted",
  start: "Start conversation",
  startNow: "Start conversation now",
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
