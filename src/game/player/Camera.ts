import * as THREE from 'three';
import { Input } from '../input/InputManager';
import { T } from '../store/transient';
import { useGameStore } from '../store/gameStore';
import { Recoil } from '../weapons/Recoil';
import { clamp, lerp } from '../utils/MathUtils';

const EULER = new THREE.Euler(0, 0, 0, 'YXZ');
const VP = new THREE.Matrix4();

/** Set by WeaponState each frame (current weapon ADS fov). */
export let W_ADS_FOV = 60;
export function setAdsFov(v: number): void { W_ADS_FOV = v; }

/** Render-side camera composition: look, recoil, shake, bob, FOV. */
export function cameraCompose(cam: THREE.PerspectiveCamera, dt: number): void {
  const st = useGameStore.getState();

  const adsZoom = lerp(1, T.cam.fov / st.settings.fov, T.player.ads);
  const s = 0.0022 * st.settings.sens * adsZoom;
  T.cam.yaw -= Input.lookX * s;
  T.cam.pitch -= Input.lookY * s;
  Input.lookX = 0;
  Input.lookY = 0;
  T.cam.pitch = clamp(T.cam.pitch, -1.45, 1.45);

  Recoil.tick(dt);

  T.shake = Math.max(0, T.shake - dt * 2.2);
  const sh = T.shake * T.shake;
  const t = performance.now() / 1000;
  const shakeP = sh * 0.03 * (Math.sin(t * 61) + Math.sin(t * 83) * 0.5);
  const shakeY = sh * 0.03 * (Math.cos(t * 67) + Math.sin(t * 91) * 0.5);
  const shakeR = sh * 0.02 * Math.sin(t * 71);

  const px = lerp(T.player.prevPos.x, T.player.pos.x, T.alpha);
  const py = lerp(T.player.prevPos.y, T.player.pos.y, T.alpha);
  const pz = lerp(T.player.prevPos.z, T.player.pos.z, T.alpha);
  const eyeOff = lerp(0.67, 0.13, T.player.crouch);

  const bobAmt = T.player.grounded ? clamp(T.player.speed / 7, 0, 1) * (1 - T.player.ads * 0.8) : 0;
  T.player.bobPhase += dt * (6 + T.player.speed * 1.1);
  const bobY = Math.sin(T.player.bobPhase * 2) * 0.014 * bobAmt;
  const bobX = Math.cos(T.player.bobPhase) * 0.01 * bobAmt;

  cam.position.set(px + bobX * 0.4, py + eyeOff + bobY, pz);
  EULER.set(
    T.cam.pitch + Recoil.pitch + shakeP,
    T.cam.yaw + Recoil.yaw + shakeY,
    T.player.slide * -0.06 + shakeR
  );
  cam.quaternion.setFromEuler(EULER);

  const base = st.settings.fov;
  const target = lerp(
    lerp(base, base + 7, T.player.sprint),
    W_ADS_FOV,
    T.player.ads
  );
  if (Math.abs(cam.fov - target) > 0.05) {
    cam.fov = lerp(cam.fov, target, 1 - Math.exp(-14 * dt));
    cam.updateProjectionMatrix();
  }
  T.cam.fov = cam.fov;
  T.cam.pos.copy(cam.position);
  T.cam.quat.copy(cam.quaternion);

  cam.updateMatrixWorld();
  VP.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
  T.cam.vp.copy(VP);
}
