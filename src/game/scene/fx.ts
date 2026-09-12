import * as THREE from 'three';

interface Particle {
  active: boolean;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  max: number;
  size: number;
  color: THREE.Color;
  grav: number;
  drag: number;
}
interface Tracer {
  active: boolean;
  from: THREE.Vector3;
  to: THREE.Vector3;
  life: number;
  color: THREE.Color;
}

const V = () => new THREE.Vector3();
const C = (hex: number) => new THREE.Color(hex);

export const particles: Particle[] = Array.from({ length: 320 }, () => ({
  active: false, pos: V(), vel: V(), life: 0, max: 1, size: 1, color: C(0xffffff), grav: 9, drag: 1,
}));
export const tracers: Tracer[] = Array.from({ length: 40 }, () => ({
  active: false, from: V(), to: V(), life: 0, color: C(0xffc36b),
}));

export const fxLight = { pos: V(), intensity: 0 };

let pHead = 0;
let tHead = 0;

function spawnParticle(pos: THREE.Vector3, vel: THREE.Vector3, color: THREE.Color, life: number, size: number, grav: number, drag: number): void {
  const p = particles[pHead];
  pHead = (pHead + 1) % particles.length;
  p.active = true;
  p.pos.copy(pos);
  p.vel.copy(vel);
  p.color.copy(color);
  p.life = life;
  p.max = life;
  p.size = size;
  p.grav = grav;
  p.drag = drag;
}

export const FX = {
  tracer(from: THREE.Vector3, to: THREE.Vector3, color: number): void {
    const t = tracers[tHead];
    tHead = (tHead + 1) % tracers.length;
    t.active = true;
    t.from.copy(from);
    t.to.copy(to);
    t.life = 0.07;
    t.color.set(color);
  },

  impact(pos: THREE.Vector3, n: THREE.Vector3): void {
    const c = C(0xffd27a);
    for (let i = 0; i < 6; i++) {
      const v = new THREE.Vector3((Math.random() - 0.5) * 5, Math.random() * 3, (Math.random() - 0.5) * 5).addScaledVector(n, 3);
      spawnParticle(pos, v, c, 0.3 + Math.random() * 0.2, 0.7, 12, 2);
    }
  },

  confetti(pos: THREE.Vector3, count: number, head: boolean): void {
    for (let i = 0; i < count; i++) {
      const c = C(Math.floor(Math.random() * 0xffffff));
      const v = new THREE.Vector3((Math.random() - 0.5) * 7, 2 + Math.random() * 5, (Math.random() - 0.5) * 7);
      spawnParticle(pos, v, c, 0.5 + Math.random() * 0.5, 1.2 + (head ? 0.8 : 0), 8, 1.2);
    }
  },

  splash(pos: THREE.Vector3): void {
    const c = C(0xbfe9ff);
    for (let i = 0; i < 12; i++) {
      const v = new THREE.Vector3((Math.random() - 0.5) * 3, 2.5 + Math.random() * 3, (Math.random() - 0.5) * 3);
      spawnParticle(pos, v, c, 0.5, 1.1, 11, 1);
    }
  },

  explosion(pos: THREE.Vector3): void {
    const fire = C(0xff9a3c);
    const smoke = C(0x555a60);
    for (let i = 0; i < 40; i++) {
      const v = new THREE.Vector3((Math.random() - 0.5) * 16, Math.random() * 9, (Math.random() - 0.5) * 16);
      spawnParticle(pos, v, i % 3 === 0 ? C(0xffe08a) : fire, 0.4 + Math.random() * 0.5, 2.4, 7, 2.4);
    }
    for (let i = 0; i < 12; i++) {
      const v = new THREE.Vector3((Math.random() - 0.5) * 5, 1 + Math.random() * 4, (Math.random() - 0.5) * 5);
      spawnParticle(pos, v, smoke, 1.2 + Math.random(), 3.5, -1.5, 0.8);
    }
    fxLight.pos.copy(pos);
    fxLight.intensity = 90;
  },
};

export function fxTick(dt: number): void {
  for (const p of particles) {
    if (!p.active) continue;
    p.life -= dt;
    if (p.life <= 0) { p.active = false; continue; }
    p.vel.y -= p.grav * dt;
    p.vel.multiplyScalar(Math.max(0, 1 - p.drag * dt));
    p.pos.addScaledVector(p.vel, dt);
  }
  for (const t of tracers) {
    if (!t.active) continue;
    t.life -= dt;
    if (t.life <= 0) t.active = false;
  }
  fxLight.intensity = Math.max(0, fxLight.intensity - dt * 260);
}

export function fxReset(): void {
  particles.forEach((p) => { p.active = false; });
  tracers.forEach((t) => { t.active = false; });
  fxLight.intensity = 0;
}
