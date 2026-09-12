import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { registerTick } from './systems';
import { COLL, losBlocked } from './Map';
import { FX } from './fx';
import { T } from '../store/transient';
import { P } from '../player/playerState';
import { SFX } from '../audio/AudioEngine';
import { damageBot, bots } from '../ai/bots';

interface Nade {
  active: boolean;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  fuse: number;
  owner: string;
}

export const nades: Nade[] = Array.from({ length: 8 }, () => ({
  active: false, pos: new THREE.Vector3(), vel: new THREE.Vector3(), fuse: 0, owner: '',
}));

const FWD = new THREE.Vector3();

export function throwNade(): void {
  const n = nades.find((x) => !x.active);
  if (!n) return;
  FWD.set(0, 0, -1).applyQuaternion(T.cam.quat);
  n.active = true;
  n.owner = 'player';
  n.fuse = 2.4;
  n.pos.copy(T.cam.pos).addScaledVector(FWD, 0.45);
  n.vel.copy(FWD).multiplyScalar(15);
  n.vel.y += 3.6;
  n.vel.addScaledVector(T.player.vel, 0.6);
  SFX.throwNade();
}

function insideAny(x: number, y: number, z: number): boolean {
  for (const b of COLL) {
    if (Math.abs(x - b.x) <= b.hx + 0.09 && Math.abs(y - b.y) <= b.hy + 0.09 && Math.abs(z - b.z) <= b.hz + 0.09) return true;
  }
  return false;
}

function explode(pos: THREE.Vector3, owner: string): void {
  FX.explosion(pos);
  const pd = pos.distanceTo(T.player.pos);
  SFX.explosion(pd, 0);
  T.shake = Math.min(1, T.shake + Math.max(0, 0.9 - pd * 0.05));

  if (P.alive) {
    const eye = T.player.pos.clone(); eye.y += 0.5;
    const d = pos.distanceTo(eye);
    if (d < 6 && !losBlocked(pos.x, pos.y + 0.3, pos.z, eye.x, eye.y, eye.z)) {
      let dmg = 115 * (1 - d / 6);
      if (owner === 'player') dmg *= 0.55;
      P.damage(dmg, pos, owner === 'player' ? 'player' : owner);
    }
  }
  for (const b of bots) {
    if (!b.alive) continue;
    const eye = new THREE.Vector3(b.pos.x, b.pos.y + 1.4, b.pos.z);
    const d = pos.distanceTo(eye);
    if (d < 6 && !losBlocked(pos.x, pos.y + 0.3, pos.z, eye.x, eye.y, eye.z)) {
      damageBot(b, 115 * (1 - d / 6), false, owner, 'FRAG');
    }
  }
}

function nadesTick(dt: number): void {
  for (const n of nades) {
    if (!n.active) continue;
    n.fuse -= dt;
    if (n.fuse <= 0) {
      n.active = false;
      explode(n.pos, n.owner);
      continue;
    }
    n.vel.y -= 20 * dt;
    let nx = n.pos.x + n.vel.x * dt;
    if (insideAny(nx, n.pos.y, n.pos.z)) { n.vel.x *= -0.45; nx = n.pos.x; }
    let nz = n.pos.z + n.vel.z * dt;
    if (insideAny(nx, n.pos.y, nz)) { n.vel.z *= -0.45; nz = n.pos.z; }
    let ny = n.pos.y + n.vel.y * dt;
    if (insideAny(nx, ny, nz)) {
      if (n.vel.y < -3) SFX.tick(500, 0.03, 0.12, 'triangle');
      n.vel.y *= -0.38;
      n.vel.x *= 0.8;
      n.vel.z *= 0.8;
      ny = n.pos.y;
    }
    n.pos.set(nx, ny, nz);
  }
}

export function GrenadeView(): JSX.Element {
  const ref = useRef<THREE.InstancedMesh>(null);
  const g = useMemo(() => new THREE.SphereGeometry(0.09, 10, 8), []);
  const m = useMemo(() => new THREE.MeshStandardMaterial({ color: '#2e3b2a', roughness: 0.5, metalness: 0.4 }), []);
  const DUMMY = new THREE.Object3D();

  useEffect(() => registerTick(nadesTick), []);

  useFrame(() => {
    const im = ref.current;
    if (!im) return;
    for (let i = 0; i < nades.length; i++) {
      const n = nades[i];
      if (!n.active) { DUMMY.position.set(0, -100, 0); DUMMY.scale.set(0, 0, 0); }
      else {
        DUMMY.position.copy(n.pos);
        const pulse = n.fuse < 1 && Math.floor(n.fuse * 8) % 2 === 0 ? 1.4 : 1;
        DUMMY.scale.set(pulse, pulse, pulse);
      }
      DUMMY.updateMatrix();
      im.setMatrixAt(i, DUMMY.matrix);
    }
    im.instanceMatrix.needsUpdate = true;
  });

  return <instancedMesh ref={ref} args={[g, m, nades.length]} frustumCulled={false} />;
}
