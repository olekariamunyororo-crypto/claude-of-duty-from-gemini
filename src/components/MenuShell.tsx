import { useEffect, useRef } from 'react';
import { useGameStore, SCORE_LIMIT, type Mode, type Quality } from '../game/store/gameStore';
import { WEAPONS, PRIMARY_IDS } from '../game/weapons/weaponData';
import { Input } from '../game/input/InputManager';
import { SFX } from '../game/audio/AudioEngine';
import { T } from '../game/store/transient';
import { P } from '../game/player/playerState';
import { W } from '../game/weapons/WeaponState';
import { Recoil } from '../game/weapons/Recoil';
import { initBots } from '../game/ai/bots';
import { fxReset } from '../game/scene/fx';
import { Button } from './Button';

function click(): void { SFX.tick(1100, 0.04, 0.12); }

/** Full match bootstrap: reset all systems, seed bots, teleport player, request pointer lock. */
function beginMatch(): void {
  const st = useGameStore.getState();
  SFX.unlock();
  Input.jumpQueued = false;
  Input.reloadQueued = false;
  Input.nadeQueued = false;
  Input.swapQueued = 0;
  st.startMatch();
  W.equipLoadout(st.primary);
  initBots(st.mode);
  P.reset();
  T.reset();
  fxReset();
  Recoil.reset();
  window.setTimeout(() => Input.requestLock(), 80);
}

function Stat({ label, v }: { label: string; v: number }): JSX.Element {
  return (
    <div className="flex items-center gap-2">
      <span className="w-10 font-hud text-[9px] tracking-widest text-white/50">{label}</span>
      <div className="h-1.5 flex-1 bg-white/10">
        <div className="h-full bg-amber-brand" style={{ width: `${Math.round(Math.max(0.05, Math.min(1, v)) * 100)}%` }} />
      </div>
    </div>
  );
}

