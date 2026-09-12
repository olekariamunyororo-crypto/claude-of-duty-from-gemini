import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { getMat } from '../utils/ProceduralGeometry';
import { useGameStore } from '../store/gameStore';
import { Sky, SUN_DIRECTION } from './Sky';
import { Ocean } from './Ocean';

// ---------------------------------------------------------------------------
// Map data — faithful-but-simplified Hijacked footprint.
// X: stern(-38) -> bow(+41) | Z: beam ±13 | main deck y=0, upper deck y=3.4
// ---------------------------------------------------------------------------
export interface MapBox {
  x: number; y: number; z: number;
  hx: number; hy: number; hz: number;
  mat: string;
  collide: boolean;
  occlude: boolean;
}

export const BOXES: MapBox[] = [];
function box(x: number, y: number, z: number, hx: number, hy: number, hz: number, mat: string, collide = true, occlude = true): void {
  BOXES.push({ x, y, z, hx, hy, hz, mat, collide, occlude });
}
function slab(x1: number, x2: number, z1: number, z2: number, top: number, th: number, mat: string, collide = true, occlude = true): void {
  box((x1 + x2) / 2, top - th / 2, (z1 + z2) / 2, (x2 - x1) / 2, th / 2, (z2 - z1) / 2, mat, collide, occlude);
}
function wallX(x1: number, x2: number, z: number, y1: number, y2: number, th: number, mat: string): void {
  box((x1 + x2) / 2, (y1 + y2) / 2, z, (x2 - x1) / 2, (y2 - y1) / 2, th / 2, mat);
}
function wallY(x1: number, x2: number, z: number, y1: number, y2: number, th: number, mat: string): void {
  box((x1 + x2) / 2, (y1 + y2) / 2, z, (x2 - x1) / 2, (y2 - y1) / 2, th / 2, mat);
}
function wallZ(x: number, z1: number, z2: number, y1: number, y2: number, th: number, mat: string): void {
  box(x, (y1 + y2) / 2, (z1 + z2) / 2, th / 2, (y2 - y1) / 2, (z2 - z1) / 2, mat);
}
function stairs(x0: number, cz: number, w: number, dir: number, baseY: number, rise: number, run: number, n: number, mat: string): void {
  for (let i = 0; i < n; i++) {
    const top = baseY + rise * (i + 1);
    const bottom = baseY - 0.15;
    box(x0 + dir * run * (i + 0.5), (top + bottom) / 2, cz, run / 2, (top - bottom) / 2, w / 2, mat);
  }
}
function rail(...segs: Array<[number, number, number, number, number, number]>): void {
  for (const [x, y, z, hx, hy, hz] of segs) box(x, y, z, hx, hy, hz, 'trim', true, false);
}

// ---- hull ----
box(0, -2.25, 13.45, 38.5, 2.25, 0.45, 'hull');
box(0, -2.25, -13.45, 38.5, 2.25, 0.45, 'hull');
box(-38.45, -2.25, 0, 0.45, 2.25, 13.9, 'hull');
box(39.6, -2.25, 0, 1.4, 2.25, 12.8, 'hull');
box(0, -1.1, 13.92, 38.5, 0.45, 0.06, 'blue');
box(0, -1.1, -13.92, 38.5, 0.45, 0.06, 'blue');
box(-38.92, -1.1, 0, 0.06, 0.45, 13, 'blue');

// ---- hull shell extensions ----
// Stern swim platform and transom steps
slab(-40.5, -38, -10.5, 10.5, -1.5, 0.4, 'deck');
box(-40.6, -1.55, 0, 0.15, 0.25, 10.65, 'trim');
box(-39.25, -1.55, 10.6, 1.35, 0.25, 0.15, 'trim');
box(-39.25, -1.55, -10.6, 1.35, 0.25, 0.15, 'trim');
slab(-38.2, -37.4, 6, 9.5, -0.5, 0.3, 'deck');
slab(-38.2, -37.4, -9.5, -6, -0.5, 0.3, 'deck');
slab(-38.9, -38.2, 6, 9.5, -1.0, 0.3, 'deck');
slab(-38.9, -38.2, -9.5, -6, -1.0, 0.3, 'deck');

// Bow taper hull slabs
wallX(26, 34, 12.2, -2.25, 0, 0.5, 'hull');
wallX(26, 34, -12.2, -2.25, 0, 0.5, 'hull');
wallX(34, 39.5, 8.5, -2.25, 0, 0.5, 'hull');
wallX(34, 39.5, -8.5, -2.25, 0, 0.5, 'hull');
wallX(39.5, 41.2, 3.2, -2.25, 0, 0.5, 'hull');
wallX(39.5, 41.2, -3.2, -2.25, 0, 0.5, 'hull');
wallZ(41.2, -3.2, 3.2, -2.25, 0, 0.5, 'hull');
box(30, -1.1, 12.5, 4, 0.45, 0.06, 'blue');
box(30, -1.1, -12.5, 4, 0.45, 0.06, 'blue');
box(36.75, -1.1, 8.8, 2.75, 0.45, 0.06, 'blue');
box(36.75, -1.1, -8.8, 2.75, 0.45, 0.06, 'blue');
slab(38.2, 41.0, -3.0, 3.0, 0, 0.5, 'deck');
rail([39.6, 0.525, 3.1, 1.4, 0.525, 0.06], [39.6, 0.525, -3.1, 1.4, 0.525, 0.06], [41.0, 0.525, 0, 0.06, 0.525, 3.1]);

// ---- main deck slabs ----
slab(-38, -26, -13, 13, 0, 0.5, 'deck');
slab(-26, -23, -13, -4, 0, 0.5, 'deck');
slab(-26, -23, -1, 13, 0, 0.5, 'deck');
slab(-23, -2, -13, 13, 0, 0.5, 'deck');
slab(-2, 8, -13, -3, 0, 0.5, 'deck');
slab(-2, 8, 3, 13, 0, 0.5, 'deck');
slab(8, 14.7, -13, 13, 0, 0.5, 'deck');
slab(18.4, 38.2, -13, 13, 0, 0.5, 'deck');
slab(14.7, 18.4, -13, -1.0, 0, 0.5, 'deck');
slab(14.7, 18.4, 1.0, 13, 0, 0.5, 'deck');

