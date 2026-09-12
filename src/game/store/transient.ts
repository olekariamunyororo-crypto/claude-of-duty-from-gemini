import * as THREE from 'three';

/**
 * Transient frame channel — the official zustand "transient updates" pattern.
 * High-frequency transform streams (camera, velocities, FX triggers) live here
 * so the reactive store never re-renders React at frame rate. All DISCRETE
 * game logic (scores, phases, ammo, health, rosters) lives in gameStore.
 */
export const T = {
  alpha: 0,               // fixed-step interpolation factor
  fps: 60,
  cam: {
    pos: new THREE.Vector3(),
    yaw: 0,
    pitch: 0,
    fov: 80,
    quat: new THREE.Quaternion(),   // full orientation incl. recoil/shake
    vp: new THREE.Matrix4(),        // view-projection for HUD projection
  },
  player: {
    pos: new THREE.Vector3(),       // capsule CENTER (feet + 0.95)
    prevPos: new THREE.Vector3(),
    vel: new THREE.Vector3(),
    vy: 0,
    grounded: true,
    sprint: 0,
    crouch: 0,
    slide: 0,
    ads: 0,
    alive: true,
    inWater: false,
    speed: 0,
    bobPhase: 0,
  },
  viewmodel: {
    wid: 'ar',
    kick: 0,
    flash: 0,
    muzzle: new THREE.Vector3(),
  },
  weapon: { spread: 0.02, spreadPx: 12 },
  shake: 0,
  reset() {
    this.shake = 0;
    this.player.ads = 0; this.player.alive = true; this.player.vy = 0;
    this.viewmodel.kick = 0; this.viewmodel.flash = 0;
  },
};
