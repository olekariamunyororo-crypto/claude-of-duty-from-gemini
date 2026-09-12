import * as THREE from 'three';
import { WEAPONS, type WeaponDef } from './weaponData';
import { fireRay, falloffMult } from './Ballistics';
import { Recoil } from './Recoil';
import { Input } from '../input/InputManager';
import { T } from '../store/transient';
import { useGameStore } from '../store/gameStore';
import { P } from '../player/playerState';
import { FX, fxLight } from '../scene/fx';
import { throwNade } from '../scene/Grenades';
import { SFX } from '../audio/AudioEngine';
import { clamp, damp } from '../utils/MathUtils';
import { setAdsFov } from '../player/Camera';
import { bus } from '../utils/Bus';
import { damageBot } from '../ai/bots';

const DIR = new THREE.Vector3();
const RIGHT = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const SDIR = new THREE.Vector3();

class WeaponStateImpl {
  slots: [string, string] = ['ar', 'pistol'];
  cur = 0;
  mag = [30, 12];
  reserve = [120, 48];
  nades = 2;
  state: 'ready' | 'reload' | 'swap' = 'ready';
  t = 0;
  lastFire = -9;
  triggerUsed = false;
  bloom = 0;
  private reloadStage = 0;

  def(): WeaponDef { return WEAPONS[this.slots[this.cur]]; }

  equipLoadout(primary: string): void {
    this.slots = [WEAPONS[primary] ? primary : 'ar', 'pistol'];
    this.cur = 0;
    this.mag = this.slots.map((id) => WEAPONS[id].mag) as [number, number];
    this.reserve = this.slots.map((id) => WEAPONS[id].reserve) as [number, number];
    this.nades = 2;
    this.state = 'ready';
    this.bloom = 0;
    Recoil.reset();
    T.viewmodel.wid = this.slots[0];
    T.viewmodel.muzzle.copy(T.cam.pos);
    useGameStore.getState().setHud({ reloading: false, reloadPct: 0 });
    this.syncHud(true);
  }

  refill(): void {
    this.mag = this.slots.map((id) => WEAPONS[id].mag) as [number, number];
    this.reserve = this.slots.map((id) => WEAPONS[id].reserve) as [number, number];
    this.nades = 2;
    this.state = 'ready';
    useGameStore.getState().setHud({ reloading: false, reloadPct: 0 });
    this.syncHud(true);
  }

  tick(dt: number): void {
    if (!P.alive) {
      if (this.state === 'reload') {
        this.state = 'ready';
        useGameStore.getState().setHud({ reloading: false, reloadPct: 0 });
      }
      T.player.ads = damp(T.player.ads, 0, 12, dt);
      return;
    }
    const def = this.def();
    const st = useGameStore.getState();
    setAdsFov(def.adsFov);

    // --- ADS ---
    const wantAds = Input.wantsAds && this.state === 'ready';
    T.player.ads = damp(T.player.ads, wantAds ? 1 : 0, 1 / Math.max(def.adsTime, 0.02) * 2.2, dt);

    // --- swap ---
    if (Input.swapQueued !== 0 && this.state !== 'swap') {
      Input.swapQueued = 0;
      if (this.state === 'reload') {
        st.setHud({ reloading: false, reloadPct: 0 });
      }
      this.cur = (this.cur + 1) % 2;
      this.state = 'swap';
      this.t = 0;
      T.viewmodel.wid = this.slots[this.cur];
      SFX.reloadStage(0);
      this.syncHud(true);
    } else if (Input.swapQueued !== 0) {
      Input.swapQueued = 0;
    }
    if (this.state === 'swap') {
      this.t += dt;
      if (this.t >= 0.45) this.state = 'ready';
    }

    // --- reload ---
    if (Input.reloadQueued) {
      Input.reloadQueued = false;
      const canReload = this.state === 'ready' && (this.mag[this.cur] < def.mag || this.reserve[this.cur] > 0);
      if (canReload) {
        this.state = 'reload';
        this.t = 0;
        this.reloadStage = 0;
        SFX.reloadStage(0);
        st.setHud({ reloading: true, reloadPct: 0 });
      } else if (this.state === 'ready' && this.reserve[this.cur] <= 0 && this.mag[this.cur] < def.mag) {
        SFX.dryClick();
        bus.emit('toast', { text: 'RELOAD: OUT OF AMMO' });
      }
    }
    if (this.state === 'reload') {
      this.t += dt;
      const p = this.t / def.reloadTime;
      if (p > 0.25 && this.reloadStage === 0) { this.reloadStage = 1; SFX.reloadStage(1); }
      if (p > 0.7 && this.reloadStage === 1) { this.reloadStage = 2; SFX.reloadStage(2); }
      st.setHud({ reloadPct: clamp(p, 0, 1) });
      if (this.t >= def.reloadTime) {
        const need = def.mag - this.mag[this.cur];
        const take = Math.min(need, this.reserve[this.cur]);
        this.mag[this.cur] += take;
        this.reserve[this.cur] -= take;
        this.state = 'ready';
        st.setHud({ reloading: false, reloadPct: 1 });
        this.syncHud(true);
      }
    }

    // --- fire ---
    if (this.state === 'ready' && P.alive) {
      const interval = 60 / def.rpm;
      const now = performance.now() / 1000;
      const click = Input.wantsFire && (def.auto || !this.triggerUsed);
      if (click && now - this.lastFire >= interval) {
        this.lastFire = now;
        if (!def.auto) this.triggerUsed = true;
        if (this.mag[this.cur] <= 0) {
          SFX.dryClick();
          Input.reloadQueued = true;
        } else {
          this.fireShot(def);
        }
      }
      if (!Input.wantsFire) this.triggerUsed = false;
    }

    // --- grenade ---
    if (Input.nadeQueued) {
      Input.nadeQueued = false;
      if (this.nades > 0 && this.state === 'ready') {
        this.nades--;
        throwNade();
        this.syncHud(true);
      }
    }

    // --- viewmodel kick & flash decay ---
    T.viewmodel.kick = Math.max(0, T.viewmodel.kick - dt * 0.45);
    T.viewmodel.flash = Math.max(0, T.viewmodel.flash - dt * 14);

    // --- spread for crosshair ---
    const moveFactor = clamp(T.player.speed / 7, 0, 1);
    const spread = (def.spreadHip + def.bloom + this.bloom + moveFactor * 0.02 * (1 - T.player.ads)) *
      (1 - T.player.ads) + def.spreadAds * T.player.ads;
    this.bloom = Math.max(0, this.bloom - dt * 0.03);
    T.weapon.spread = spread;
    const fovRad = (T.cam.fov * Math.PI) / 180;
    T.weapon.spreadPx = (spread / fovRad) * window.innerHeight * 1.1 + 6;
  }