// ---- engine room ----
slab(-37.6, -26, -12, 12, -2.8, 0.4, 'metal');
slab(-26, 14, -4.5, 3.2, -2.8, 0.4, 'metal');
slab(14, 24, -5.0, 5.0, -2.8, 0.4, 'metal');
wallZ(-26.25, -12, -4, -2.8, -0.5, 0.5, 'metal');
wallZ(-26.25, -1, 12, -2.8, -0.5, 0.5, 'metal');
box(-33.5, -1.9, -7, 1.5, 0.9, 1.3, 'dark');
box(-33.5, -1.9, 7, 1.5, 0.9, 1.3, 'dark');
box(-26.6, -1.7, 5, 0.25, 1.1, 4.5, 'dark');
box(-26.6, -1.7, -5, 0.25, 1.1, 4.5, 'dark');
stairs(-25.7, -2.5, 2, 1, -2.8, 0.28, 0.3, 10, 'metal');
rail([-24.5, 0.525, -3.56, 1.5, 0.525, 0.06], [-24.5, 0.525, -1.44, 1.5, 0.525, 0.06], [-26.06, 0.525, -2.5, 0.06, 0.525, 1.05]);

// ---- pool ----
slab(-2, 8, -2.5, 2.5, -1.4, 0.4, 'pool');
box(3, -0.625, -2.75, 5, 0.775, 0.25, 'pool');
box(3, -0.625, 2.75, 5, 0.775, 0.25, 'pool');
box(-2.25, -0.625, 0, 0.25, 0.775, 3, 'pool');
box(8.25, -0.625, 0, 0.25, 0.775, 3, 'pool');
box(-1.55, -0.95, 1.7, 0.45, 0.45, 0.65, 'pool');
box(-1.55, -0.95, -1.7, 0.45, 0.45, 0.65, 'pool');
// pool coping and hot tub ledge
box(3, 0.05, 2.65, 5.35, 0.08, 0.2, 'trim', true, false);
box(3, 0.05, -2.65, 5.35, 0.08, 0.2, 'trim', true, false);
box(-2.15, 0.05, 0, 0.2, 0.08, 2.75, 'trim', true, false);
box(8.15, 0.05, 0, 0.2, 0.08, 2.75, 'trim', true, false);
box(6.2, -0.7, 0, 0.2, 0.7, 2.5, 'pool');
slab(6.4, 7.9, -2.3, 2.3, -0.6, 0.4, 'pool');

// ---- lounges ----
for (const s of [1, -1]) {
  wallX(-16, -13, 5.35 * s, 0, 3, 0.5, 'wall');
  wallX(-11, 9, 5.35 * s, 0, 3, 0.5, 'wall');
  wallX(11, 14, 5.35 * s, 0, 3, 0.5, 'wall');
  wallX(-13, -11, 5.35 * s, 2.4, 3, 0.5, 'wall');
  wallX(9, 11, 5.35 * s, 2.4, 3, 0.5, 'wall');
  wallX(-16, 14, 13.15 * s, 0, 3, 0.5, 'wall');
  if (s > 0) {
    wallZ(-16.25, 5.6, 7, 0, 3, 0.5, 'wall');
    wallZ(-16.25, 9.5, 12.9, 0, 3, 0.5, 'wall');
    wallZ(-16.25, 7, 9.5, 2.4, 3, 0.5, 'wall');
  } else {
    wallZ(-16.25, -12.9, -9.5, 0, 3, 0.5, 'wall');
    wallZ(-16.25, -7, -5.6, 0, 3, 0.5, 'wall');
    wallZ(-16.25, -9.5, -7, 2.4, 3, 0.5, 'wall');
  }
  if (s > 0) {
    wallZ(14.25, 5.6, 7, 0, 3, 0.5, 'wall');
    wallZ(14.25, 9.5, 12.9, 0, 3, 0.5, 'wall');
    wallZ(14.25, 7, 9.5, 2.4, 3, 0.5, 'wall');
  } else {
    wallZ(14.25, -12.9, -9.5, 0, 3, 0.5, 'wall');
    wallZ(14.25, -7, -5.6, 0, 3, 0.5, 'wall');
    wallZ(14.25, -9.5, -7, 2.4, 3, 0.5, 'wall');
  }
}
wallZ(14.25, -5.35, -1.5, 0, 3, 0.5, 'wall');
wallZ(14.25, 1.5, 5.35, 0, 3, 0.5, 'wall');
wallZ(14.25, -1.5, 1.5, 2.4, 3, 0.5, 'wall');

// Symmetric aft center wall at X = -16.25
wallZ(-16.25, -5.35, -1.5, 0, 3, 0.5, 'wall');
wallZ(-16.25, 1.5, 5.35, 0, 3, 0.5, 'wall');
wallZ(-16.25, -1.5, 1.5, 2.4, 3, 0.5, 'wall');

// Cabin window bands and trim
box(-1, 2.0, 13.42, 15, 0.4, 0.06, 'dark');
box(-1, 2.0, -13.42, 15, 0.4, 0.06, 'dark');
box(-1, 2.65, 13.44, 15, 0.1, 0.08, 'trim');
box(-1, 2.65, -13.44, 15, 0.1, 0.08, 'trim');

// Cabin upper roofs & aft canopy
slab(-16, -8, -7, 7, 6.4, 0.3, 'metal');
box(-15.5, 4.875, 6.5, 0.25, 1.475, 0.25, 'wall');
box(-15.5, 4.875, -6.5, 0.25, 1.475, 0.25, 'wall');
box(-8.5, 4.875, 6.5, 0.25, 1.475, 0.25, 'wall');
box(-8.5, 4.875, -6.5, 0.25, 1.475, 0.25, 'wall');