function Slider({ label, min, max, step, value, fmt, onChange }: {
  label: string; min: number; max: number; step: number; value: number;
  fmt: (v: number) => string; onChange: (v: number) => void;
}): JSX.Element {
  return (
    <label className="block">
      <div className="mb-1 flex justify-between font-hud text-[11px] uppercase tracking-[0.25em] text-white/60">
        <span>{label}</span>
        <span className="text-amber-brand">{fmt(value)}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-[#ffb100]"
      />
    </label>
  );
}

function QualityRow(): JSX.Element {
  const settings = useGameStore((s) => s.settings);
  const setSettings = useGameStore((s) => s.setSettings);
  return (
    <div>
      <div className="mb-1 font-hud text-[11px] uppercase tracking-[0.25em] text-white/60">
        Quality <span className="text-white/30">(render scale & shadows · next match)</span>
      </div>
      <div className="flex gap-2">
        {(['low', 'med', 'high'] as Quality[]).map((q) => (
          <button
            key={q}
            onClick={() => { click(); setSettings({ quality: q }); }}
            className={`flex-1 border py-1.5 font-hud text-[11px] uppercase tracking-widest transition-colors ${
              settings.quality === q ? 'border-amber-brand text-amber-brand' : 'border-white/20 text-white/60 hover:border-white/50'
            }`}
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}

function MenuScreen(): JSX.Element {
  const setPhase = useGameStore((s) => s.setPhase);
  const mode = useGameStore((s) => s.mode);
  const setMode = useGameStore((s) => s.setMode);
  return (
    <div className="fixed inset-0 z-20 flex flex-col items-center justify-center gap-8 bg-ink px-4">
      <div className="hazard absolute inset-x-0 top-0 h-4" />
      <div className="hazard absolute inset-x-0 bottom-0 h-4" />
      <div className="text-center">
        <div className="font-hud text-[11px] tracking-[0.6em] text-white/50">A COMPLETELY UNOFFICIAL PARODY FPS</div>
        <h1 className="mt-2 font-display text-6xl uppercase leading-none tracking-[0.06em] text-white md:text-8xl">
          Claude <span className="text-amber-brand">of</span> Duty
        </h1>
        <div className="mt-2 font-display text-3xl uppercase tracking-[0.45em] text-amber-brand md:text-4xl">Vibe Slops II</div>
      </div>
      <div className="flex gap-3">
        {(['ffa', 'tdm'] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => { click(); setMode(m); }}
            className={`border-2 px-6 py-2 font-display text-lg uppercase tracking-[0.2em] transition-colors ${
              mode === m ? 'border-amber-brand text-amber-brand' : 'border-white/20 text-white/60 hover:border-white/50'
            }`}
          >
            {m === 'ffa' ? `FFA · ${SCORE_LIMIT.ffa}` : `TDM · ${SCORE_LIMIT.tdm}`}
          </button>
        ))}
      </div>
      <div className="flex w-72 flex-col gap-2">
        <Button accent onClick={() => { click(); setPhase('loadout'); }}>Deploy</Button>
        <Button onClick={() => { click(); setPhase('settings'); }}>Settings</Button>
      </div>
      <p className="max-w-md text-center font-hud text-[10px] leading-relaxed text-white/35">
        Procedural luxury-yacht mayhem vs 7 AI slop-lords. Zero external assets — geometry, textures and audio
        are synthesized at runtime. Unofficial fan parody. Not affiliated with Activision, Treyarch, Microsoft,
        Anthropic or Zhipu AI.
      </p>
    </div>
  );
}

function LoadoutScreen(): JSX.Element {
  const setPhase = useGameStore((s) => s.setPhase);
  const primary = useGameStore((s) => s.primary);
  const setPrimary = useGameStore((s) => s.setPrimary);
  const mode = useGameStore((s) => s.mode);
  return (
    <div className="fixed inset-0 z-20 flex flex-col items-center justify-center gap-6 bg-ink px-4 py-8">
      <h2 className="font-display text-4xl uppercase tracking-[0.3em] text-amber-brand">Loadout</h2>
      <div className="font-hud text-xs tracking-[0.3em] text-white/50">
        {mode === 'ffa' ? 'FREE-FOR-ALL' : 'TEAM DEATHMATCH'} · FIRST TO {SCORE_LIMIT[mode]}
      </div>
      <div className="grid w-full max-w-3xl grid-cols-2 gap-3 md:grid-cols-4">
        {PRIMARY_IDS.map((id) => {
          const w = WEAPONS[id];
          const sel = primary === id;
          return (
            <button
              key={id}
              onClick={() => { click(); setPrimary(id); }}
              className={`border-2 p-4 text-left transition-all ${sel ? 'border-amber-brand bg-amber-brand/10' : 'border-white/15 bg-black/40 hover:border-white/40'}`}
            >
              <div className={`font-display text-xl uppercase tracking-widest ${sel ? 'text-amber-brand' : 'text-white'}`}>{w.name}</div>
              <div className="mb-3 font-hud text-[9px] tracking-[0.3em] text-white/45">{w.cls}</div>
              <div className="space-y-1.5">
                <Stat label="DMG" v={(w.damage * w.pellets) / 90} />
                <Stat label="RPM" v={w.rpm / 1000} />
                <Stat label="RNG" v={w.falloffEnd / 90} />
                <Stat label="CTL" v={1 - w.recoilV * 16} />
              </div>
            </button>
          );
        })}
      </div>
      <div className="flex w-72 flex-col gap-2">
        <Button accent onClick={beginMatch}>Start Match</Button>
        <Button onClick={() => { click(); setPhase('menu'); }}>Back</Button>
      </div>
    </div>
  );
}

function SettingsScreen(): JSX.Element {
  const setPhase = useGameStore((s) => s.setPhase);
  const settings = useGameStore((s) => s.settings);
  const setSettings = useGameStore((s) => s.setSettings);
  return (
    <div className="fixed inset-0 z-20 flex flex-col items-center justify-center gap-6 bg-ink px-4 py-8">
      <h2 className="font-display text-4xl uppercase tracking-[0.3em] text-amber-brand">Settings</h2>
      <div className="w-full max-w-md space-y-5 border-2 border-white/15 bg-panel p-6">
        <Slider label="Sensitivity" min={0.2} max={3} step={0.05} value={settings.sens}
          fmt={(v) => v.toFixed(2)} onChange={(v) => setSettings({ sens: v })} />
        <Slider label="Volume" min={0} max={1} step={0.05} value={settings.volume}
          fmt={(v) => `${Math.round(v * 100)}%`} onChange={(v) => setSettings({ volume: v })} />
        <Slider label="Field of View" min={60} max={110} step={1} value={settings.fov}
          fmt={(v) => `${v}°`} onChange={(v) => setSettings({ fov: v })} />
        <QualityRow />
      </div>
      <div className="w-72">
        <Button onClick={() => { click(); setPhase('menu'); }}>Back</Button>
      </div>
    </div>
  );
}

function PauseScreen(): JSX.Element {
  const setPhase = useGameStore((s) => s.setPhase);
  const quit = useGameStore((s) => s.quitToMenu);
  const settings = useGameStore((s) => s.settings);
  const setSettings = useGameStore((s) => s.setSettings);
  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-sm border-2 border-white/15 bg-panel/95 p-6">
        <div className="hazard mb-4 h-2.5" />
        <h2 className="mb-5 font-display text-3xl uppercase tracking-[0.3em] text-amber-brand">Paused</h2>
        <div className="flex flex-col gap-3">
          <Button accent onClick={() => { click(); setPhase('playing'); Input.requestLock(); }}>Resume</Button>
          <div className="space-y-4 border border-white/10 p-4">
            <Slider label="Sensitivity" min={0.2} max={3} step={0.05} value={settings.sens}
              fmt={(v) => v.toFixed(2)} onChange={(v) => setSettings({ sens: v })} />
            <Slider label="Volume" min={0} max={1} step={0.05} value={settings.volume}
              fmt={(v) => `${Math.round(v * 100)}%`} onChange={(v) => setSettings({ volume: v })} />
            <QualityRow />
          </div>
          <Button onClick={quit}>Quit to Menu</Button>
        </div>
      </div>
    </div>
  );
}

function ResultsScreen(): JSX.Element {
  const victory = useGameStore((s) => s.victory);
  const roster = useGameStore((s) => s.roster);
  const setPhase = useGameStore((s) => s.setPhase);
  const quit = useGameStore((s) => s.quitToMenu);
  const stung = useRef(false);

  useEffect(() => {
    if (stung.current) return;
    stung.current = true;
    SFX.sting(victory);
  }, [victory]);

  const rows = [...roster].sort((a, b) => b.kills - a.kills);
  const mvp = rows[0];
  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/80 px-4">
      <div className="w-full max-w-xl border-2 border-white/15 bg-panel/95">
        <div className="hazard h-3" />
        <div className="p-6">
          <h2 className={`font-display text-5xl uppercase tracking-[0.2em] ${victory ? 'text-amber-brand' : 'text-foe'}`}>
            {victory ? 'Victory' : 'Defeat'}
          </h2>
          <div className="mt-1 font-hud text-xs tracking-[0.3em] text-white/60">
            MVP: {mvp ? `${mvp.name} (${mvp.kills})` : '—'}
          </div>
          <div className="mt-5 px-0">
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
          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <div className="flex-1"><Button accent onClick={beginMatch}>Rematch</Button></div>
            <div className="flex-1"><Button onClick={() => { click(); setPhase('loadout'); }}>Loadout</Button></div>
            <div className="flex-1"><Button onClick={quit}>Menu</Button></div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function MenuShell({ screen }: { screen: 'menu' | 'loadout' | 'settings' | 'pause' | 'results' }): JSX.Element {
  if (screen === 'menu') return <MenuScreen />;
  if (screen === 'loadout') return <LoadoutScreen />;
  if (screen === 'settings') return <SettingsScreen />;
  if (screen === 'pause') return <PauseScreen />;
  return <ResultsScreen />;
}
