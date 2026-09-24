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
  idleHint:
    "Najprv si vypočujte predstavenie avatara. Hovorte až keď dohovorí. Maximálny čas rozhovoru je 120 sekúnd.",
  readyTitle: "Predtým než začnete",
  readyCopy:
    "Nastavte si hlasitosť vášho zariadenia aby ste avatara zreteľne počuli. Po pripojení začne avatar svoje predstavenie — vypočujte si ho pozorne až do konca.",
  readyEmphasis:
    "Neskáčte avatarovi do reči. Ak začnete hovoriť skôr než dohovorí, začne vás okamžite počúvať a hneď odpovie na vašu otázku a predošlú odpoveď predčasne ukončí.",
  readyMicHint:
    "Ťuknite na „Začať rozhovor hneď“ a povoľte mikrofón, keď vás iPhone vyzve.",
  preparingTitle: "Pripravujeme zvuk…",
  preparingCopy: "Hneď začne predstavenie. Pripravte sa počúvať.",
  questionLimitStatus: "Limit otázok — ďalšie na kurze Prvá pomoc pre dušu",
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
  idleHint:
    "First listen to the avatar’s introduction. Speak only after they finish. Maximum conversation time is 120 seconds.",
  readyTitle: "Before you start",
  readyCopy:
    "Set your device volume so you can hear the avatar clearly. After connecting, the avatar will introduce themselves — listen carefully until the end.",
  readyEmphasis:
    "Don’t interrupt the avatar. If you start speaking before they finish, they will listen immediately, answer your question, and cut off the previous reply.",
  readyMicHint:
    "Tap “Start conversation now” and allow the microphone when your phone asks.",
  preparingTitle: "Preparing audio…",
  preparingCopy: "The introduction will start shortly. Get ready to listen.",
  questionLimitStatus:
    "Question limit — more on the First Aid for the Soul course",
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