// ---- starboard props (bar) ----
box(-6, 0.55, 10.6, 4, 0.55, 0.7, 'trim');
box(-9, 0.35, 9.6, 0.35, 0.35, 0.35, 'dark');
box(-6, 0.35, 9.6, 0.35, 0.35, 0.35, 'dark');
box(-3, 0.35, 9.6, 0.35, 0.35, 0.35, 'dark');
box(-6, 1.8, 12.6, 4, 0.6, 0.25, 'dark');
box(6, 0.4, 11.6, 2.25, 0.4, 0.9, 'red');
box(6, 0.45, 9.6, 0.8, 0.45, 0.8, 'trim');
// ---- port props ----
box(-2, 0.5, -12.2, 3, 0.5, 0.8, 'metal');
box(4, 0.45, -11.5, 0.8, 0.45, 0.8, 'trim');
box(0, 0.6, -6.9, 0.6, 0.6, 0.6, 'metal');
box(1.3, 0.6, -6.7, 0.6, 0.6, 0.6, 'metal');
box(0.6, 1.5, -6.8, 0.5, 0.5, 0.5, 'metal');

// ---- upper slab ----
// Subtracted pool courtyard opening from X = -2 to 6, Z = -5.35 to 5.35
slab(-16, -2, -13.15, 13.15, 3.4, 0.4, 'metal');
slab(-2, 9.6, -13.15, -5.35, 3.4, 0.4, 'metal');
slab(-2, 9.6, 5.35, 13.15, 3.4, 0.4, 'metal');
slab(6, 9.6, -5.35, 5.35, 3.4, 0.4, 'metal');
slab(9.6, 13.2, -13.15, -9.6, 3.4, 0.4, 'metal');
slab(9.6, 13.2, -7.6, 7.6, 3.4, 0.4, 'metal');
slab(9.6, 13.2, 9.6, 13.15, 3.4, 0.4, 'metal');
slab(13.2, 14, -13.15, 13.15, 3.4, 0.4, 'metal');
stairs(9.4, -8.6, 1.8, 1, 0, 3.4 / 12, 0.3167, 12, 'metal');
rail([11.4, 3.9, -7.55, 1.8, 0.5, 0.06], [11.4, 3.9, -9.65, 1.8, 0.5, 0.06], [9.55, 3.9, -8.6, 0.06, 0.5, 1.05]);

// Upper catwalk pool opening rails
rail([-2, 3.9, 5.35, 4, 0.5, 0.06], [2, 3.9, 5.35, 4, 0.5, 0.06],
  [-2, 3.9, -5.35, 4, 0.5, 0.06], [2, 3.9, -5.35, 4, 0.5, 0.06],
  [-2, 3.9, 0, 0.06, 0.5, 5.35]);

// ---- exterior aft stairs x2 ----
stairs(-20.2, 9, 2, 1, 0, 3.4 / 12, 0.35, 12, 'metal');
stairs(-20.2, -9, 2, 1, 0, 3.4 / 12, 0.35, 12, 'metal');
rail([-16.2, 3.9, -11.7, 0.06, 0.5, 1.45], [-16.2, 3.9, 0, 0.06, 0.5, 7.8], [-16.2, 3.9, 11.7, 0.06, 0.5, 1.45]);

// ---- funnel + pavilion + bridge ----
box(-5, 5.45, 0, 3, 2.05, 3.5, 'hull');
box(-5, 6.5, 0, 3.15, 0.35, 3.65, 'blue');
box(-5, 7.6, 0, 2.5, 0.15, 3, 'dark');
box(0, 4.7, 4.8, 0.35, 1.3, 0.35, 'wall');
box(0, 4.7, -4.8, 0.35, 1.3, 0.35, 'wall');
box(4, 4.7, 4.8, 0.35, 1.3, 0.35, 'wall');
box(4, 4.7, -4.8, 0.35, 1.3, 0.35, 'wall');
box(-13.5, 4.1, 5.5, 0.7, 0.7, 0.7, 'metal');
box(-13.5, 4.1, -5.5, 0.7, 0.7, 0.7, 'metal');
wallZ(6.25, -6, -1, 3.4, 6.35, 0.5, 'wall');
wallZ(6.25, 1, 6, 3.4, 6.35, 0.5, 'wall');
wallZ(6.25, -1, 1, 5.6, 6.35, 0.5, 'wall');
wallX(6, 14, 6.25, 3.4, 6.35, 0.5, 'wall');
wallX(6, 14, -6.25, 3.4, 6.35, 0.5, 'wall');
wallZ(13.75, -6, -3.6, 3.4, 6.35, 0.5, 'wall');
wallZ(13.75, 3.6, 6, 3.4, 6.35, 0.5, 'wall');
wallZ(13.75, -1.2, 1.2, 3.4, 6.35, 0.5, 'wall');
wallZ(13.75, -3.6, -1.2, 3.4, 4.3, 0.5, 'wall');
wallZ(13.75, 1.2, 3.6, 3.4, 4.3, 0.5, 'wall');
wallZ(13.75, -3.6, -1.2, 5.5, 6.35, 0.5, 'wall');
wallZ(13.75, 1.2, 3.6, 5.5, 6.35, 0.5, 'wall');
slab(6, 14, -6.25, 6.25, 6.4, 0.35, 'metal');
box(12.9, 4, -2.4, 0.7, 0.6, 0.8, 'dark');
box(12.9, 4, 2.4, 0.7, 0.6, 0.8, 'dark');

// ---- upper railings ----
rail([-1, 3.9, 13, 15, 0.5, 0.06], [-1, 3.9, -13, 15, 0.5, 0.06],
  [14.05, 3.9, 9.7, 0.06, 0.5, 3.45], [14.05, 3.9, -9.7, 0.06, 0.5, 3.45]);

// ---- main deck bulwarks ----
rail([-27.1, 0.525, 12.85, 10.9, 0.525, 0.125], [-27.1, 0.525, -12.85, 10.9, 0.525, 0.125],
  [-38.1, 0.525, 0, 0.125, 0.525, 13],
  [26.2, 0.525, 12.85, 12, 0.525, 0.125], [26.2, 0.525, -12.85, 12, 0.525, 0.125]);

