import * as THREE from 'three';
import { rayWorld } from '../scene/Map';
import { bots, type Bot } from '../ai/bots';

export interface WorldHit { t: number; nx: number; ny: number; nz: number }
export interface BotHit { bot: Bot; t: number; head: boolean }
export interface FireHit {
  point: THREE.Vector3;
  bot: Bot | null;
  head: boolean;
  normal: THREE.Vector3;
  dist: number;
}

const _d = new THREE.Vector3();

/** Ray vs world AABB set (slab method). Returns nearest hit or null. */
export function raycastWorld(o: THREE.Vector3, dir: THREE.Vector3, maxT: number): WorldHit | null {
  return rayWorld(o.x, o.y, o.z, dir.x, dir.y, dir.z, maxT);
}

/** Ray vs bot hitboxes (3 body spheres + 1 head sphere). */
export function raycastBots(o: THREE.Vector3, dir: THREE.Vector3, maxT: number): BotHit | null {
  let best: BotHit | null = null;
  for (const b of bots) {
    if (!b.alive) continue;
    const ht = raySphere(o, dir, b.pos.x, b.pos.y + 1.56, b.pos.z, 0.27);
    if (ht >= 0 && ht <= maxT && (!best || ht < best.t)) best = { bot: b, t: ht, head: true };
    const offs: Array<[number, number]> = [[0.35, 0.34], [0.8, 0.42], [1.22, 0.38]];
    for (const [dy, r] of offs) {
      const bt = raySphere(o, dir, b.pos.x, b.pos.y + dy, b.pos.z, r);
      if (bt >= 0 && bt <= maxT && (!best || bt < best.t)) best = { bot: b, t: bt, head: false };
    }
  }
  return best;
}

function raySphere(o: THREE.Vector3, d: THREE.Vector3, cx: number, cy: number, cz: number, r: number): number {
  const ox = o.x - cx, oy = o.y - cy, oz = o.z - cz;
  const b = ox * d.x + oy * d.y + oz * d.z;
  const c = ox * ox + oy * oy + oz * oz - r * r;
  const disc = b * b - c;
  if (disc < 0) return -1;
  const t = -b - Math.sqrt(disc);
  return t > 0.01 ? t : -1;
}

/** Combined shot ray: world geometry vs bot hitboxes, nearest wins. */
export function fireRay(o: THREE.Vector3, dir: THREE.Vector3, maxT: number): FireHit | null {
  const wall = raycastWorld(o, dir, maxT);
  const wallT = wall ? wall.t : maxT;
  const botHit = raycastBots(o, dir, wallT);
  const t = botHit ? botHit.t : wallT;
  if (t >= maxT) return null;
  const point = new THREE.Vector3().copy(dir).multiplyScalar(t).add(o);
  const normal = botHit
    ? new THREE.Vector3().copy(_d.copy(point).sub(new THREE.Vector3(botHit.bot.pos.x, botHit.bot.pos.y + (botHit.head ? 1.56 : 0.8), botHit.bot.pos.z))).normalize()
    : new THREE.Vector3(wall!.nx, wall!.ny, wall!.nz);
  return { point, bot: botHit ? botHit.bot : null, head: botHit ? botHit.head : false, normal, dist: t };
}

export function falloffMult(def: { falloffStart: number; falloffEnd: number; falloffMin: number }, dist: number): number {
  if (dist <= def.falloffStart) return 1;
  if (dist >= def.falloffEnd) return def.falloffMin;
  const t = (dist - def.falloffStart) / (def.falloffEnd - def.falloffStart);
  return 1 - t * (1 - def.falloffMin);
}
