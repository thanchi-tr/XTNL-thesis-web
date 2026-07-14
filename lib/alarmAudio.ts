"use client";

/**
 * Singleton AudioContext for XTNL alarm sounds.
 *
 * Chrome's autoplay policy suspends a new AudioContext() the moment it is
 * created in a background or minimised tab — oscillators produce no output.
 *
 * Fix:
 *   1. Keep one AudioContext alive for the lifetime of the page.
 *   2. Call unlockAudio() from any user gesture so Chrome marks the context
 *      as "user-gesture allowed".
 *   3. Call ctx.resume() before every play — Chrome permits this from code
 *      even in a background / minimised tab once the context has been
 *      unlocked by at least one prior user gesture.
 */

let _ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!_ctx || _ctx.state === "closed") _ctx = new AudioContext();
  return _ctx;
}

/**
 * Pre-unlock the AudioContext.
 * Call this on any user click / keydown so a future playAlarmBeeps() can
 * resume the context from a background tab without requiring a new gesture.
 */
export function unlockAudio(): void {
  if (typeof window === "undefined") return;
  try {
    const ctx = getCtx();
    // A zero-length silent buffer fully activates the context under Chrome's
    // autoplay policy while costing nothing audible.
    const buf = ctx.createBuffer(1, 1, 22_050);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.start(0);
    if (ctx.state !== "running") ctx.resume().catch(() => {});
  } catch { /* ignore */ }
}

/**
 * Play the XTNL 9-note focus-window alarm.
 * Works from background / minimised tabs as long as unlockAudio() was called
 * at least once during a prior user gesture in the same browsing session.
 */
export function playAlarmBeeps(volume: number): void {
  if (volume <= 0 || typeof window === "undefined") return;
  try {
    const ctx = getCtx();

    const doPlay = () => {
      const dest = ctx.destination;
      const v    = Math.min(1, Math.max(0, volume));
      const now  = ctx.currentTime;
      const tone = (t: number, freq: number, dur: number, rel = 1.0) => {
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(dest);
        osc.type = "sawtooth";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(v * rel, t + 0.008);
        gain.gain.setValueAtTime(v * rel, t + dur - 0.03);
        gain.gain.linearRampToValueAtTime(0, t + dur);
        osc.start(t); osc.stop(t + dur + 0.01);
      };
      tone(now,        1320, 0.08, 0.55);
      tone(now + 0.11, 1320, 0.08, 0.55);
      tone(now + 0.28, 1760, 0.22, 0.65);
      tone(now + 0.70, 1320, 0.08, 0.60);
      tone(now + 0.81, 1320, 0.08, 0.60);
      tone(now + 0.98, 1760, 0.22, 0.70);
      tone(now + 1.40, 1320, 0.08, 0.65);
      tone(now + 1.51, 1320, 0.08, 0.65);
      tone(now + 1.68, 1760, 0.36, 0.75);
    };

    // If already running, play immediately.
    // Otherwise resume() first — Chrome allows this without a new gesture if
    // the context was previously unlocked by unlockAudio().
    if (ctx.state === "running") {
      doPlay();
    } else {
      ctx.resume().then(doPlay).catch(() => {});
    }
  } catch { /* AudioContext unavailable */ }
}