// ---- helipad ----
box(31, 2.25, 0, 7, 0.15, 12.7, 'heli');
box(24.6, 1.05, 12.1, 0.3, 1.05, 0.3, 'metal');
box(24.6, 1.05, -12.1, 0.3, 1.05, 0.3, 'metal');
box(37.4, 1.05, 12.1, 0.3, 1.05, 0.3, 'metal');
box(37.4, 1.05, -12.1, 0.3, 1.05, 0.3, 'metal');
rail([24.15, 2.925, -9.95, 0.06, 0.525, 2.75], [24.15, 2.925, 0, 0.06, 0.525, 4.8], [24.15, 2.925, 9.95, 0.06, 0.525, 2.75],
  [37.85, 2.925, 0, 0.06, 0.525, 12.7],
  [31, 2.925, 12.55, 6.85, 0.525, 0.06], [31, 2.925, -12.55, 6.85, 0.525, 0.06]);
stairs(21.7, 6, 1.6, 1, 0, 0.3, 0.28, 8, 'metal');
stairs(21.7, -6, 1.6, 1, 0, 0.3, 0.28, 8, 'metal');
box(28, 0.6, 3, 0.6, 0.6, 0.6, 'metal');
box(28, 0.6, -3, 0.6, 0.6, 0.6, 'metal');
box(35.5, 0.6, -4, 0.6, 0.6, 0.6, 'metal');

// ===========================================================================
// Phase 3: Interior Rooms, Props, Vertical Traffic, Navigation, and Spawns
// ===========================================================================

// ---- (5) Interior Room Partition Walls ----
// Port Lounge partitions (Bedrooms X in [-16, -6], Dining X in [-6, 4], Gym X in [4, 14]):
wallZ(-6, -12.9, -9.8, 0, 3, 0.4, 'wall');
wallZ(-6, -8.2, -5.6, 0, 3, 0.4, 'wall');
wallZ(-6, -9.8, -8.2, 2.4, 3, 0.4, 'wall'); // doorway header
wallZ(4, -12.9, -9.8, 0, 3, 0.4, 'wall');
wallZ(4, -8.2, -5.6, 0, 3, 0.4, 'wall');
wallZ(4, -9.8, -8.2, 2.4, 3, 0.4, 'wall'); // doorway header

// Starboard Lounge partitions (Bedrooms X in [-16, -6], Dining/Bar X in [-6, 4], Gym X in [4, 14]):
wallZ(-6, 5.6, 8.2, 0, 3, 0.4, 'wall');
wallZ(-6, 9.8, 12.9, 0, 3, 0.4, 'wall');
wallZ(-6, 8.2, 9.8, 2.4, 3, 0.4, 'wall'); // doorway header
wallZ(4, 5.6, 8.2, 0, 3, 0.4, 'wall');
wallZ(4, 9.8, 12.9, 0, 3, 0.4, 'wall');
wallZ(4, 8.2, 9.8, 2.4, 3, 0.4, 'wall'); // doorway header

// Engine Room Tunnel side bulkheads and forward machinery bay enclosure (y = -2.8):
wallX(-26, 14, 3.45, -2.8, -0.4, 0.3, 'metal');
wallX(-26, 14, -4.5, -2.8, -0.4, 0.3, 'metal');
wallX(14, 24, 5.25, -2.8, -0.4, 0.3, 'metal');
wallX(14, 24, -5.25, -2.8, -0.4, 0.3, 'metal');
wallZ(24.1, -5.25, 5.25, -2.8, -0.45, 0.3, 'metal');

// Engine Room Catwalks:
slab(-36, -28, 7.5, 11.5, -1.3, 0.2, 'metal');
slab(-36, -28, -11.5, -7.5, -1.3, 0.2, 'metal');
rail([-32, -0.8, 7.45, 4, 0.5, 0.06], [-32, -0.8, -7.45, 4, 0.5, 0.06]);

// ---- (7) Vertical Traffic (Stairs, Catwalk Access, and Visual Ladders) ----
// Engine room forward companionway stair up to foredeck container bay (y = -2.8 -> 0):
stairs(14.8, 0, 1.8, 1, -2.8, 0.28, 0.35, 10, 'metal');
rail([16.75, 0.525, 1.05, 1.75, 0.525, 0.06], [16.75, 0.525, -1.05, 1.75, 0.525, 0.06], [14.95, 0.525, 0, 0.06, 0.525, 1.05]);

// Engine room aft catwalk stairs (y = -2.8 -> -1.3):
stairs(-28.5, 9.5, 1.5, -1, -2.8, 0.25, 0.35, 6, 'metal');
stairs(-28.5, -9.5, 1.5, -1, -2.8, 0.25, 0.35, 6, 'metal');

// Starboard upper deck companionway stairs (symmetric to port stairs at Z = -8.6, y = 0 -> 3.4):
stairs(9.4, 8.6, 1.8, 1, 0, 3.4 / 12, 0.3167, 12, 'metal');
rail([11.4, 3.9, 7.55, 1.8, 0.5, 0.06], [11.4, 3.9, 9.65, 1.8, 0.5, 0.06], [9.55, 3.9, 8.6, 0.06, 0.5, 1.05]);

// Visual ladders (non-colliding decorative indicators):
box(-38.05, -0.775, 0, 0.05, 0.725, 0.35, 'metal', false, false);
box(-2, -1.425, 0, 0.05, 1.375, 0.35, 'metal', false, false);
box(6.2, 4.85, 5.8, 0.05, 1.45, 0.35, 'metal', false, false);

// ---- (6) Furniture and Props ----
// Port Bedroom (Aft Stateroom):
slab(-15.8, -6.2, -12.7, -5.8, 0.02, 0.02, 'red', true, false); // carpet
box(-13, 0.25, -9.25, 1.0, 0.25, 0.75, 'red', true, false); // double bed
box(-14.05, 0.6, -9.25, 0.05, 0.6, 0.8, 'dark'); // headboard
box(-13, 0.3, -11.2, 0.35, 0.3, 0.35, 'trim', true, false); // nightstand
box(-13, 0.3, -7.3, 0.35, 0.3, 0.35, 'trim', true, false); // nightstand
box(-8, 0.9, -12.4, 0.8, 0.9, 0.4, 'dark'); // wardrobe locker
box(-8, 0.4, -6.2, 0.8, 0.4, 0.35, 'trim', true, false); // vanity desk
box(-8, 0.45, -7.0, 0.25, 0.45, 0.25, 'dark', true, false); // chair

