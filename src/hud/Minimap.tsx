import { useEffect, useRef } from 'react';
import { BOXES } from '../game/scene/Map';
import { bots } from '../game/ai/bots';
import { T } from '../game/store/transient';
import { useGameStore } from '../game/store/gameStore';

const SIZE = 168;
const SCALE = 5.4; // px per meter on the offscreen map

export function Minimap(): JSX.Element {
  const cv = useRef<HTMLCanvasElement>(null);
  const staticMap = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const off = document.createElement('canvas');
    off.width = Math.ceil(84 * SCALE);
    off.height = Math.ceil(28 * SCALE);
    const c = off.getContext('2d')!;
    c.fillStyle = '#0d1319';
    c.fillRect(0, 0, off.width, off.height);
    const toX = (x: number) => (x + 42) * SCALE;
    const toZ = (z: number) => (z + 14) * SCALE;
    for (const b of BOXES) {
      if (!b.collide) continue;
      const tall = b.hy > 0.6;
      c.fillStyle = tall ? '#4c5866' : '#232c35';
      if (b.mat === 'deck' || b.mat === 'heli' || b.mat === 'metal') c.fillStyle = tall ? '#4c5866' : '#2c3742';
      c.fillRect(toX(b.x - b.hx), toZ(b.z - b.hz), b.hx * 2 * SCALE, b.hz * 2 * SCALE);
    }
    staticMap.current = off;

    let raf = 0;
    const draw = () => {
      const el = cv.current;
      if (el && staticMap.current) {
        const ctx = el.getContext('2d')!;
        const st = useGameStore.getState();
        ctx.clearRect(0, 0, SIZE, SIZE);
        ctx.save();
        ctx.beginPath();
        ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2 - 2, 0, Math.PI * 2);
        ctx.clip();
        ctx.fillStyle = '#0d1319';
        ctx.fillRect(0, 0, SIZE, SIZE);
        ctx.translate(SIZE / 2, SIZE / 2);
        ctx.rotate(T.cam.yaw); // player forward points up
        ctx.translate(-(T.player.pos.x + 42) * SCALE, -(T.player.pos.z + 14) * SCALE);
        ctx.drawImage(staticMap.current, 0, 0);
        const now = performance.now();
        for (const b of bots) {
          if (!b.alive) continue;
          const enemy = !(st.mode === 'tdm' && b.team === 0);
          if (enemy && now - b.lastShotAt > 1500 && b.pos.distanceTo(T.player.pos) > 9) continue;
          ctx.fillStyle = enemy ? '#ff4d4d' : '#37b6ff';
          ctx.beginPath();
          ctx.arc((b.pos.x + 42) * SCALE, (b.pos.z + 14) * SCALE, 4, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
        ctx.save();
        ctx.translate(SIZE / 2, SIZE / 2);
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(0, -7); ctx.lineTo(5, 6); ctx.lineTo(0, 3); ctx.lineTo(-5, 6);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="relative">
      <canvas ref={cv} width={SIZE} height={SIZE} className="rounded-full border-2 border-white/25 bg-black/50" />
      <div className="absolute -top-1 left-1/2 -translate-x-1/2 font-hud text-[10px] tracking-widest text-white/70">N</div>
    </div>
  );
}