  private fireShot(def: WeaponDef): void {
    this.mag[this.cur]--;
    const origin = T.cam.pos;
    DIR.set(0, 0, -1).applyQuaternion(T.cam.quat);
    RIGHT.crossVectors(DIR, UP).normalize();
    const upV = new THREE.Vector3().crossVectors(RIGHT, DIR).normalize();

    for (let p = 0; p < def.pellets; p++) {
      SDIR.copy(DIR)
        .addScaledVector(RIGHT, (Math.random() - 0.5) * 2 * T.weapon.spread)
        .addScaledVector(upV, (Math.random() - 0.5) * 2 * T.weapon.spread)
        .normalize();
      const hit = fireRay(origin, SDIR, 120);
      if (!hit) continue;
      if (hit.bot) {
        const mult = falloffMult(def, hit.dist) * (hit.head ? def.headMult : 1);
        const dmg = def.damage * mult;
        const killed = hit.bot.hp - dmg <= 0;
        damageBot(hit.bot, dmg, hit.head, 'player', def.name);
        FX.confetti(hit.point, killed ? 26 : 10, hit.head);
        bus.emit('hit', { head: hit.head, kill: killed });
        bus.emit('dmg', { pos: hit.point, amount: Math.round(dmg), head: hit.head });
        SFX.hitmarker(hit.head, killed);
      } else {
        FX.impact(hit.point, hit.normal);
      }
      FX.tracer(T.viewmodel.muzzle, hit.point, def.tracer);
    }

    Recoil.add(def.recoilV, def.recoilH);
    T.viewmodel.kick = Math.min(0.09, T.viewmodel.kick + 0.028 + def.recoilV * 0.4);
    T.viewmodel.flash = 1;
    T.shake = Math.min(1, T.shake + 0.045 + def.recoilV * 0.3);
    this.bloom = Math.min(0.05, this.bloom + def.bloom);
    fxLight.intensity = Math.max(fxLight.intensity, 3);
    fxLight.pos.copy(T.viewmodel.muzzle);
    SFX.shot(def, 0, 0);
    this.syncHud(true);
  }

  syncHud(force = false): void {
    const st = useGameStore.getState();
    const def = this.def();
    const patch = {
      mag: this.mag[this.cur],
      magSize: def.mag,
      reserve: this.reserve[this.cur],
      nades: this.nades,
      weapon: def.name,
      weaponCls: def.cls,
      reloadTime: def.reloadTime,
      alive: P.alive,
    };
    if (force) st.setHud(patch);
    else {
      const h = st.hud;
      if (h.mag !== patch.mag || h.reserve !== patch.reserve || h.nades !== patch.nades || h.weapon !== patch.weapon) st.setHud(patch);
    }
  }
}

export const W = new WeaponStateImpl();
