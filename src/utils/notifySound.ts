let ctx: AudioContext | null = null;

function getContext(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

/**
 * Short two-tone chime — alerts kitchen/expedite staff that a new order just
 * arrived, without needing an audio file asset. Web Audio API only; if it's
 * unavailable or blocked (e.g. autoplay policy before any user gesture) this
 * silently no-ops — the on-screen list still updates either way.
 */
export function playOrderAlert() {
  try {
    const audioCtx = getContext();
    if (audioCtx.state === "suspended") audioCtx.resume();
    const now = audioCtx.currentTime;
    [880, 1108].forEach((freq, i) => {
      const start = now + i * 0.18;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.3, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(start);
      osc.stop(start + 0.18);
    });
  } catch {
    // Ignore — visual update is the source of truth, sound is a bonus.
  }
}
