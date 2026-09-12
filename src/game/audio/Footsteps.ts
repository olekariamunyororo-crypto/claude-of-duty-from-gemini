export type StepKind = 'deck' | 'metal' | 'water' | 'land';

export function playStep(ctx: AudioContext, out: AudioNode, noise: AudioBuffer, kind: StepKind): void {
  const t = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noise;
  src.playbackRate.value = 0.7 + Math.random() * 0.5;
  const f = ctx.createBiquadFilter();
  const g = ctx.createGain();
  if (kind === 'water') {
    f.type = 'bandpass'; f.frequency.value = 1400 + Math.random() * 800; f.Q.value = 0.8;
    g.gain.setValueAtTime(0.35, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
  } else if (kind === 'metal') {
    f.type = 'bandpass'; f.frequency.value = 900 + Math.random() * 500; f.Q.value = 2.5;
    g.gain.setValueAtTime(0.22, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
  } else if (kind === 'land') {
    f.type = 'lowpass'; f.frequency.value = 380;
    g.gain.setValueAtTime(0.55, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
  } else {
    f.type = 'lowpass'; f.frequency.value = 520 + Math.random() * 200;
    g.gain.setValueAtTime(0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
  }
  src.connect(f).connect(g).connect(out);
  src.start(t);
  src.stop(t + 0.3);
}
