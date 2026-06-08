/** A short two-note "success" chime via Web Audio. No asset; safe no-op when AudioContext is missing. */
export function playChime(): void {
  const AC = (globalThis as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext })
    .AudioContext ?? (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return;
  try {
    // Real AudioContext is a constructor; some environments (and test mocks)
    // expose it as a plain factory that throws on `new` — fall back to a call.
    let ctx: AudioContext;
    try {
      ctx = new AC();
    } catch {
      ctx = (AC as unknown as () => AudioContext)();
    }
    const notes = [660, 880];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      const t = ctx.currentTime + i * 0.09;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(t); osc.stop(t + 0.24);
    });
    setTimeout(() => ctx.close?.(), 600);
  } catch { /* audio is nice-to-have; never throw into a reward moment */ }
}
