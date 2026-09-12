import { useEffect, useState } from 'react';
import { useGameStore, SCORE_LIMIT } from '../game/store/gameStore';
import { Crosshair } from './Crosshair';
import { Minimap } from './Minimap';
import { Compass } from './Compass';
import { Killfeed } from './Killfeed';
import { AmmoCounter } from './AmmoCounter';
import { HealthBar } from './HealthBar';
import { HitMarker } from './HitMarker';
import { DamageIndicator } from './DamageIndicator';
import { ReloadIndicator } from './ReloadIndicator';
import { Input, IS_TOUCH } from '../game/input/InputManager';
import { T } from '../game/store/transient';
import { P } from '../game/player/playerState';
import { bus } from '../game/utils/Bus';
import { fmtTime } from '../game/utils/MathUtils';

function DeathOverlay(): JSX.Element | null {
  const alive = useGameStore((s) => s.hud.alive);
  const [t, setT] = useState(3);
  useEffect(() => {
    if (alive) return;
    let raf = 0;
    const loop = () => { setT(Math.max(0, Math.ceil(P.respawnT))); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [alive]);
  if (alive) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex flex-col items-center justify-center bg-foe/10">
      <div className="font-display text-7xl uppercase tracking-[0.2em] text-foe" style={{ textShadow: '0 4px 0 rgba(0,0,0,0.7)' }}>
        SLOPPED
      </div>
      <div className="mt-2 font-hud text-sm tracking-[0.35em] text-white/80">RESPAWN IN {t}</div>
    </div>
  );
}

function LockHint(): JSX.Element | null {
  const [locked, setLocked] = useState(Input.locked);
  useEffect(() => {
    let raf = 0;
    let last = Input.locked;
    const loop = () => {
      if (Input.locked !== last) { last = Input.locked; setLocked(last); }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  if (locked || IS_TOUCH) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex items-center justify-center">
      <div className="border-2 border-white/25 bg-black/70 px-6 py-3 font-display text-xl uppercase tracking-[0.3em] text-amber-brand" style={{ animation: 'blink 1.2s infinite' }}>
        CLICK TO ENGAGE
      </div>
    </div>
  );
}

function Scoreboard({ show }: { show: boolean }): JSX.Element | null {
  const roster = useGameStore((s) => s.roster);
  const mode = useGameStore((s) => s.mode);
  if (!show) return null;
  const rows = [...roster].sort((a, b) => b.kills - a.kills);
  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/60">
      <div className="w-[min(560px,92vw)] border-2 border-white/20 bg-panel/95">
        <div className="hazard h-2.5" />
        <div className="px-5 py-3 font-display text-xl uppercase tracking-[0.25em] text-amber-brand">
          {mode === 'ffa' ? 'Free-For-All' : 'Team Deathmatch'} — Scoreboard
        </div>
        <div className="px-5 pb-4">
          <table className="w-full font-hud text-sm">
            <thead>
              <tr className="text-white/40">
                <th className="py-1 text-left font-normal">#</th>
                <th className="text-left font-normal">OPERATOR</th>
                <th className="text-right font-normal">K</th>
                <th className="text-right font-normal">D</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id} className={`border-t border-white/10 ${r.id === 'player' ? 'text-amber-brand' : r.team === 0 ? 'text-mate' : 'text-white/85'}`}>
                  <td className="py-1.5">{i + 1}</td>
                  <td>{r.name}</td>
                  <td className="text-right">{r.kills}</td>
                  <td className="text-right">{r.deaths}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Tutorial(): JSX.Element | null {
  const seen = useGameStore((s) => s.tutorialSeen);
  const dismiss = useGameStore((s) => s.dismissTutorial);
  const mode = useGameStore((s) => s.mode);
  const [closed, setClosed] = useState(false);
  if (seen || closed) return null;
  return (
    <div className="pointer-events-auto fixed inset-0 z-30 flex items-center justify-center bg-black/70 px-4">
      <div className="w-[min(560px,92vw)] border-2 border-amber-brand/60 bg-panel p-6">
        <div className="font-display text-3xl uppercase tracking-[0.2em] text-amber-brand">Briefing</div>
        <ul className="mt-4 space-y-1.5 font-hud text-sm text-white/85">
          {IS_TOUCH ? (
            <>
              <li>• Left stick — move (push fully to sprint)</li>
              <li>• Right half — drag to look · double-tap toggles ADS</li>
              <li>• FIRE / ADS / JUMP / RELOAD / SWAP / NADE buttons</li>
              <li>• Landscape orientation recommended</li>
            </>
          ) : (
            <>
              <li>• WASD move · SHIFT sprint · SPACE jump · C crouch/slide</li>
              <li>• LMB fire · RMB aim · R reload · G frag · 1/2 or wheel to swap</li>
              <li>• ESC releases the mouse and pauses the match</li>
            </>
          )}
          <li>• Health regenerates — break line of sight to heal</li>
          <li>• First to {SCORE_LIMIT[mode]} {mode === 'tdm' ? '(team total) ' : ''}wins</li>
        </ul>
        <button className="btn-mil mt-5 text-center" onClick={() => { dismiss(); setClosed(true); }}>
          Deploy me anyway
        </button>
      </div>
    </div>
  );
}

export function Hud(): JSX.Element {
  const mode = useGameStore((s) => s.mode);
  const timer = useGameStore((s) => s.hud.timer);
  const roster = useGameStore((s) => s.roster);
  const [showBoard, setShowBoard] = useState(false);
  const [toast, setToast] = useState('');
  const [fps, setFps] = useState(60);

  useEffect(() => {
    let raf = 0;
    let last = false;
    const loop = () => {
      if (Input.scoreboard !== last) { last = Input.scoreboard; setShowBoard(last); }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const offToast = bus.on('toast', (e) => {
      setToast(e.text);
      window.setTimeout(() => setToast(''), 2600);
    });
    const iv = window.setInterval(() => setFps(Math.round(T.fps)), 500);
    return () => { cancelAnimationFrame(raf); offToast(); window.clearInterval(iv); };
  }, []);

  const mine = roster.find((r) => r.id === 'player')?.kills ?? 0;
  const leader = roster.reduce((a, r) => (r.kills > (a?.kills ?? -1) ? r : a), roster[0]);
  const t0 = roster.filter((r) => r.team === 0).reduce((a, r) => a + r.kills, 0);
  const t1 = roster.filter((r) => r.team === 1).reduce((a, r) => a + r.kills, 0);

  return (
    <div className="pointer-events-none fixed inset-0 z-10 font-hud">
      <div className="absolute left-4 top-4 flex flex-col items-center gap-2">
        <Minimap />
        <Compass />
      </div>

      <div className="absolute inset-x-0 top-3 flex flex-col items-center">
        <div className="font-display text-4xl leading-none tracking-widest text-white" style={{ textShadow: '0 2px 0 rgba(0,0,0,0.6)' }}>
          {fmtTime(timer)}
        </div>
        <div className="mt-0.5 text-[10px] tracking-[0.35em] text-amber-brand">
          {mode === 'ffa'
            ? `FFA · YOU ${mine} — LEADER ${leader?.kills ?? 0}`
            : `TDM · ${t0} — ${t1} · FIRST TO ${SCORE_LIMIT.tdm}`}
        </div>
      </div>

      <div className="absolute right-4 top-4 flex flex-col items-end gap-1">
        <Killfeed />
        <div className="mt-1 text-[9px] tracking-[0.25em] text-white/35">{fps} FPS</div>
      </div>

      <Crosshair />
      <ReloadIndicator />
      <HitMarker />
      <DamageIndicator />
      <HealthBar />
      <AmmoCounter />
      <DeathOverlay />
      <LockHint />
      <Scoreboard show={showBoard} />
      <Tutorial />

      {toast && (
        <div className="absolute inset-x-0 bottom-28 flex justify-center">
          <div className="border border-amber-brand/50 bg-black/70 px-4 py-1.5 text-xs tracking-[0.3em] text-amber-brand">{toast}</div>
        </div>
      )}
    </div>
  );
}
