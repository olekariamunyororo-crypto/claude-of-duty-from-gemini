import { useEffect, useRef } from 'react';
import { T } from '../game/store/transient';

const W = 320, H = 26;
const LABELS: Record<number, string> = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };

export function Compass(): JSX.Element {
  const cv = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let raf = 0;
    const draw = () => {
      const el = cv.current;
      if (el) {
        const ctx = el.getContext('2d')!;
        ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = 'rgba(6,10,14,0.55)';
        ctx.fillRect(0, 0, W, H);
        let heading = ((-T.cam.yaw * 180) / Math.PI) % 360;
        if (heading < 0) heading += 360;
        ctx.textAlign = 'center';
        for (let d = -90; d <= 90; d += 5) {
          const deg = (heading + d + 360) % 360;
          const x = W / 2 + (d / 90) * (W / 2 - 10);
          const major = deg % 45 === 0;
          ctx.fillStyle = major ? '#ffb100' : 'rgba(255,255,255,0.5)';
          ctx.fillRect(x, major ? 8 : 12, 1.5, major ? 10 : 6);
          if (major && LABELS[deg]) {
            ctx.fillStyle = '#ffffff';
            ctx.font = '10px ui-monospace, monospace';
            ctx.fillText(LABELS[deg], x, 8);
          }
        }
        ctx.fillStyle = '#ffb100';
        ctx.fillRect(W / 2 - 1, 20, 2, 6);
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  return <canvas ref={cv} width={W} height={H} className="rounded border border-white/15" />;
}
