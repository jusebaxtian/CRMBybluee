// Synthesizes a short two-tone "ding" via the Web Audio API — no external
// audio file to host, and it sidesteps browser autoplay restrictions better
// than <audio>, since it's triggered directly from a user-initiated context
// (the realtime event still requires a prior user gesture on the page, which
// logging in / clicking around already provides). Shared by the inbound
// WhatsApp message sound and the platform notification sound, so both use
// the exact same "new item" chime.
export function playChime(ctx: AudioContext) {
  const now = ctx.currentTime;
  const notes: [number, number][] = [
    [880, now],
    [1174.66, now + 0.09],
  ];

  for (const [freq, start] of notes) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.2, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.4);
  }
}
