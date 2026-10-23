/**
 * Prefer the device media loudspeaker over the telephony earpiece.
 *
 * IMPORTANT (Safari / WebKit): never set audioSession to "playback" on a
 * page that also captures the mic. "playback" makes getUserMedia reject with
 * InvalidStateError: "AudioSession category is not compatible with audio capture"
 * and Safari will not show the permission dialog. Use "play-and-record".
 */
export function prepareAudioSessionForCall(): void {
  try {
    const nav = navigator as Navigator & {
      audioSession?: { type: string };
    };
    if (nav.audioSession) {
      nav.audioSession.type = "play-and-record";
    }
  } catch {
    /* unsupported */
  }
}

export async function preferMediaLoudspeaker(
  mediaEl?: HTMLMediaElement | null
): Promise<void> {
  prepareAudioSessionForCall();

  if (!mediaEl) return;

  const el = mediaEl as HTMLMediaElement & {
    setSinkId?: (id: string) => Promise<void>;
  };
  if (typeof el.setSinkId !== "function") return;
  if (!navigator.mediaDevices?.enumerateDevices) return;

  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const outputs = devices.filter((d) => d.kind === "audiooutput");
    if (outputs.length === 0) {
      await el.setSinkId("default");
      return;
    }

    const speaker = outputs.find((d) =>
      /speaker|loud|media|reproduktor|haut-parleur/i.test(d.label)
    );
    const notEarpiece = outputs.find(
      (d) =>
        d.deviceId &&
        d.deviceId !== "communications" &&
        !/earpiece|phone|communications|headset|slúchad|écouteur/i.test(d.label)
    );

    const target = speaker?.deviceId || notEarpiece?.deviceId || "default";
    await el.setSinkId(target);
  } catch {
    /* permission / sink switch unsupported — best effort */
  }
}