// Starboard Bedroom (Aft Stateroom):
slab(-15.8, -6.2, 5.8, 12.7, 0.02, 0.02, 'red', true, false); // carpet
box(-13, 0.25, 9.25, 1.0, 0.25, 0.75, 'red', true, false); // double bed
box(-14.05, 0.6, 9.25, 0.05, 0.6, 0.8, 'dark'); // headboard
box(-13, 0.3, 11.2, 0.35, 0.3, 0.35, 'trim', true, false); // nightstand
box(-13, 0.3, 7.3, 0.35, 0.3, 0.35, 'trim', true, false); // nightstand
box(-8, 0.9, 12.4, 0.8, 0.9, 0.4, 'dark'); // wardrobe locker
box(-8, 0.4, 6.2, 0.8, 0.4, 0.35, 'trim', true, false); // vanity desk
box(-8, 0.45, 7.0, 0.25, 0.45, 0.25, 'dark', true, false); // chair

// Port Dining Room:
box(-1, 0.375, -9.25, 0.8, 0.375, 0.45, 'trim', true, false); // dining table
box(-1, 0.45, -8.1, 0.25, 0.45, 0.25, 'dark', true, false); // dining chair
box(-1, 0.45, -10.4, 0.25, 0.45, 0.25, 'dark', true, false); // dining chair
box(2, 0.45, -12.4, 0.9, 0.45, 0.35, 'trim'); // credenza sideboard

// Starboard Dining & Lounge:
box(-1, 0.375, 7.5, 0.8, 0.375, 0.45, 'trim', true, false); // dining table
box(-1, 0.45, 6.4, 0.25, 0.45, 0.25, 'dark', true, false); // dining chair
box(-1, 0.45, 8.6, 0.25, 0.45, 0.25, 'dark', true, false); // dining chair
box(-1, 1.5, 12.6, 1.8, 0.5, 0.2, 'dark', true, false); // back bar shelving

// Port Gym (Forward):
slab(4.2, 13.8, -12.7, -5.8, 0.02, 0.02, 'dark', true, false); // floor mat
box(7, 0.5, -11.8, 0.9, 0.5, 0.4, 'metal'); // treadmill
box(10, 0.5, -11.8, 0.9, 0.5, 0.4, 'metal'); // treadmill
box(8.5, 0.25, -8.8, 0.7, 0.25, 0.3, 'dark', true, false); // weight bench
box(12.5, 0.75, -12.4, 0.8, 0.75, 0.35, 'metal'); // dumbbell rack
box(6, 0.6, -6.5, 0.25, 0.6, 0.25, 'red', true, false); // water cooler

// Starboard Gym (Forward):
slab(4.2, 13.8, 5.8, 12.7, 0.02, 0.02, 'dark', true, false); // floor mat
box(10, 0.5, 11.8, 0.9, 0.5, 0.4, 'metal'); // treadmill
box(12, 0.5, 11.8, 0.9, 0.5, 0.4, 'metal'); // treadmill
box(8.5, 0.25, 8.8, 0.7, 0.25, 0.3, 'dark', true, false); // workout bench
box(12.5, 0.75, 6.5, 0.8, 0.75, 0.35, 'metal'); // weight rack
box(6, 0.5, 6.5, 0.4, 0.5, 0.25, 'metal'); // exercise bike

// Bridge Interior Props (Upper deck X in [6, 14], y = 3.4):
box(12.8, 4.0, 0, 0.6, 0.55, 1.2, 'metal'); // helm console
box(11.4, 4.0, 0, 0.3, 0.55, 0.3, 'dark', true, false); // captain chair
box(11.4, 4.0, -2.4, 0.3, 0.55, 0.3, 'dark', true, false); // officer chair
box(11.4, 4.0, 2.4, 0.3, 0.55, 0.3, 'dark', true, false); // officer chair
box(9.2, 3.85, 0, 1.0, 0.45, 1.5, 'trim', true, false); // central chart table
box(7.5, 4.3, 5.5, 0.6, 0.9, 0.4, 'dark'); // radio rack
box(7.5, 4.3, -5.5, 0.6, 0.9, 0.4, 'dark'); // radar console

// Engine Room Machinery Boxes (y = -2.8):
box(-18, -2.1, 1.8, 2.0, 0.7, 0.8, 'dark'); // turbine generator
box(-18, -2.1, -1.8, 2.0, 0.7, 0.8, 'dark'); // turbine generator
box(-8, -2.1, 1.8, 2.0, 0.7, 0.8, 'metal'); // compressor unit
box(-8, -2.1, -1.8, 2.0, 0.7, 0.8, 'metal'); // compressor unit
box(2, -2.1, 1.8, 2.0, 0.7, 0.8, 'dark'); // generator block
box(2, -2.1, -1.8, 2.0, 0.7, 0.8, 'dark'); // generator block
box(19, -2.0, 0, 1.8, 0.8, 2.2, 'metal'); // main auxiliary power plant
box(22, -1.9, 3.2, 0.8, 0.9, 1.2, 'dark'); // switchboard console
box(22, -1.9, -3.2, 0.8, 0.9, 1.2, 'dark'); // power transformer

// Container Bay (Foredeck Cargo Area X in [15, 25]):
box(19.5, 1.25, 6.5, 2.8, 1.25, 1.2, 'blue'); // blue shipping container
box(19.5, 1.25, -6.5, 2.8, 1.25, 1.2, 'red'); // red shipping container
box(16.5, 0.5, 4.5, 0.6, 0.5, 0.6, 'metal'); // cargo crate stack
box(16.5, 0.5, -4.5, 0.6, 0.5, 0.6, 'metal'); // cargo crate stack
box(22.5, 0.4, 3.2, 0.7, 0.4, 0.7, 'trim'); // wood pallet stack
box(22.5, 0.4, -3.2, 0.7, 0.4, 0.7, 'trim'); // wood pallet stack
box(23.5, 0.8, 0, 0.5, 0.8, 1.1, 'dark'); // container forklift

