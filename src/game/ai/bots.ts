import * as THREE from 'three';
import { NAV, SPAWNS, navPath, nearestNode, losBlocked } from '../scene/Map';
import { useGameStore, type Mode } from '../store/gameStore';
import { T } from '../store/transient';
import { P } from '../player/playerState';
import { FX } from '../scene/fx';
import { SFX } from '../audio/AudioEngine';
import { shuffle, angleDamp, rand, clamp } from '../utils/MathUtils';
import { atten } from '../audio/Attenuation';
import { bus } from '../utils/Bus';

export interface Bot {
  id: string;
  name: string;
  team: number;
  hue: number;
  pos: THREE.Vector3;   // feet position
  prevPos: THREE.Vector3;
  yaw: number;
  hp: number;
  alive: boolean;
  state: 'patrol' | 'hunt' | 'combat';
  path: number[];
  pathI: number;
  repathT: number;
  thinkT: number;
  targetId: string;
  reactT: number;
  lostT: number;
  strafeT: number;
  strafeDir: number;
  burst: number;
  burstCd: number;
  shotCd: number;
  ammo: number;
  reloadT: number;
  respawnT: number;
  flash: number;
  lastShotAt: number;
  deathT: number;
  lastKnown: THREE.Vector3 | null;
}

const NAMES = [
  'xX_SlopLord_Xx', 'GrindsetGary', 'YachtZealot', 'DolphinDiver', 'MidLadderMatt',
  'CaptchaCarl', 'VibeInspectah', 'TouchGrassTim', 'PPT_King', '404_AimNotFound',
];
const HUES = [0.02, 0.55, 0.12, 0.75, 0.95, 0.42, 0.65, 0.3];

export const bots: Bot[] = [];

function makeBot(i: number, name: string, team: number): Bot {
  return {
    id: 'b' + i, name, team, hue: HUES[i % HUES.length],
    pos: new THREE.Vector3(), prevPos: new THREE.Vector3(),
    yaw: 0, hp: 100, alive: true, state: 'patrol',
    path: [], pathI: 0, repathT: 0, thinkT: Math.random() * 0.3,
    targetId: '', reactT: 0, lostT: 0, strafeT: 0, strafeDir: 1,
    burst: 0, burstCd: rand(0.4, 1.2), shotCd: 0, ammo: 26, reloadT: 0,
    respawnT: 0, flash: 0, lastShotAt: -99, deathT: 0,
    lastKnown: null,
  };
}

function botSpawn(b: Bot): void {
  let best = SPAWNS[0], bestD = -1;
  for (const sp of [...SPAWNS].sort(() => Math.random() - 0.5).slice(0, 4)) {
    let minD = 1e9;
    const enemies = liveEnemiesOf(b);
    for (const e of enemies) {
      const p = e.pos;
      minD = Math.min(minD, Math.hypot(sp[0] - p.x, sp[2] - p.z));
    }
    if (minD > bestD) { bestD = minD; best = sp; }
  }
  b.pos.set(best[0], best[1], best[2]);
  b.prevPos.copy(b.pos);
}

interface Target { id: string; pos: THREE.Vector3; team: number; bot: Bot | null }

function liveEnemiesOf(b: Bot): Target[] {
  const out: Target[] = [];
  const mode = useGameStore.getState().mode;
  if (P.alive && (mode === 'ffa' || 0 !== b.team)) {
    out.push({ id: 'player', pos: T.player.pos, team: 0, bot: null });
  }
  for (const o of bots) {
    if (o === b || !o.alive) continue;
    if (mode !== 'ffa' && o.team === b.team) continue;
    out.push({ id: o.id, pos: o.pos, team: o.team, bot: o });
  }
  return out;
}

function findTarget(b: Bot): Target | null {
  const eye = new THREE.Vector3(b.pos.x, b.pos.y + 1.5, b.pos.z);
  let best: Target | null = null;
  let bd = 1e9;
  for (const e of liveEnemiesOf(b)) {
    const d = e.pos.distanceTo(b.pos);
    if (d > 50 || d >= bd) continue;
    const ty = e.id === 'player' ? 0.6 : 1.4;
    if (losBlocked(eye.x, eye.y, eye.z, e.pos.x, e.pos.y + ty, e.pos.z)) continue;
    bd = d;
    best = e;
  }
  return best;
}

function setPathTo(b: Bot, x: number, y: number, z: number): void {
  b.path = navPath(nearestNode(b.pos.x, b.pos.y, b.pos.z), nearestNode(x, y, z));
  b.pathI = 0;
  b.repathT = rand(1.0, 1.6);
}

