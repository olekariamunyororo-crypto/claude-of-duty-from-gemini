import { atten, distCutoff, type Listener } from './Attenuation';
import { playShotLayer, type ShotOpts } from './ProceduralGunshot';
import { playStep, type StepKind } from './Footsteps';
import * as THREE from 'three';

// Pre-allocated scratch object for zero-allocation shot calls
const shotScratch: ShotOpts = {
  gain: 1,
  pan: 0,
  dist: 0,
  cutoff: 9000,
  body: 170,
  bright: 1300,
  dur: 0.14,
  crack: 3400,
  mech: 1100,
  tail: 0.45,
  noise: null as unknown as AudioBuffer,
};

// Fixed frequency & voicing tables for the 4-bar ambient loop (Cmaj7 -> Am7 -> Fmaj7 -> G6)
// Voiced smoothly across octaves 1-4 with delicate detuning for lush analog chorus.
const AMBIENT_BPM = 54;
const AMBIENT_BEAT_SEC = 60 / AMBIENT_BPM; // ~1.111 s
const AMBIENT_BEAT_MS = AMBIENT_BEAT_SEC * 1000;

const CHORD_SUBS: readonly number[] = [65.41, 55.0, 43.65, 49.0]; // C2, A1, F1, G1
const CHORD_PADS: readonly (readonly number[])[] = [
  [130.81, 196.0, 246.94, 329.63], // Cmaj7: C3, G3, B3, E4
  [110.0, 164.81, 196.0, 261.63], // Am7:   A2, E3, G3, C4
  [130.81, 174.61, 220.0, 329.63], // Fmaj7: C3, F3, A3, E4
  [146.83, 196.0, 246.94, 329.63], // G6:    D3, G3, B3, E4
];
const PAD_DETUNES: readonly number[] = [-4, 3, -2, 5];
const PAD_TYPES: readonly OscillatorType[] = ['sine', 'triangle', 'sine', 'triangle'];
const PAD_GAINS: readonly number[] = [0.065, 0.06, 0.055, 0.05];

// Sparse pentatonic bell melody (C major pentatonic: G4, A4, C5, D5, E5, G5)
// 32-step grid across 4 bars (8 beats each). 0 indicates silence/rest on that beat.
const MELODY_STEPS: readonly number[] = [
  // Bar 0: Cmaj7 (2 bells on off-beats 2 and 5)
  0, 0, 659.25, 0, 0, 783.99, 0, 0,
  // Bar 1: Am7 (3 bells on off-beats 2, 5, 6)
  0, 0, 587.33, 0, 0, 523.25, 440.0, 0,
  // Bar 2: Fmaj7 (2 bells on off-beats 2 and 5)
  0, 0, 523.25, 0, 0, 659.25, 0, 0,
  // Bar 3: G6 (2 bells on off-beats 2 and 5, followed by silence before loop wraps)
  0, 0, 587.33, 0, 0, 392.0, 0, 0,
];

/** Fully procedural audio engine. Zero audio files — everything is synthesis. */
class AudioEngineImpl {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  sfx: GainNode | null = null;
  musicBus: GainNode | null = null;
  ambBus: GainNode | null = null;
  noise: AudioBuffer | null = null;
  convolver: ConvolverNode | null = null;
  volume = 0.8;
  private musicTimer: number | null = null;
  private musicMaster: GainNode | null = null;
  private musicDelay: DelayNode | null = null;
  private musicFeedback: GainNode | null = null;
  private musicWet: GainNode | null = null;
  private musicOscs: OscillatorNode[] = [];
  private ambNodes: AudioNode[] = [];
  private gullTimer: number | null = null;
  private creakTimer: number | null = null;
  private hornTimer: number | null = null;

  unlock(): void {
    if (this.ctx) { if (this.ctx.state === 'suspended') void this.ctx.resume(); return; }
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(this.ctx.destination);
    this.sfx = this.ctx.createGain(); this.sfx.connect(this.master);
    this.musicBus = this.ctx.createGain(); this.musicBus.gain.value = 0.35; this.musicBus.connect(this.master);
    this.ambBus = this.ctx.createGain(); this.ambBus.gain.value = 0.5; this.ambBus.connect(this.master);
    // Shared noise buffer (2s white noise).
    const len = this.ctx.sampleRate * 2;
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    // Shared convolver reverb for environment room reflections (built once)
    this.convolver = this.ctx.createConvolver();
    this.convolver.normalize = true;
    this.convolver.buffer = this.buildImpulseResponse(0.6, 0.25);
    this.convolver.connect(this.sfx);
  }

