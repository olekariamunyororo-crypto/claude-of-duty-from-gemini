import { useGameStore } from '../store/gameStore';
import { SFX } from '../audio/AudioEngine';

type VoidFn = () => void;

/** Module-level coarse-pointer detection (available before init()). */
export const IS_TOUCH =
  typeof window !== 'undefined' &&
  'ontouchstart' in window &&
  window.matchMedia('(pointer: coarse)').matches;

/**
 * Keyboard/mouse + virtual-touch input manager.
 * Look deltas accumulate here and are consumed once per rendered frame by the
 * camera composer; edge-triggered actions are queued and consumed by systems.
 */
class InputManagerImpl {
  keys = new Set<string>();
  lookX = 0;
  lookY = 0;
  fire = false;
  ads = false;                 // hold (mouse RMB)
  adsToggle = false;           // toggle (mobile)
  sprint = false;
  crouch = false;
  scoreboard = false;
  locked = false;
  touch = false;

  jumpQueued = false;
  reloadQueued = false;
  swapQueued = 0;
  nadeQueued = false;

  tMoveX = 0;
  tMoveY = 0;
  tFire = false;

  canvasEl: HTMLElement | null = null;
  private sens = 1;
  private started = false;
  private cleanups: VoidFn[] = [];

  get moveX(): number { return this.clampAxis(this.kx() + this.tMoveX); }
  get moveZ(): number { return this.clampAxis(this.kz() + this.tMoveY); }
  get wantsFire(): boolean { return this.fire || this.tFire; }
  get wantsAds(): boolean { return this.ads || this.adsToggle; }

  private clampAxis(v: number) { return v < -1 ? -1 : v > 1 ? 1 : v; }
  private kx(): number { return (this.keys.has('KeyD') ? 1 : 0) - (this.keys.has('KeyA') ? 1 : 0); }
  private kz(): number { return (this.keys.has('KeyW') ? 1 : 0) - (this.keys.has('KeyS') ? 1 : 0); }

  init(): void {
    if (this.started) return;
    this.started = true;
    this.touch = IS_TOUCH;

    const kd = (e: KeyboardEvent) => {
      if (e.code === 'Tab') e.preventDefault();
      this.keys.add(e.code);
      if (e.repeat) return;
      switch (e.code) {
        case 'Space': this.jumpQueued = true; break;
        case 'KeyR': this.reloadQueued = true; break;
        case 'Digit1': case 'Digit2': case 'KeyQ': this.swapQueued = 1; break;
        case 'KeyG': this.nadeQueued = true; break;
        case 'ShiftLeft': case 'ShiftRight': this.sprint = true; break;
        case 'KeyC': case 'ControlLeft': this.crouch = true; break;
        case 'Tab': this.scoreboard = true; break;
      }
      SFX.unlock();
    };
    const ku = (e: KeyboardEvent) => {
      this.keys.delete(e.code);
      switch (e.code) {
        case 'ShiftLeft': case 'ShiftRight': this.sprint = false; break;
        case 'KeyC': case 'ControlLeft': this.crouch = false; break;
        case 'Tab': this.scoreboard = false; break;
      }
    };
    const md = (e: MouseEvent) => {
      if (!this.locked) return;
      if (e.button === 0) this.fire = true;
      if (e.button === 2) this.ads = true;
      SFX.unlock();
    };
    const mu = (e: MouseEvent) => {
      if (e.button === 0) this.fire = false;
      if (e.button === 2) this.ads = false;
    };
    const mm = (e: MouseEvent) => {
      if (!this.locked) return;
      this.lookX += e.movementX;
      this.lookY += e.movementY;
    };
    const wheel = (e: WheelEvent) => { if (this.locked) this.swapQueued = e.deltaY > 0 ? 1 : -1; };
    const ctx = (e: Event) => e.preventDefault();
    const plc = () => {
      this.locked = document.pointerLockElement === this.canvasEl;
      if (!this.locked) {
        this.fire = false; this.ads = false; this.keys.clear();
        const st = useGameStore.getState();
        if (st.phase === 'playing') st.setPhase('paused');
      }
    };
    const blur = () => { this.keys.clear(); this.fire = false; this.ads = false; };

    document.addEventListener('keydown', kd);
    document.addEventListener('keyup', ku);
    document.addEventListener('mousedown', md);
    document.addEventListener('mouseup', mu);
    document.addEventListener('mousemove', mm);
    document.addEventListener('wheel', wheel, { passive: true });
    document.addEventListener('contextmenu', ctx);
    document.addEventListener('pointerlockchange', plc);
    window.addEventListener('blur', blur);
    this.cleanups.push(() => {
      document.removeEventListener('keydown', kd);
      document.removeEventListener('keyup', ku);
      document.removeEventListener('mousedown', md);
      document.removeEventListener('mouseup', mu);
      document.removeEventListener('mousemove', mm);
      document.removeEventListener('wheel', wheel);
      document.removeEventListener('contextmenu', ctx);
      document.removeEventListener('pointerlockchange', plc);
      window.removeEventListener('blur', blur);
    });
  }

  attachCanvas(el: HTMLElement): void {
    this.canvasEl = el;
    el.addEventListener('click', () => {
      SFX.unlock();
      if (useGameStore.getState().phase === 'playing' && !this.touch && !this.locked) {
        void el.requestPointerLock();
      }
    });
  }

  requestLock(): void {
    if (!this.touch && this.canvasEl && !this.locked) void this.canvasEl.requestPointerLock();
  }

  syncSens(s: number): void { this.sens = s; }
  get sensValue(): number { return this.sens; }

  dispose(): void { this.cleanups.forEach((c) => c()); this.cleanups = []; this.started = false; }
}

export const Input = new InputManagerImpl();