function botShoot(b: Bot, tgt: Target, dist: number): void {
  b.shotCd = rand(0.11, 0.17);
  b.burst--;
  b.ammo--;
  if (b.ammo <= 0) { b.reloadT = 2.2; b.burst = 0; }
  if (b.burst <= 0) b.burstCd = rand(0.8, 1.7);

  const muzzle = new THREE.Vector3(
    b.pos.x + Math.sin(b.yaw) * 0.5,
    b.pos.y + 1.4,
    b.pos.z + Math.cos(b.yaw) * 0.5
  );
  const tgtEye = new THREE.Vector3(tgt.pos.x, tgt.pos.y + (tgt.id === 'player' ? 0.6 : 1.4), tgt.pos.z);

  const tSpeed = tgt.id === 'player' ? T.player.speed : 4;
  const chance = clamp(0.6 - dist * 0.008 - tSpeed * 0.028 + (T.player.ads > 0.5 ? -0.05 : 0), 0.08, 0.85);
  const hit = Math.random() < chance;

  const aim = tgtEye.clone();
  if (!hit) aim.add(new THREE.Vector3(rand(-1.2, 1.2), rand(-0.6, 0.9), rand(-1.2, 1.2)));

  FX.tracer(muzzle, aim, b.team === 0 ? 0x7fc4ff : 0xff8f6b);
  b.flash = 0.06;
  b.lastShotAt = performance.now();

  const l = { pos: T.cam.pos, yaw: T.cam.yaw };
  const { gain, pan } = atten(l, muzzle);
  if (gain > 0.03) {
    SFX.shot({ soundBody: 150, soundBright: 1100, soundDur: 0.11 }, Math.hypot(muzzle.x - l.pos.x, muzzle.z - l.pos.z), pan);
  }

  if (hit) {
    const dmg = 11 * clamp(1 - dist / 60, 0.5, 1);
    if (tgt.id === 'player') {
      P.damage(dmg, b.pos, b.id);
    } else if (tgt.bot) {
      damageBot(tgt.bot, dmg, false, b.id, 'RIFLE');
    }
  }
}

