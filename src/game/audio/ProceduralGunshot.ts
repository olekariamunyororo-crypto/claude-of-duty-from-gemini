export interface ShotOpts {
  gain: number;
  pan: number;
  dist: number;
  cutoff: number;
  body: number;
  bright: number;
  dur: number;
  crack: number;
  mech: number;
  tail: number;
  noise: AudioBuffer;
}

/**
 * 6-layer procedural gunshot synthesis:
 *   a. Pre-transient impulse crack (<1ms attack, 2ms decay)
 *   b. Blast body with downward frequency sweep & sub thump (30-60ms)
 *   c. Supersonic ballistic shockwave crack (delayed 8ms, highpassed >3kHz, dropped >25m)
 *   d. Mechanical bolt clack (sawtooth burst bandpassed 800-1400Hz, dropped >40m)
 *   e. Room tail (noise LP filtered at 3kHz with exponential decay)
 *   f. Shared convolver reverb routing
 */
export function playShotLayer(
  ctx: AudioContext,
  out: AudioNode,
  convolver: ConvolverNode | null,
  opts: ShotOpts,
): void {
  const t = ctx.currentTime;
  const dist = opts.dist;

  // Per-shot variations: ±4% pitch, ±10% gain (no object allocation)
  const pitchMod = 1.0 + (Math.random() * 0.08 - 0.04);
  const gainMod = 1.0 + (Math.random() * 0.20 - 0.10);
  const shotGain = opts.gain * gainMod;

  // Direct blast bus: distance cutoff filter -> master gain -> stereo panner -> out
  const distFilter = ctx.createBiquadFilter();
  distFilter.type = 'lowpass';
  distFilter.frequency.setValueAtTime(opts.cutoff, t);

  const master = ctx.createGain();
  master.gain.setValueAtTime(shotGain, t);

  const panner = ctx.createStereoPanner();
  panner.pan.setValueAtTime(opts.pan, t);

  distFilter.connect(master).connect(panner).connect(out);

  // ---- a. PRE-TRANSIENT (0.5–2 ms) ----
  // Single-cycle impulse crack: fast ramp to 1 in <1 ms, down to 0 in 2 ms.
  // Audible at close/mid range; drops out at dist > 38 m.
  if (dist < 38) {
    const preOsc = ctx.createOscillator();
    preOsc.type = 'triangle';
    preOsc.frequency.setValueAtTime(opts.bright * pitchMod, t);

    const preEnv = ctx.createGain();
    const preDistMult = Math.max(0, 1 - dist / 38);
    preEnv.gain.setValueAtTime(0.0001, t);
    preEnv.gain.linearRampToValueAtTime(1.0 * preDistMult, t + 0.0007);
    preEnv.gain.exponentialRampToValueAtTime(0.0001, t + 0.0025);

    preOsc.connect(preEnv).connect(distFilter);
    preOsc.start(t);
    preOsc.stop(t + 0.0035);
  }

  // ---- b. BLAST BODY (30–60 ms) ----
  // Bandpassed noise sweeping downward in center frequency + sub thump for physical punch.
  // Always audible (remains audible at 40m+ with distance attenuation).
  {
    const durB = Math.max(0.035, Math.min(0.065, opts.dur * 0.38));
    const srcB = ctx.createBufferSource();
    srcB.buffer = opts.noise;
    srcB.playbackRate.setValueAtTime(pitchMod, t);

    const filterB = ctx.createBiquadFilter();
    filterB.type = 'bandpass';
    filterB.Q.setValueAtTime(0.7, t);

    const startFreqB = Math.max(1600, opts.bright * 1.6) * pitchMod;
    const endFreqB = Math.max(220, opts.body * 2.2) * pitchMod;

    filterB.frequency.setValueAtTime(startFreqB, t);
    filterB.frequency.exponentialRampToValueAtTime(Math.max(60, endFreqB), t + durB);

    const envB = ctx.createGain();
    envB.gain.setValueAtTime(0.0001, t);
    envB.gain.linearRampToValueAtTime(1.0, t + 0.002);
    envB.gain.exponentialRampToValueAtTime(0.001, t + durB);

    srcB.connect(filterB).connect(envB).connect(distFilter);
    srcB.start(t);
    srcB.stop(t + durB + 0.01);

    // Sub thump to reinforce physical displacement
    const oscThump = ctx.createOscillator();
    oscThump.type = 'triangle';
    const thumpStart = opts.body * pitchMod;
    oscThump.frequency.setValueAtTime(thumpStart, t);
    oscThump.frequency.exponentialRampToValueAtTime(Math.max(35, thumpStart * 0.35), t + 0.06);

    const envThump = ctx.createGain();
    envThump.gain.setValueAtTime(0.75, t);
    envThump.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

    oscThump.connect(envThump).connect(distFilter);
    oscThump.start(t);
    oscThump.stop(t + 0.085);
  }

  // ---- c. SUPERSONIC CRACK (3–8 ms, delayed 8 ms) ----
  // Secondary ballistic shockwave transient, highpassed > 3000 Hz.
  // Skipped entirely when dist > 25 m; drops out faster than body.
  if (dist <= 25) {
    const tCrack = t + 0.008; // 8 ms delayed arrival
    const crackDur = 0.005;   // 5 ms duration
    const srcC = ctx.createBufferSource();
    srcC.buffer = opts.noise;
    srcC.playbackRate.setValueAtTime(1.15 * pitchMod, tCrack);

    const filterC = ctx.createBiquadFilter();
    filterC.type = 'highpass';
    filterC.frequency.setValueAtTime(opts.crack * pitchMod, tCrack);

    // Crack drops out aggressively as distance increases toward 25m
    const crackAtten = Math.max(0, 1 - Math.pow(dist / 25, 1.4));
    const envC = ctx.createGain();
    envC.gain.setValueAtTime(0.0001, tCrack);
    envC.gain.linearRampToValueAtTime(0.85 * crackAtten, tCrack + 0.0008);
    envC.gain.exponentialRampToValueAtTime(0.0001, tCrack + crackDur);

    srcC.connect(filterC).connect(envC).connect(distFilter);
    srcC.start(tCrack);
    srcC.stop(tCrack + crackDur + 0.005);
  }

  // ---- d. MECHANICAL CLACK (20–40 ms) ----
  // Sawtooth bolt cycling burst through 800–1400 Hz bandpass at 20% level.
  // Skipped/silent beyond 38 m.
  if (dist < 38) {
    const durD = 0.028; // 28 ms bolt travel
    const oscD = ctx.createOscillator();
    oscD.type = 'sawtooth';
    oscD.frequency.setValueAtTime(opts.mech * pitchMod, t);

    const filterD = ctx.createBiquadFilter();
    filterD.type = 'bandpass';
    filterD.frequency.setValueAtTime(opts.mech * pitchMod, t);
    filterD.Q.setValueAtTime(2.2, t);

    const mechDistMult = Math.max(0, 1 - dist / 38);
    const envD = ctx.createGain();
    const peakMech = 0.20 * mechDistMult; // 20% of blast body
    envD.gain.setValueAtTime(0.0001, t);
    envD.gain.linearRampToValueAtTime(peakMech, t + 0.002);
    envD.gain.exponentialRampToValueAtTime(0.0001, t + durD);

    oscD.connect(filterD).connect(envD).connect(distFilter);
    oscD.start(t);
    oscD.stop(t + durD + 0.005);
  }

  // ---- e. ROOM TAIL (200–600 ms) & f. CONVOLVER REVERB ROUTING ----
  // Lowpass filtered noise tail convolved with the yacht's procedural impulse response.
  // Remains audible at 40m+ as environmental reflection.
  {
    const srcE = ctx.createBufferSource();
    srcE.buffer = opts.noise;
    srcE.playbackRate.setValueAtTime(0.95 * pitchMod, t);

    const filterE = ctx.createBiquadFilter();
    filterE.type = 'lowpass';
    filterE.frequency.setValueAtTime(Math.min(opts.cutoff, 3000), t);

    const tailDur = Math.max(0.2, Math.min(0.65, opts.tail));
    const envE = ctx.createGain();
    envE.gain.setValueAtTime(0.5, t);
    envE.gain.exponentialRampToValueAtTime(0.0001, t + tailDur);

    srcE.connect(filterE).connect(envE);
    srcE.start(t);
    srcE.stop(t + tailDur + 0.05);

    const tailGain = ctx.createGain();
    tailGain.gain.setValueAtTime(shotGain, t);
    envE.connect(tailGain);

    if (convolver) {
      const tailPanner = ctx.createStereoPanner();
      tailPanner.pan.setValueAtTime(opts.pan, t);
      tailGain.connect(tailPanner).connect(convolver);
    } else {
      tailGain.connect(panner);
    }
  }
}
