import * as THREE from 'three';

export interface Listener { pos: THREE.Vector3; yaw: number; }

/** Distance gain + stereo pan for a world-space source, relative to the listener. */
export function atten(l: Listener, src: THREE.Vector3): { gain: number; pan: number } {
  const dx = src.x - l.pos.x, dz = src.z - l.pos.z;
  const d = Math.hypot(dx, dz, src.y - l.pos.y);
  const gain = Math.min(1, 1 / (1 + d * 0.055));
  const fx = -Math.sin(l.yaw), fz = -Math.cos(l.yaw);
  const rx = -fz, rz = fx;
  const len = Math.max(0.0001, Math.hypot(dx, dz));
  const pan = Math.max(-1, Math.min(1, (dx / len) * rx + (dz / len) * rz));
  return { gain, pan };
}

/** Distance low-pass cutoff so far shots sound muffled. */
export function distCutoff(d: number): number {
  return Math.max(900, 9000 / (1 + d * 0.06));
}