export function botsTick(dt: number): void {
  // Pairwise separation.
  for (let i = 0; i < bots.length; i++) {
    const a = bots[i];
    if (!a.alive) continue;
    for (let j = i + 1; j < bots.length; j++) {
      const b = bots[j];
      if (!b.alive) continue;
      const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.9 && d > 0.001) {
        const push = (0.9 - d) / 2;
        a.pos.x -= (dx / d) * push; a.pos.z -= (dz / d) * push;
        b.pos.x += (dx / d) * push; b.pos.z += (dz / d) * push;
      }
    }
  }

  for (const b of bots) {
    b.flash = Math.max(0, b.flash - dt);

    if (!b.alive) {
      b.deathT += dt;
      b.respawnT -= dt;
      if (b.respawnT <= 0) {
        b.alive = true;
        b.hp = 100;
        b.state = 'patrol';
        b.path = [];
        b.targetId = '';
        b.ammo = 26;
        botSpawn(b);
      }
      continue;
    }
    b.prevPos.copy(b.pos);

    if (b.reloadT > 0) { b.reloadT -= dt; if (b.reloadT <= 0) b.ammo = 26; }

    // --- perception (throttled) ---
    b.thinkT -= dt;
    if (b.thinkT <= 0) {
      b.thinkT = rand(0.18, 0.3);
      const found = findTarget(b);
      if (found) {
        if (b.targetId !== found.id) { b.targetId = found.id; b.reactT = rand(0.28, 0.55); }
        b.state = 'combat';
        b.lostT = 0;
        b.lastKnown = new THREE.Vector3(found.pos.x, found.pos.y, found.pos.z);
      } else if (b.state === 'combat') {
        b.lostT += 0.25;
        if (b.lostT > 1.2) {
          b.state = 'hunt';
          b.targetId = '';
          if (b.lastKnown) setPathTo(b, b.lastKnown.x, b.lastKnown.y, b.lastKnown.z);
        }
      }
    }

    let moveX = 0, moveZ = 0;
    const speed = b.state === 'combat' ? 4.4 : 3.4;

    if (b.state === 'combat' && b.targetId) {
      const tgt = b.targetId === 'player'
        ? (P.alive ? { id: 'player', pos: T.player.pos, team: 0, bot: null } : null)
        : (() => { const o = bots.find((x) => x.id === b.targetId); return o && o.alive ? { id: o.id, pos: o.pos, team: o.team, bot: o } : null; })();
      if (!tgt) { b.state = 'patrol'; b.targetId = ''; }
      else {
        const dx = tgt.pos.x - b.pos.x, dz = tgt.pos.z - b.pos.z;
        const dist = Math.hypot(dx, dz);
        const desiredYaw = Math.atan2(dx, dz);
        b.yaw = angleDamp(b.yaw, desiredYaw, 8, dt);
        b.reactT -= dt;
        b.repathT -= dt;

        if (dist > 16) {
          if (b.repathT <= 0 || b.path.length === 0) setPathTo(b, tgt.pos.x, tgt.pos.y, tgt.pos.z);
        } else {
          b.strafeT -= dt;
          if (b.strafeT <= 0) { b.strafeT = rand(1.0, 2.0); b.strafeDir *= -1; }
          const px = -dz / (dist || 1), pz = dx / (dist || 1);
          moveX = px * b.strafeDir * speed;
          moveZ = pz * b.strafeDir * speed;
          b.path = [];
        }

        b.shotCd -= dt;
        b.burstCd -= dt;
        const eye = new THREE.Vector3(b.pos.x, b.pos.y + 1.5, b.pos.z);
        const tEye = new THREE.Vector3(tgt.pos.x, tgt.pos.y + (tgt.id === 'player' ? 0.6 : 1.4), tgt.pos.z);
        const aligned = Math.abs(((desiredYaw - b.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI) < 0.22;
        if (b.reactT <= 0 && aligned && dist < 44 && b.reloadT <= 0 && !losBlocked(eye.x, eye.y, eye.z, tEye.x, tEye.y, tEye.z)) {
          if (b.burst > 0 && b.shotCd <= 0) botShoot(b, tgt, dist);
          else if (b.burst <= 0 && b.burstCd <= 0) b.burst = 3 + Math.floor(Math.random() * 4);
        }
      }
    }

    // Path following (patrol / hunt / closing distance).
    if (b.repathT > 0) b.repathT -= dt;
    if ((b.state !== 'combat' || b.path.length > 0) && (b.path.length === 0 || b.pathI >= b.path.length)) {
      if (b.state === 'hunt') { b.state = 'patrol'; }
      if (b.state !== 'combat' && (b.path.length === 0 || b.pathI >= b.path.length)) {
        const dest = NAV[Math.floor(Math.random() * NAV.length)];
        setPathTo(b, dest[0], dest[1], dest[2]);
      }
    }
    if (b.path.length > 0 && b.pathI < b.path.length) {
      const n = NAV[b.path[b.pathI]];
      const dx = n[0] - b.pos.x, dz = n[2] - b.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.6) {
        b.pathI++;
      } else {
        const step = Math.min(speed * dt, d);
        moveX = (dx / d) * speed;
        moveZ = (dz / d) * speed;
        b.pos.x += (dx / d) * step;
        b.pos.z += (dz / d) * step;
        b.pos.y += (n[1] - b.pos.y) * (step / d);
        if (b.state !== 'combat') b.yaw = angleDamp(b.yaw, Math.atan2(dx, dz), 6, dt);
      }
    }

    if (moveX !== 0 || moveZ !== 0) {
      b.pos.x += moveX * dt;
      b.pos.z += moveZ * dt;
    }

    b.pos.x = clamp(b.pos.x, -40, 40);
    b.pos.z = clamp(b.pos.z, -13, 13);
  }
}

export function damageBot(b: Bot, dmg: number, head: boolean, killerId: string, weapon: string): void {
  if (!b.alive) return;
  b.hp -= dmg;
  if (killerId === 'player') {
    b.lastKnown = new THREE.Vector3(T.player.pos.x, T.player.pos.y, T.player.pos.z);
    if (b.state !== 'combat') { b.state = 'hunt'; setPathTo(b, b.pos.x, b.pos.y, b.pos.z); }
  }
  if (b.hp <= 0) {
    b.alive = false;
    b.respawnT = 3.5;
    b.deathT = 0;
    FX.confetti(new THREE.Vector3(b.pos.x, b.pos.y + 1, b.pos.z), 34, head);
    const st = useGameStore.getState();
    st.registerKill(killerId, b.id, head, weapon);
    if (killerId === 'player') bus.emit('kill', { head });
  }
}

export function initBots(mode: Mode): void {
  bots.length = 0;
  const names = shuffle(NAMES).slice(0, 7);
  const roster = [{ id: 'player', name: 'YOU', team: 0, kills: 0, deaths: 0 }];
  names.forEach((n, i) => {
    const team = mode === 'ffa' ? i + 1 : (i < 3 ? 0 : 1);
    const b = makeBot(i, n, team);
    botSpawn(b);
    bots.push(b);
    roster.push({ id: b.id, name: n, team, kills: 0, deaths: 0 });
  });
  useGameStore.getState().setRoster(roster);
}