  private buildImpulseResponse(duration = 0.6, decay = 0.25): AudioBuffer {
    const rate = this.ctx!.sampleRate;
    const len = Math.floor(rate * duration);
    const buf = this.ctx!.createBuffer(2, len, rate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) {
        const t = i / rate;
        const noise = Math.random() * 2 - 1;
        const sign = Math.random() < 0.5 ? 1 : -1;
        d[i] = noise * Math.exp(-t / decay) * sign;
      }
    }
    return buf;
  }

  setVolume(v: number): void {
    this.volume = v;
    if (this.master) this.master.gain.value = v;
  }

  private ok(): boolean { return !!this.ctx && !!this.sfx && !!this.noise; }

  // ---- weapons ----
  shot(def: {
    soundBody: number;
    soundBright: number;
    soundDur: number;
    soundCrack?: number;
    soundMech?: number;
    soundTail?: number;
  }, dist = 0, pan = 0): void {
    if (!this.ok()) return;
    shotScratch.gain = Math.min(1, 1 / (1 + dist * 0.05)) * 0.9;
    shotScratch.pan = pan;
    shotScratch.dist = dist;
    shotScratch.cutoff = distCutoff(dist);
    shotScratch.body = def.soundBody;
    shotScratch.bright = def.soundBright;
    shotScratch.dur = def.soundDur;
    shotScratch.crack = def.soundCrack ?? 3200;
    shotScratch.mech = def.soundMech ?? 1100;
    shotScratch.tail = def.soundTail ?? 0.45;
    shotScratch.noise = this.noise!;

    playShotLayer(this.ctx!, this.sfx!, this.convolver, shotScratch);
  }

  dryClick(): void { this.tick(2600, 0.03, 0.15); }
  tick(freq: number, dur: number, gain: number, type: OscillatorType = 'square'): void {
    if (!this.ok()) return;
    const t = this.ctx!.currentTime;
    const o = this.ctx!.createOscillator();
    o.type = type; o.frequency.value = freq;
    const g = this.ctx!.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.sfx!);
    o.start(t); o.stop(t + dur + 0.02);
  }

  reloadStage(stage: 0 | 1 | 2): void {
    if (stage === 0) this.tick(1400, 0.05, 0.2);
    if (stage === 1) this.tick(700, 0.07, 0.25, 'triangle');
    if (stage === 2) { this.tick(1100, 0.04, 0.2); setTimeout(() => this.tick(1600, 0.05, 0.22), 60); }
  }

  // ---- feedback ----
  hitmarker(head: boolean, kill: boolean): void {
    this.tick(head ? 2400 : 1900, 0.035, 0.22);
    if (kill) {
      const notes = [880, 1174, 1568];
      notes.forEach((n, i) => setTimeout(() => this.tick(n, 0.09, 0.25, 'triangle'), i * 70));
    }
  }

  hurt(): void {
    if (!this.ok()) return;
    const t = this.ctx!.currentTime;
    const o = this.ctx!.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(160, t);
    o.frequency.exponentialRampToValueAtTime(60, t + 0.12);
    const g = this.ctx!.createGain();
    g.gain.setValueAtTime(0.4, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    o.connect(g).connect(this.sfx!);
    o.start(t); o.stop(t + 0.16);
  }

  step(kind: StepKind): void {
    if (this.ok()) playStep(this.ctx!, this.sfx!, this.noise!, kind);
  }

  splash(dist = 0): void {
    if (!this.ok()) return;
    const t = this.ctx!.currentTime;
    const src = this.ctx!.createBufferSource();
    src.buffer = this.noise!;
    const f = this.ctx!.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.setValueAtTime(1800, t);
    f.frequency.exponentialRampToValueAtTime(500, t + 0.35); f.Q.value = 0.6;
    const g = this.ctx!.createGain();
    g.gain.setValueAtTime(Math.min(0.7, 0.7 / (1 + dist * 0.1)), t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    src.connect(f).connect(g).connect(this.sfx!);
    src.start(t); src.stop(t + 0.45);
  }

  explosion(dist: number, pan: number): void {
    if (!this.ok()) return;
    const ctx = this.ctx!, t = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.value = Math.min(1, 1.4 / (1 + dist * 0.05));
    const p = ctx.createStereoPanner(); p.pan.value = pan;
    master.connect(p).connect(this.sfx!);
    const src = ctx.createBufferSource();
    src.buffer = this.noise!;
    src.playbackRate.value = 0.5;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(3200, t);
    lp.frequency.exponentialRampToValueAtTime(90, t + 1.1);
    const g = ctx.createGain();
    g.gain.setValueAtTime(1, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.2);
    src.connect(lp).connect(g).connect(master);
    src.start(t); src.stop(t + 1.3);
    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(55, t);
    sub.frequency.exponentialRampToValueAtTime(28, t + 0.5);
    const sg = ctx.createGain();
    sg.gain.setValueAtTime(0.9, t);
    sg.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
    sub.connect(sg).connect(master);
    sub.start(t); sub.stop(t + 0.65);
  }

  throwNade(): void {
    if (!this.ok()) return;
    const t = this.ctx!.currentTime;
    const src = this.ctx!.createBufferSource();
    src.buffer = this.noise!;
    const f = this.ctx!.createBiquadFilter();
    f.type = 'bandpass'; f.Q.value = 2;
    f.frequency.setValueAtTime(400, t);
    f.frequency.exponentialRampToValueAtTime(1800, t + 0.18);
    const g = this.ctx!.createGain();
    g.gain.setValueAtTime(0.18, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    src.connect(f).connect(g).connect(this.sfx!);
    src.start(t); src.stop(t + 0.25);
  }

  sting(victory: boolean): void {
    const notes = victory ? [523, 659, 784, 1046] : [392, 330, 262, 196];
    notes.forEach((n, i) => setTimeout(() => this.tick(n, 0.22, 0.3, 'triangle'), i * 160));
  }

  // ---- ambience: ocean loop + wind layer + gulls + hull creak + distant boat horn ----
  ambienceOn(): void {
    if (!this.ok() || this.ambNodes.length) return;
    const ctx = this.ctx!;

    // 1. Ocean wash loop (lowpass noise + subtle swell LFO)
    const oceanSrc = ctx.createBufferSource();
    oceanSrc.buffer = this.noise!;
    oceanSrc.loop = true;
    const oceanLp = ctx.createBiquadFilter();
    oceanLp.type = 'lowpass';
    oceanLp.frequency.value = 420;
    const oceanGain = ctx.createGain();
    oceanGain.gain.value = 0.16;
    const oceanLfo = ctx.createOscillator();
    oceanLfo.frequency.value = 0.09;
    const oceanLfoGain = ctx.createGain();
    oceanLfoGain.gain.value = 0.09;
    oceanLfo.connect(oceanLfoGain).connect(oceanGain.gain);
    oceanSrc.connect(oceanLp).connect(oceanGain).connect(this.ambBus!);
    oceanSrc.start();
    oceanLfo.start();

    // 2. Wind layer: second noise source through high-pass at ~600Hz, LFO modulated gain (0.02 - 0.05)
    const windSrc = ctx.createBufferSource();
    windSrc.buffer = this.noise!;
    windSrc.loop = true;
    const windHp = ctx.createBiquadFilter();
    windHp.type = 'highpass';
    windHp.frequency.value = 600;
    const windGain = ctx.createGain();
    windGain.gain.value = 0.035; // centered between 0.02 and 0.05
    const windLfo = ctx.createOscillator();
    windLfo.frequency.value = 0.05; // ~0.05 Hz
    const windLfoGain = ctx.createGain();
    windLfoGain.gain.value = 0.015;
    windLfo.connect(windLfoGain).connect(windGain.gain);
    windSrc.connect(windHp).connect(windGain).connect(this.ambBus!);
    windSrc.start();
    windLfo.start();

    this.ambNodes = [oceanSrc, oceanLfo, windSrc, windLfo];

    // 3. Gull calls
    const gull = () => {
      if (!this.ctx || !this.ambNodes.length) return;
      const t = ctx.currentTime;
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(1900, t);
      o.frequency.exponentialRampToValueAtTime(900, t + 0.18);
      const og = ctx.createGain();
      og.gain.setValueAtTime(0.0001, t);
      og.gain.exponentialRampToValueAtTime(0.03, t + 0.03);
      og.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      o.connect(og).connect(this.ambBus!);
      o.start(t);
      o.stop(t + 0.25);
      this.gullTimer = window.setTimeout(gull, 7000 + Math.random() * 14000);
    };
    this.gullTimer = window.setTimeout(gull, 4000);

    // 4. Hull creak (every 25–60 s, noise burst through bandpass at ~180 Hz with 40 ms decay, gain <= 0.08)
    const creak = () => {
      if (!this.ctx || !this.ambNodes.length) return;
      const t = ctx.currentTime;
      const src = ctx.createBufferSource();
      src.buffer = this.noise!;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(180, t);
      bp.Q.value = 3.5;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.065, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
      src.connect(bp).connect(g).connect(this.ambBus!);
      src.start(t);
      src.stop(t + 0.045);
      this.creakTimer = window.setTimeout(creak, (25 + Math.random() * 35) * 1000);
    };
    this.creakTimer = window.setTimeout(creak, (18 + Math.random() * 20) * 1000);

    // 5. Distant boat horn (every 90–180 s, two detuned saw oscillators at 110Hz and 165Hz, filtered, 1.5s envelope, gain <= 0.04)
    const horn = () => {
      if (!this.ctx || !this.ambNodes.length) return;
      const t = ctx.currentTime;
      const o1 = ctx.createOscillator();
      const o2 = ctx.createOscillator();
      o1.type = 'sawtooth';
      o2.type = 'sawtooth';
      o1.frequency.setValueAtTime(110, t);
      o1.detune.setValueAtTime(-4, t);
      o2.frequency.setValueAtTime(165, t);
      o2.detune.setValueAtTime(4, t);

      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(520, t);

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.035, t + 0.25);
      g.gain.setValueAtTime(0.035, t + 1.15);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);

      o1.connect(lp);
      o2.connect(lp);
      lp.connect(g).connect(this.ambBus!);

      o1.start(t);
      o2.start(t);
      o1.stop(t + 1.55);
      o2.stop(t + 1.55);

      this.hornTimer = window.setTimeout(horn, (90 + Math.random() * 90) * 1000);
    };
    this.hornTimer = window.setTimeout(horn, (45 + Math.random() * 45) * 1000);
  }

  ambienceOff(): void {
    this.ambNodes.forEach((n) => {
      try { (n as AudioScheduledSourceNode).stop(); } catch { /* noop */ }
      try { n.disconnect(); } catch { /* noop */ }
    });
    this.ambNodes = [];
    if (this.gullTimer !== null) { clearTimeout(this.gullTimer); this.gullTimer = null; }
    if (this.creakTimer !== null) { clearTimeout(this.creakTimer); this.creakTimer = null; }
    if (this.hornTimer !== null) { clearTimeout(this.hornTimer); this.hornTimer = null; }
  }

  // ---- menu music: soothing ambient pad + sparse sine bells with feedback delay ----
  musicOn(): void {
    this.unlock();
    if (!this.ok() || this.musicTimer !== null) return;
    const ctx = this.ctx!;

    // Dedicated music submaster feeding the 0.35 musicBus. Allows clean 1.8s fadeout on stop.
    this.musicMaster = ctx.createGain();
    this.musicMaster.gain.setValueAtTime(1.0, ctx.currentTime);
    this.musicMaster.connect(this.musicBus!);

    // Reverb-like feedback delay (dotted-eighth note = 0.75 beat, 45% feedback, 35% wet)
    this.musicDelay = ctx.createDelay(2.0);
    this.musicDelay.delayTime.value = AMBIENT_BEAT_SEC * 0.75;

    const delayFilter = ctx.createBiquadFilter();
    delayFilter.type = 'lowpass';
    delayFilter.frequency.value = 2200; // Warm high-shelf dampening for ambient diffusion

    this.musicFeedback = ctx.createGain();
    this.musicFeedback.gain.value = 0.45;

    this.musicWet = ctx.createGain();
    this.musicWet.gain.value = 0.35;

    // Wet path to music master
    this.musicDelay.connect(this.musicWet).connect(this.musicMaster);

    // Filtered feedback loop back into delay line
    this.musicDelay.connect(delayFilter).connect(this.musicFeedback).connect(this.musicDelay);

    let step = 0;

    const play = () => {
      if (!this.ctx || !this.musicMaster || !this.musicDelay) return;
      const t = this.ctx.currentTime + 0.05;
      const beatInBar = step % 8;
      const bar = Math.floor(step / 8) % 4;

      // Every 8 beats (bar start): trigger warm sustained pad chord + sub bass
      if (beatInBar === 0) {
        const chordDur = AMBIENT_BEAT_SEC * 8;

        // Sub bass: barely audible triangle an octave below root (gain 0.032)
        const sub = this.ctx.createOscillator();
        sub.type = 'triangle';
        sub.frequency.value = CHORD_SUBS[bar];
        const subGain = this.ctx.createGain();
        subGain.gain.setValueAtTime(0.0001, t);
        subGain.gain.linearRampToValueAtTime(0.032, t + 1.8);
        subGain.gain.setValueAtTime(0.032, t + chordDur - 2.5);
        subGain.gain.exponentialRampToValueAtTime(0.0001, t + chordDur + 0.6);
        sub.connect(subGain).connect(this.musicMaster);
        sub.start(t);
        sub.stop(t + chordDur + 0.8);
        this.musicOscs.push(sub);
        sub.onended = () => {
          const idx = this.musicOscs.indexOf(sub);
          if (idx !== -1) this.musicOscs.splice(idx, 1);
        };

        // 4 pad voices: mixture of sine and triangle with subtle detune
        for (let v = 0; v < 4; v++) {
          const osc = this.ctx.createOscillator();
          osc.type = PAD_TYPES[v];
          osc.frequency.value = CHORD_PADS[bar][v];
          osc.detune.value = PAD_DETUNES[v];

          const vGain = this.ctx.createGain();
          const targetGain = PAD_GAINS[v];
          vGain.gain.setValueAtTime(0.0001, t);
          vGain.gain.linearRampToValueAtTime(targetGain, t + 1.6);
          vGain.gain.setValueAtTime(targetGain, t + chordDur - 2.4);
          vGain.gain.exponentialRampToValueAtTime(0.0001, t + chordDur + 0.7);

          // Feed BOTH dry master and wet delay path
          osc.connect(vGain);
          vGain.connect(this.musicMaster);
          vGain.connect(this.musicDelay);

          osc.start(t);
          osc.stop(t + chordDur + 0.9);
          this.musicOscs.push(osc);
          osc.onended = () => {
            const idx = this.musicOscs.indexOf(osc);
            if (idx !== -1) this.musicOscs.splice(idx, 1);
          };
        }
      }

      // Off-beat sparse pentatonic melody bell
      const bellFreq = MELODY_STEPS[step % 32];
      if (bellFreq > 0) {
        const bell = this.ctx.createOscillator();
        bell.type = 'sine';
        bell.frequency.value = bellFreq;

        const bg = this.ctx.createGain();
        bg.gain.setValueAtTime(0.0001, t);
        bg.gain.linearRampToValueAtTime(0.045, t + 0.04);
        bg.gain.exponentialRampToValueAtTime(0.0001, t + 2.5);

        bell.connect(bg);
        bg.connect(this.musicMaster);
        bg.connect(this.musicDelay);

        bell.start(t);
        bell.stop(t + 2.7);
        this.musicOscs.push(bell);
        bell.onended = () => {
          const idx = this.musicOscs.indexOf(bell);
          if (idx !== -1) this.musicOscs.splice(idx, 1);
        };
      }

      step++;
      this.musicTimer = window.setTimeout(play, AMBIENT_BEAT_MS);
    };

    play();
  }

  musicOff(): void {
    if (this.musicTimer !== null) {
      clearTimeout(this.musicTimer);
      this.musicTimer = null;
    }
    const ctx = this.ctx;
    const t = ctx ? ctx.currentTime : 0;

    // Smoothly fade out musicMaster so delay tails and chord releases ramp to zero within 1.8s
    if (ctx && this.musicMaster) {
      this.musicMaster.gain.cancelScheduledValues(t);
      this.musicMaster.gain.setValueAtTime(this.musicMaster.gain.value, t);
      this.musicMaster.gain.exponentialRampToValueAtTime(0.0001, t + 1.8);
    }

    // Stop all running oscillators after the 1.9s fade
    for (const osc of this.musicOscs) {
      try {
        osc.stop(t + 1.9);
      } catch {
        /* noop */
      }
    }
    this.musicOscs = [];

    // Disconnect old nodes after 2 seconds to release audio graph resources cleanly
    const oldMaster = this.musicMaster;
    const oldDelay = this.musicDelay;
    const oldFeedback = this.musicFeedback;
    const oldWet = this.musicWet;
    if (oldMaster || oldDelay) {
      window.setTimeout(() => {
        try {
          oldFeedback?.disconnect();
          oldDelay?.disconnect();
          oldWet?.disconnect();
          oldMaster?.disconnect();
        } catch {
          /* noop */
        }
      }, 2000);
    }
    this.musicMaster = null;
    this.musicDelay = null;
    this.musicFeedback = null;
    this.musicWet = null;
  }

  /** World-attenuated shot helper for bots. */
  botShot(l: Listener, src: THREE.Vector3, body = 150, bright = 1100): void {
    const { gain, pan } = atten(l, src);
    this.shot({
      soundBody: body,
      soundBright: bright,
      soundDur: 0.1 + Math.random() * 0.05,
      soundCrack: 3200,
      soundMech: 1100,
      soundTail: 0.45,
    }, Math.hypot(src.x - l.pos.x, src.z - l.pos.z), pan * (gain > 0.02 ? 1 : 0));
  }
}

export const SFX = new AudioEngineImpl();
