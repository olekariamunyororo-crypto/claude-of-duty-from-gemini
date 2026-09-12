import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { bus } from '../game/utils/Bus';
import { T } from '../game/store/transient';

interface DmgItem { active: boolean; pos: THREE.Vector3; t: number; amount: number; head: boolean }
const POOL = 12;
const PHRASES = ['SLOPPED!', 'GET VIBED!', 'YACHTED!', 'CERTIFIED SLOP!', 'FISH FOOD!', 'DECKED!', 'OVERBOARD!'];
const HEAD_PHRASES = ['BOOM, HEADSHOT!', 'DOME PIECE!', 'SKULL SLOT!', 'CRANIUM CLAIMED!'];

/** World-anchored damage numbers + meme kill confirmations. */
export function HitMarker(): JSX.Element {
  const refs = useRef<Array<HTMLDivElement | null>>([]);
  const items = useRef<DmgItem[]>(
    Array.from({ length: POOL }, () => ({ active: false, pos: new THREE.Vector3(), t: 0, amount: 0, head: false }))
  );
  const [confirm, setConfirm] = useState<{ k: number; text: string } | null>(null);

  useEffect(() => {
    let head = 0;
    let last = performance.now();
    let raf = 0;
    const v = new THREE.Vector3();
    const offD = bus.on('dmg', (e) => {
      const it = items.current[head];
      const el = refs.current[head];
      head = (head + 1) % POOL;
      it.active = true;
      it.pos.copy(e.pos);
      it.t = 0;
      it.amount = e.amount;
      it.head = e.head;
      if (el) {
        el.textContent = String(e.amount);
        el.style.color = e.head ? '#ff5d5d' : '#ffffff';
        el.style.fontSize = e.head ? '22px' : '17px';
      }
    });
    const offK = bus.on('kill', (e) => {
      const pool = e.head ? HEAD_PHRASES : PHRASES;
      setConfirm({ k: Math.random(), text: pool[Math.floor(Math.random() * pool.length)] });
      window.setTimeout(() => setConfirm(null), 1200);
    });
    const loop = () => {
      const now = performance.now();
      const dt = (now - last) / 1000;
      last = now;
      for (let i = 0; i < POOL; i++) {
        const it = items.current[i];
        const el = refs.current[i];
        if (!el) continue;
        if (!it.active) { if (el.style.opacity !== '0') el.style.opacity = '0'; continue; }
        it.t += dt;
        if (it.t > 0.85) { it.active = false; el.style.opacity = '0'; continue; }
        v.copy(it.pos);
        v.y += it.t * 1.1;
        v.applyMatrix4(T.cam.vp);
        if (v.z > 1 || v.z < -1) { el.style.opacity = '0'; continue; }
        const x = (v.x * 0.5 + 0.5) * window.innerWidth;
        const y = (-v.y * 0.5 + 0.5) * window.innerHeight;
        el.style.opacity = String(1 - it.t / 0.85);
        el.style.transform = `translate(${x}px, ${y}px) translate(-50%,-100%) scale(${it.head ? 1.2 : 1})`;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); offD(); offK(); };
  }, []);

  return (
    <>
      <div className="pointer-events-none fixed inset-0 z-20 overflow-hidden">
        {items.current.map((_, i) => (
          <div
            key={i}
            ref={(el) => { refs.current[i] = el; }}
            className="absolute left-0 top-0 font-display"
            style={{ opacity: 0, willChange: 'transform', textShadow: '0 2px 0 rgba(0,0,0,0.75)' }}
          />
        ))}
      </div>
      {confirm && (
        <div key={confirm.k} className="pointer-events-none fixed inset-x-0 top-[22%] z-20 flex justify-center">
          <div
            className="font-display text-5xl uppercase tracking-widest text-amber-brand"
            style={{ animation: 'killpop 1.2s ease-out forwards', textShadow: '0 3px 0 rgba(0,0,0,0.8)' }}
          >
            {confirm.text}
          </div>
        </div>
      )}
    </>
  );
}
