import { Input } from '../input/InputManager';
import { T } from '../store/transient';
import { P } from './playerState';
import { POOL_BOUNDS } from '../scene/Map';
import { SFX } from '../audio/AudioEngine';
import { FX } from '../scene/fx';
import { damp } from '../utils/MathUtils';

export const GRAV = 22;
export const JUMP_V = 6.9;

/** Compute desired horizontal velocity from input + stance. */
export function computeWish(def: { moveMult: number }): { vx: number; vz: number } {
  const ix = Input.moveX;
  const iz = Input.moveZ;
  const yaw = T.cam.yaw;
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
  const rx = -fz, rz = fx;
  let dx = rx * ix + fx * iz;
  let dz = rz * ix + fz * iz;
  const len = Math.hypot(dx, dz);
  if (len > 1) { dx /= len; dz /= len; }

  const firing = Input.wantsFire;
  const sprintHeld = Input.sprint || (Input.touch && iz > 0.92);
  const sprinting = sprintHeld && iz > 0.3 && !firing && T.player.ads < 0.3 && P.slideT <= 0 && !Input.crouch;
  T.player.sprint = damp(T.player.sprint, sprinting ? 1 : 0, 8, 1 / 60);

  let speed = 5.2 * def.moveMult;
  if (sprinting) speed = 7.5 * def.moveMult;
  if (Input.crouch && P.slideT <= 0) speed = 2.9;
  if (T.player.ads > 0.5) speed *= 0.6;
  if (T.player.inWater) speed *= 0.55;
  if (P.slideT > 0) speed = 0;

  return { vx: dx * speed, vz: dz * speed };
}

/** Post-move housekeeping: water state, footsteps, landing, slide timer. */
export function postMove(dt: number, wasGrounded: boolean): void {
  const feetY = T.player.pos.y - 0.95;
  const inPool = feetY < -0.25 &&
    T.player.pos.x > POOL_BOUNDS.x1 && T.player.pos.x < POOL_BOUNDS.x2 &&
    T.player.pos.z > POOL_BOUNDS.z1 && T.player.pos.z < POOL_BOUNDS.z2;
  if (inPool && !T.player.inWater) {
    FX.splash(T.player.pos);
    SFX.splash(0);
  }
  T.player.inWater = inPool;

  if (!wasGrounded && T.player.grounded && P.fallV < -7) {
    SFX.step('land');
    T.shake = Math.min(1, T.shake + 0.1);
  }
  if (T.player.grounded) P.fallV = 0;

  if (P.slideT > 0) {
    P.slideT -= dt;
    T.player.slide = damp(T.player.slide, 1, 12, dt);
  } else {
    T.player.slide = damp(T.player.slide, 0, 12, dt);
  }

  const crouching = Input.crouch || P.slideT > 0;
  T.player.crouch = damp(T.player.crouch, crouching ? 1 : 0, 10, dt);

  const sp = Math.hypot(T.player.vel.x, T.player.vel.z);
  T.player.speed = sp;
  if (T.player.grounded && sp > 1.5) {
    P.footAcc = (P.footAcc ?? 0) + sp * dt;
    const stride = sp > 6.5 ? 2.6 : 2.2;
    if (P.footAcc > stride) {
      P.footAcc = 0;
      const kind = inPool ? 'water' : (feetY > 3 || feetY < -0.5 ? 'metal' : 'deck');
      SFX.step(kind);
    }
  }
}