// Pool Loungers & Deck Furniture:
box(0.5, 0.2, -4.2, 0.45, 0.2, 0.9, 'trim', true, false);
box(3.0, 0.2, -4.2, 0.45, 0.2, 0.9, 'trim', true, false);
box(5.5, 0.2, -4.2, 0.45, 0.2, 0.9, 'trim', true, false);
box(0.5, 0.2, 4.2, 0.45, 0.2, 0.9, 'trim', true, false);
box(3.0, 0.2, 4.2, 0.45, 0.2, 0.9, 'trim', true, false);
box(5.5, 0.2, 4.2, 0.45, 0.2, 0.9, 'trim', true, false);

// Aft Deck Seating:
box(-28, 0.35, 4.5, 0.9, 0.35, 0.45, 'red', true, false); // lounge couch
box(-28, 0.35, -4.5, 0.9, 0.35, 0.45, 'red', true, false); // lounge couch
box(-30, 0.25, 0, 0.6, 0.25, 0.6, 'trim', true, false); // deck coffee table

export const OCC = BOXES.filter((b) => b.occlude && b.collide);
export const COLL = BOXES.filter((b) => b.collide);
export const POOL_BOUNDS = { x1: -2, x2: 8, z1: -2.5, z2: 2.5 };

// ---------------------------------------------------------------------------
// Raycasts
// ---------------------------------------------------------------------------
export interface WorldRayHit { t: number; nx: number; ny: number; nz: number }

export function rayWorld(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, maxT: number): WorldRayHit | null {
  let bt = maxT;
  let bnx = 0, bny = 0, bnz = 0;
  let found = false;
  for (const b of OCC) {
    const mnx = b.x - b.hx, mxx = b.x + b.hx;
    const mny = b.y - b.hy, mxy = b.y + b.hy;
    const mnz = b.z - b.hz, mxz = b.z + b.hz;
    let tmin = 0.0001, tmax = bt, axis = -1, sign = 0;
    let hit = true;
    const o = [ox, oy, oz], d = [dx, dy, dz];
    const mn = [mnx, mny, mnz], mx = [mxx, mxy, mxz];
    for (let a = 0; a < 3; a++) {
      if (Math.abs(d[a]) < 1e-9) {
        if (o[a] < mn[a] || o[a] > mx[a]) { hit = false; break; }
      } else {
        let t1 = (mn[a] - o[a]) / d[a];
        let t2 = (mx[a] - o[a]) / d[a];
        let s = -1;
        if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; s = 1; }
        if (t1 > tmin) { tmin = t1; axis = a; sign = s; }
        if (t2 < tmax) tmax = t2;
        if (tmin > tmax) { hit = false; break; }
      }
    }
    if (hit && axis >= 0 && tmin < bt) {
      bt = tmin;
      bnx = axis === 0 ? sign : 0;
      bny = axis === 1 ? sign : 0;
      bnz = axis === 2 ? sign : 0;
      found = true;
    }
  }
  return found ? { t: bt, nx: bnx, ny: bny, nz: bnz } : null;
}

export function losBlocked(ax: number, ay: number, az: number, bx: number, by: number, bz: number): boolean {
  const dx = bx - ax, dy = by - ay, dz = bz - az;
  const dist = Math.hypot(dx, dy, dz);
  if (dist < 0.01) return false;
  return rayWorld(ax, ay, az, dx / dist, dy / dist, dz / dist, dist - 0.05) !== null;
}

