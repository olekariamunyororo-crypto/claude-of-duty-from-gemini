import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { STEP, registerTick, runTicks } from './systems';
import { T } from '../store/transient';
import { useGameStore } from '../store/gameStore';
import { bus } from '../utils/Bus';
import { clamp } from '../utils/MathUtils';
import { W } from '../weapons/WeaponState';
import { P } from '../player/playerState';

let hudAcc = 0;
let fpsBad = 0;
let autoDowngraded = false;

/** Match timer + throttled HUD sync + auto quality fallback. */
function matchTick(dt: number): void {
  const st = useGameStore.getState();
  if (st.phase !== 'playing') return;

  const t = st.hud.timer - dt;
  if (Math.ceil(t) !== Math.ceil(st.hud.timer)) {
    st.setHud({ timer: Math.max(0, t) });
    if (t <= 0) {
      let top = st.roster[0];
      for (const r of st.roster) if (r.kills > (top?.kills ?? -1)) top = r;
      st.endMatch(top ? top.team : 0);
      return;
    }
  }
  hudAcc += dt;
  if (hudAcc > 0.12) {
    hudAcc = 0;
    W.syncHud();
    st.setHud({ hp: Math.round(P.hp) });
  }
}

export function GameLoop(): JSX.Element | null {
  const acc = useRef(0);

  useEffect(() => {
    const off = registerTick(matchTick);
    const offW = registerTick((dt: number) => W.tick(dt));
    return () => { off(); offW(); };
  }, []);

  useFrame((_, delta) => {
    const phase = useGameStore.getState().phase;
    const d = Math.min(delta, 0.1);
    T.fps = T.fps * 0.95 + (1 / Math.max(delta, 1e-4)) * 0.05;

    if (!autoDowngraded && phase === 'playing') {
      if (T.fps < 42) fpsBad += d; else fpsBad = Math.max(0, fpsBad - d);
      if (fpsBad > 6) {
        const st = useGameStore.getState();
        const q = st.settings.quality;
        if (q === 'high') { autoDowngraded = true; st.setSettings({ quality: 'med' }); bus.emit('toast', { text: 'QUALITY AUTO: MEDIUM' }); }
        else if (q === 'med') { autoDowngraded = true; st.setSettings({ quality: 'low' }); bus.emit('toast', { text: 'QUALITY AUTO: LOW' }); }
      }
    }

    if (phase !== 'playing') { acc.current = 0; return; }
    acc.current += d;
    let n = 0;
    while (acc.current >= STEP && n++ < 5) {
      runTicks(STEP);
      acc.current -= STEP;
    }
    T.alpha = clamp(acc.current / STEP, 0, 1);
  });

  return null;
}
