import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { T } from '../game/store/transient';
import { bus } from '../game/utils/Bus';
import { useGameStore } from '../game/store/gameStore';

export function Crosshair(): JSX.Element {
  const wrap = useRef<HTMLDivElement>(null);
  const [hit, setHit] = useState<{ head: boolean; kill: boolean; k: number } | null>(null);
  const { reloading, reloadPct } = useGameStore((s) => s.hud);

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      if (wrap.current) {
        const g = Math.min(40, T.weapon.spreadPx);
        wrap.current.style.setProperty('--gap', `${g}px`);
        wrap.current.style.opacity = T.player.ads > 0.7 ? '0.35' : '1';
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const off = bus.on('hit', (e) => {
      setHit({ ...e, k: Math.random() });
      setTimeout(() => setHit(null), e.kill ? 260 : 130);
    });
    return () => { cancelAnimationFrame(raf); off(); };
  }, []);

  const line = reloading ? 'absolute bg-amber-brand/80 transition-colors' : 'absolute bg-white/90 transition-colors';
  const ringRadius = 22;
  const circumference = 2 * Math.PI * ringRadius;
  const strokeOffset = circumference * (1 - Math.max(0, Math.min(1, reloadPct)));

  return (
    <div className="pointer-events-none fixed inset-0 z-10 flex items-center justify-center">
      <div ref={wrap} className="relative h-16 w-16" style={{ '--gap': '12px' } as CSSProperties}>
        {/* Radial reload HUD sweep animation around reticle */}
        {reloading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <svg className="h-14 w-14 -rotate-90" viewBox="0 0 52 52">
              {/* Background circular guide track */}
              <circle
                cx="26"
                cy="26"
                r={ringRadius}
                fill="none"
                stroke="rgba(255, 255, 255, 0.12)"
                strokeWidth="1.8"
                strokeDasharray="3 3"
              />
              {/* Animated Progress Sweep */}
              <circle
                cx="26"
                cy="26"
                r={ringRadius}
                fill="none"
                stroke="#ffb100"
                strokeWidth="2.5"
                strokeDasharray={circumference}
                strokeDashoffset={strokeOffset}
                strokeLinecap="round"
                style={{ filter: 'drop-shadow(0 0 4px rgba(255, 177, 0, 0.7))' }}
              />
            </svg>
          </div>
        )}

        <div className={`${line} left-1/2 top-1/2 h-[2px] w-[9px] -translate-y-1/2`} style={{ transform: 'translate(calc(var(--gap) * -1 - 9px), -50%)' }} />
        <div className={`${line} left-1/2 top-1/2 h-[2px] w-[9px] -translate-y-1/2`} style={{ transform: 'translate(var(--gap), -50%)' }} />
        <div className={`${line} left-1/2 top-1/2 h-[9px] w-[2px] -translate-x-1/2`} style={{ transform: 'translate(-50%, calc(var(--gap) * -1 - 9px))' }} />
        <div className={`${line} left-1/2 top-1/2 h-[9px] w-[2px] -translate-x-1/2`} style={{ transform: 'translate(-50%, var(--gap))' }} />
        <div className={`absolute left-1/2 top-1/2 h-[3px] w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full ${reloading ? 'bg-amber-300 shadow-[0_0_6px_#ffb100]' : 'bg-amber-brand'}`} />
        {hit && (
          <div key={hit.k} className="absolute inset-0" style={{ animation: 'hitpop 0.25s ease-out forwards' }}>
            <div className={`absolute left-1/2 top-1/2 h-[2px] w-5 -translate-x-1/2 -translate-y-1/2 rotate-45 ${hit.kill ? 'bg-foe' : 'bg-white'}`} />
            <div className={`absolute left-1/2 top-1/2 h-[2px] w-5 -translate-x-1/2 -translate-y-1/2 -rotate-45 ${hit.kill ? 'bg-foe' : 'bg-white'}`} />
            {hit.head && <div className="absolute left-1/2 top-0 -translate-x-1/2 font-hud text-[9px] text-foe">HEAD</div>}
          </div>
        )}
      </div>
    </div>
  );
}