// ---------------------------------------------------------------------------
// Navigation graph
// ---------------------------------------------------------------------------
export const NAV: Array<[number, number, number]> = [
  [-34, 0, -8], [-34, 0, 8], [-22, 0, 0], [-18, 0, -10], [-18, 0, 10],
  [-35, -2.8, 0], [-27, -2.8, -2.5], [-24.5, -1.2, -2.5], [-22, 0, -2.5],
  [-13, 0, 0], [-9, 0, 3.9], [3, 0, 3.9], [12, 0, 3.9], [-9, 0, -3.9], [3, 0, -3.9], [12, 0, -3.9],
  [-8, 0, 9], [4, 0, 9], [-8, 0, -9], [4, 0, -9],
  [19, 0, -9], [19, 0, 9], [19, 0, 0], [31, 0, 0],
  [21, 0, 6], [21, 0, -6], [24.8, 2.4, 6], [24.8, 2.4, -6], [34, 2.4, 6], [34, 2.4, -6],
  [-12, 3.4, 0], [-12, 3.4, 9], [-12, 3.4, -9], [-5, 3.4, 9.7], [-5, 3.4, -9.7],
  [2, 3.4, 9.7], [2, 3.4, -9.7], [9, 3.4, 0], [11.4, 3.4, -6.7], [13.5, 3.4, -7.7],
  [-17.5, 1.7, 9], [-17.5, 1.7, -9],
  [-12, 0, 5.35], [-12, 0, -5.35], [10, 0, 5.35], [10, 0, -5.35],
  [-16, 0, 8.25], [-16, 0, -8.25], [14, 0, 8.25], [14, 0, -8.25],
  [11, 0, 0], [14, 0, 0],
  [5.6, 3.4, 0], [8.6, 0, -8.6],
  // ---- Phase 3 NAV Additions (Indices 54..79) ----
  [-11, 0, -9.25],   // 54: Port Bedroom center
  [-1, 0, -9.25],    // 55: Port Dining center
  [9, 0, -9.25],     // 56: Port Gym center
  [-11, 0, 9.25],    // 57: Starboard Bedroom center
  [-1, 0, 9.25],     // 58: Starboard Dining / Bar center
  [9, 0, 9.25],      // 59: Starboard Gym center
  [10, 3.4, 0],      // 60: Bridge Interior center
  [12.2, 3.4, 0],    // 61: Bridge Helm Window
  [-20, -2.8, 0],    // 62: Engine Room Tunnel Aft-Mid
  [-13, -2.8, 0],    // 63: Engine Room Tunnel Mid
  [-6, -2.8, 0],     // 64: Engine Room Tunnel Center
  [1, -2.8, 0],      // 65: Engine Room Tunnel Fwd-Mid
  [8, -2.8, 0],      // 66: Engine Room Tunnel Fwd
  [14.8, -2.8, 0],   // 67: Engine Room Fwd Stair Bottom
  [18.5, 0, 0],      // 68: Engine Room Fwd Stair Top (foredeck hatch)
  [18, -2.8, 2.5],   // 69: Engine Room Fwd Machinery Bay
  [-32, -1.3, -9.5], // 70: Engine Room Catwalk Port
  [-32, -1.3, 9.5],  // 71: Engine Room Catwalk Starboard
  [16.5, 0, 0],      // 72: Container Bay Aft / Walkway
  [19, 0, -4.5],     // 73: Container Bay Port
  [19, 0, 4.5],      // 74: Container Bay Starboard
  [-39, -1.5, 0],    // 75: Swim Platform Center
  [-38.2, -0.75, -8],// 76: Transom Steps Port
  [-38.2, -0.75, 8], // 77: Transom Steps Starboard
  [11.4, 3.4, 6.7],  // 78: Upper Deck Stair Top Starboard
  [8.6, 0, 8.6],     // 79: Upper Deck Stair Bottom Starboard
];
export const NAV_LINKS: Array<[number, number]> = [
  [0, 1], [0, 2], [1, 2], [0, 3], [1, 4], [2, 3], [2, 4], [2, 8],
  [3, 41], [4, 40], [40, 31], [41, 32],
  [5, 6], [6, 7], [7, 8],
  [2, 9], [9, 10], [9, 13], [9, 42], [9, 43], [42, 16], [42, 10], [43, 18], [43, 13],
  [10, 11], [13, 14], [11, 44], [14, 45], [44, 17], [44, 12], [45, 19], [45, 15],
  [44, 48], [45, 49], [16, 17], [18, 19], [17, 44], [19, 45],
  [4, 46], [46, 16], [3, 47], [47, 18],
  [11, 12], [14, 15], [51, 12], [51, 15], [51, 50], [50, 22],
  [20, 21], [20, 22], [20, 49], [21, 48], [22, 23],
  [22, 24], [22, 25], [24, 26], [25, 27], [26, 28], [27, 29], [28, 29],
  [30, 31], [30, 32], [30, 33], [30, 34], [31, 33], [32, 34], [33, 35], [34, 36], [35, 36],
  [35, 52], [36, 52], [52, 37], [38, 36], [38, 39], [39, 53], [53, 19], [53, 18],
  // ---- Phase 3 NAV_LINKS Additions ----
  // Port room links
  [54, 47], [54, 43], [54, 18],
  [18, 55], [55, 19],
  [19, 56], [56, 45], [56, 49], [56, 53],
  // Starboard room links
  [57, 46], [57, 42], [57, 16],
  [16, 58], [58, 17],
  [17, 59], [59, 44], [59, 48], [59, 79],
  // Starboard upper stairs
  [79, 78], [78, 35], [78, 37],
  // Bridge interior
  [37, 60], [60, 61],
  // Engine room tunnel & stairs
  [6, 62], [62, 63], [63, 64], [64, 65], [65, 66], [66, 67],
  [67, 68], [67, 69], [68, 72], [68, 22], [51, 72], [72, 22],
  // Engine room catwalks
  [5, 70], [5, 71],
  // Container bay
  [20, 73], [73, 22], [21, 74], [74, 22],
  // Swim platform & transom
  [0, 76], [76, 75], [1, 77], [77, 75],
];

const ADJ: number[][] = NAV.map(() => []);
for (const [a, b] of NAV_LINKS) { ADJ[a].push(b); ADJ[b].push(a); }

