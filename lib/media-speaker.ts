/**
 * Prefer the device media loudspeaker over the telephony earpiece.
 *
 * On Android, WebRTC + mic often switches AudioManager into communication
 * mode and routes remote audio to the top "call" speaker. Where the platform
 * allows it, we declare a media playback session and pin the element sink to
 * a speaker-like output.
 */
export async function preferMediaLoudspeaker(
  mediaEl?: HTMLMediaElement | null
): Promise<void> {
  try {
    const nav = navigator as Navigator & {
      audioSession?: { type: string };
    };
    // "playback" → media/speaker path. "play-and-record" often uses earpiece.
    if (nav.audioSession) {
      nav.audioSession.type = "playback";
    }
  } catch {
    /* unsupported */
  }

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
