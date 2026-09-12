import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { registerTick } from './systems';
import { particles, tracers, fxTick, fxLight } from './fx';
import { T } from '../store/transient';

const DUMMY = new THREE.Object3D();

/** Pooled instanced tracers + billboard particles + dynamic lights. */
export function Effects(): JSX.Element {
  const tracerRef = useRef<THREE.InstancedMesh>(null);
  const partRef = useRef<THREE.InstancedMesh>(null);
  const muzzleLight = useRef<THREE.PointLight>(null);
  const boomLight = useRef<THREE.PointLight>(null);
  const camera = useThree((s) => s.camera);

  const tg = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const tm = useMemo(() => new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }), []);
  const pg = useMemo(() => new THREE.PlaneGeometry(0.07, 0.07), []);
  const pm = useMemo(() => new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), []);

  useEffect(() => registerTick(fxTick), []);

  useFrame(() => {
    const tr = tracerRef.current;
    if (tr) {
      for (let i = 0; i < tracers.length; i++) {
        const t = tracers[i];
        if (!t.active) { DUMMY.scale.set(0, 0, 0); DUMMY.position.set(0, -100, 0); DUMMY.rotation.set(0, 0, 0); }
        else {
          const len = t.from.distanceTo(t.to);
          DUMMY.position.lerpVectors(t.from, t.to, 0.5);
          DUMMY.lookAt(t.to);
          DUMMY.scale.set(0.025, 0.025, len);
        }
        DUMMY.updateMatrix();
        tr.setMatrixAt(i, DUMMY.matrix);
        tr.setColorAt(i, t.color);
      }
      tr.instanceMatrix.needsUpdate = true;
      if (tr.instanceColor) tr.instanceColor.needsUpdate = true;
    }

    const pr = partRef.current;
    if (pr) {
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        if (!p.active) { DUMMY.scale.set(0, 0, 0); DUMMY.position.set(0, -100, 0); }
        else {
          DUMMY.position.copy(p.pos);
          DUMMY.quaternion.copy(camera.quaternion);
          const s = p.size * (0.4 + 0.6 * (p.life / p.max));
          DUMMY.scale.set(s, s, s);
        }
        DUMMY.updateMatrix();
        pr.setMatrixAt(i, DUMMY.matrix);
        pr.setColorAt(i, p.color);
      }
      pr.instanceMatrix.needsUpdate = true;
      if (pr.instanceColor) pr.instanceColor.needsUpdate = true;
    }

    if (muzzleLight.current) {
      muzzleLight.current.position.copy(T.viewmodel.muzzle);
      muzzleLight.current.intensity = T.viewmodel.flash * 26;
    }
    if (boomLight.current) {
      boomLight.current.position.copy(fxLight.pos);
      boomLight.current.intensity = fxLight.intensity;
    }
  });

  return (
    <group>
      <instancedMesh ref={tracerRef} args={[tg, tm, tracers.length]} frustumCulled={false} />
      <instancedMesh ref={partRef} args={[pg, pm, particles.length]} frustumCulled={false} />
      <pointLight ref={muzzleLight} color="#ffd9a0" distance={9} decay={2} intensity={0} />
      <pointLight ref={boomLight} color="#ffb36b" distance={22} decay={2} intensity={0} />
    </group>
  );
}