export function nearestNode(x: number, y: number, z: number): number {
  let best = 0, bd = 1e9;
  for (let i = 0; i < NAV.length; i++) {
    const d = (NAV[i][0] - x) ** 2 + ((NAV[i][1] - y) * 2) ** 2 + (NAV[i][2] - z) ** 2;
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}

export function navPath(from: number, to: number): number[] {
  if (from === to) return [to];
  const prev = new Array<number>(NAV.length).fill(-1);
  const seen = new Array<boolean>(NAV.length).fill(false);
  const q = [from];
  seen[from] = true;
  while (q.length) {
    const n = q.shift()!;
    for (const m of ADJ[n]) {
      if (seen[m]) continue;
      seen[m] = true;
      prev[m] = n;
      if (m === to) {
        const path: number[] = [];
        let c = to;
        while (c !== from && c !== -1) { path.unshift(c); c = prev[c]; }
        return path;
      }
      q.push(m);
    }
  }
  return [];
}

export const SPAWNS: Array<[number, number, number]> = [
  // Phase 2 spawns (indices 0..7)
  [-33, 0, -8], [-33, 0, 8], [19, 0, -9], [19, 0, 9],
  [34, 2.4, -6], [34, 2.4, 6], [-12, 3.4, -9], [-12, 3.4, 9],
  // Phase 3 spawns (indices 8..17)
  [-11, 0, -8.0],   // 8: Port Bedroom
  [-11, 0, 8.0],    // 9: Starboard Bedroom
  [-3.5, 0, -8.5],  // 10: Port Dining
  [-3.5, 0, 8.5],   // 11: Starboard Dining
  [6.5, 0, -8.5],   // 12: Port Gym
  [6.5, 0, 8.5],    // 13: Starboard Gym
  [9.5, 3.4, -1.8], // 14: Bridge Interior
  [-34, -2.8, 0],   // 15: Engine Room Aft
  [12, -2.8, 0],    // 16: Engine Room Fwd Bay
  [16.5, 0, 2.5],   // 17: Container Bay
];

// ---------------------------------------------------------------------------
// React scene
// ---------------------------------------------------------------------------
let causticTexture: THREE.CanvasTexture | null = null;
function getCausticTexture(): THREE.CanvasTexture {
  if (causticTexture) return causticTexture;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 256;
  const ctx = cv.getContext('2d')!;
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, 256, 256);

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.lineWidth = 4;
  for (let i = 0; i < 36; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const r = 14 + Math.random() * 26;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
  for (let i = 0; i < 50; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const r = 8 + Math.random() * 16;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  causticTexture = new THREE.CanvasTexture(cv);
  causticTexture.wrapS = causticTexture.wrapT = THREE.RepeatWrapping;
  causticTexture.colorSpace = THREE.SRGBColorSpace;
  return causticTexture;
}

export function MapMeshes(): JSX.Element {
  const quality = useGameStore((s) => s.settings.quality);
  const waterRef = useRef<THREE.Mesh>(null);

  const poolWaterMat = useMemo(() => new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uCausticMap: { value: getCausticTexture() },
      uTime: { value: 0 },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vViewPos;
      varying vec3 vNormal;
      void main() {
        vUv = uv;
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        vViewPos = -mvPos.xyz;
        vNormal = normalMatrix * normal;
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: `
      uniform sampler2D uCausticMap;
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vViewPos;
      varying vec3 vNormal;

      void main() {
        // Two scrolling copies of procedural noise texture, additively blended at low opacity
        vec2 uv1 = vUv * 3.6 + vec2(uTime * 0.035, uTime * 0.022);
        vec2 uv2 = vUv * 4.4 + vec2(-uTime * 0.028, uTime * 0.032);
        float c1 = texture2D(uCausticMap, uv1).r;
        float c2 = texture2D(uCausticMap, uv2).r;
        float caustics = (c1 + c2) * 0.35;

        // Base transparent pool water
        vec3 waterCol = vec3(0.52, 0.85, 0.94);
        waterCol += vec3(caustics * 0.45);

        // Fresnel-ish edge brightening where water meets pool coping (pool 9.8m x 4.8m)
        float edgeX = min(vUv.x, 1.0 - vUv.x) * 9.8;
        float edgeY = min(vUv.y, 1.0 - vUv.y) * 4.8;
        float edgeDist = min(edgeX, edgeY);
        float edgeBright = smoothstep(0.40, 0.02, edgeDist) * 0.38;

        // View-angle Fresnel brightening
        vec3 V = normalize(vViewPos);
        vec3 N = normalize(vNormal);
        float fresnel = pow(1.0 - max(dot(N, V), 0.0), 3.0) * 0.35;

        waterCol += vec3(edgeBright + fresnel);

        gl_FragColor = vec4(waterCol, 0.72);
      }
    `,
  }), []);

  const merged = useMemo(() => {
    const groups = new Map<string, THREE.BufferGeometry[]>();
    for (const b of BOXES) {
      const g = new THREE.BoxGeometry(b.hx * 2, b.hy * 2, b.hz * 2);
      g.translate(b.x, b.y, b.z);
      const arr = groups.get(b.mat) ?? [];
      arr.push(g);
      groups.set(b.mat, arr);
    }
    const out: Array<{ mat: string; geo: THREE.BufferGeometry }> = [];
    for (const [mat, arr] of groups) {
      const mergedGeo = arr.length > 1 ? mergeGeometries(arr, false) : arr[0];
      out.push({ mat, geo: mergedGeo });
      if (arr.length > 1) arr.forEach((g) => g.dispose());
    }
    return out;
  }, []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    poolWaterMat.uniforms.uTime.value = t;
    const w = waterRef.current;
    if (w) {
      // Small vertical bob (±0.02m) driven by sin(time * 0.8) without moving walls or floor
      w.position.y = -0.35 + Math.sin(t * 0.8) * 0.02;
    }
  });

  const interiorLights: Array<[number, number, number]> = quality === 'low'
    ? [[-5, 2.6, 9], [10, 5.9, 0]]
    : quality === 'med'
      ? [[-5, 2.6, 9], [-5, 2.6, -9], [10, 5.9, 0], [31, 1.8, 0]]
      : [[-5, 2.6, 9], [-5, 2.6, -9], [10, 5.9, 0], [-31, -1, 0], [31, 1.8, 0], [19, 2.5, 0]];

  return (
    <group>
      {/* Procedural enhanced sky with FBM clouds, sun bloom, and seagulls */}
      <Sky />
      {/* Procedural wave displaced ocean with foam ring and horizon haze */}
      <Ocean />
      {/* static geometry, merged per material */}
      {merged.map(({ mat, geo }, i) => (
        <mesh key={i} geometry={geo} material={getMat(mat)} castShadow={quality === 'high'} receiveShadow={quality === 'high'} />
      ))}
      {/* pool water with caustics, bobbing, and edge brightening */}
      <mesh ref={waterRef} rotation={[-Math.PI / 2, 0, 0]} position={[3, -0.35, 0]}>
        <planeGeometry args={[9.8, 4.8]} />
        <primitive object={poolWaterMat} attach="material" />
      </mesh>
      {/* lights */}
      <hemisphereLight args={['#cfe8ff', '#3a4a5a', 0.9]} />
      <directionalLight
        position={[SUN_DIRECTION.x * 112.25, SUN_DIRECTION.y * 112.25, SUN_DIRECTION.z * 112.25]}
        intensity={1.9}
        color="#fff1d6"
        castShadow={quality === 'high'}
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-70}
        shadow-camera-right={70}
        shadow-camera-top={70}
        shadow-camera-bottom={-70}
        shadow-camera-far={260}
      />
      <directionalLight position={[-40, 30, -50]} intensity={0.35} color="#7fb0ff" />
      {interiorLights.map(([x, y, z], i) => (
        <pointLight key={i} position={[x, y, z]} intensity={12} distance={15} decay={2} color="#ffd9a0" />
      ))}
      {interiorLights.map(([x, y, z], i) => (
        <mesh key={`l${i}`} position={[x, y + 0.25, z]} material={getMat('lamp')}>
          <boxGeometry args={[0.5, 0.1, 0.5]} />
        </mesh>
      ))}
      {/* rapier colliders */}
      <RigidBody type="fixed" colliders={false}>
        {COLL.map((b, i) => (
          <CuboidCollider key={i} args={[b.hx, b.hy, b.hz]} position={[b.x, b.y, b.z]} />
        ))}
      </RigidBody>
    </group>
  );
}
