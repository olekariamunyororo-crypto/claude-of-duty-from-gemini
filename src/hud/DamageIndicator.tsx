import { useEffect, useRef } from 'react';
import { bus } from '../game/utils/Bus';
import { T } from '../game/store/transient';
import { P } from '../game/player/playerState';

const RADIUS = 130;

/** Directional hurt arcs + red vignette driven by recent damage & low HP. */
export function DamageIndicator(): JSX.Element {
  const arcs = useRef(
    Array.from({ length: 6 }, () => ({ on: false, world: 0, t: 0, el: null as HTMLDivElement | null }))
  );
  const vig = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let head = 0;
    let lastT = performance.now();
    let raf = 0;
    const offHurt = bus.on('hurt', (e) => {
      const a = arcs.current[head];
      head = (head + 1) % arcs.current.length;
      a.on = true;
      a.world = e.dir + T.cam.yaw;
      a.t = 0;
    });
    const loop = () => {
      const now = performance.now();
      const dt = (now - lastT) / 1000;
      lastT = now;
      for (const a of arcs.current) {
        if (!a.on) continue;
        a.t += dt;
        if (a.t > 1.2) { a.on = false; if (a.el) a.el.style.opacity = '0'; continue; }
        const rel = a.world - T.cam.yaw;
        if (a.el) {
          a.el.style.opacity = String(0.9 * (1 - a.t / 1.2));
          a.el.style.transform = `rotate(${-rel}rad) translateY(-${RADIUS}px)`;
        }
      }
      if (vig.current) {
        const sinceHurt = now / 1000 - P.lastHurt;
        const lowHp = P.alive ? Math.max(0, (45 - P.hp) / 45) : 1;
        const pulse = Math.max(0, 1 - sinceHurt * 1.6);
        vig.current.style.opacity = String(Math.min(1, lowHp * 0.75 + pulse));
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); offHurt(); };
  }, []);

  return (
    <>
      <div ref={vig} className="vig-red pointer-events-none fixed inset-0 z-[9]" style={{ opacity: 0 }} />
      <div className="pointer-events-none fixed inset-0 z-10">
        <div className="absolute left-1/2 top-1/2 h-0 w-0">
          {arcs.current.map((_, i) => (
            <div
              key={i}
              ref={(el) => { arcs.current[i].el = el; }}
              className="absolute h-20 w-44 rounded-full"
              style={{
                left: -88, top: -40, opacity: 0, willChange: 'transform',
                background: 'radial-gradient(ellipse at 50% 0%, rgba(255,45,45,0.85), transparent 70%)',
              }}
            />
          ))}
        </div>
      </div>
    </>
  );
}
