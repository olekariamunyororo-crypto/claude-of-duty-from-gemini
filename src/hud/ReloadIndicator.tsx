import { useEffect, useState, useRef } from 'react';
import { useGameStore } from '../game/store/gameStore';
import { RotateCw, Check, Zap } from 'lucide-react';

export function ReloadIndicator(): JSX.Element | null {
  const { reloading, reloadPct, weapon, weaponCls, reloadTime, alive } = useGameStore((s) => s.hud);
  const [completeFlash, setCompleteFlash] = useState(false);
  const lastReloading = useRef(reloading);
  const lastPct = useRef(reloadPct);

  useEffect(() => {
    // Detect reload completion transition (was reloading, then finished)
    if (lastReloading.current && !reloading && lastPct.current >= 0.5) {
      setCompleteFlash(true);
      const timer = window.setTimeout(() => setCompleteFlash(false), 380);
      return () => window.clearTimeout(timer);
    }
    lastReloading.current = reloading;
    lastPct.current = reloadPct;
  }, [reloading, reloadPct]);

  if (!alive || (!reloading && !completeFlash)) {
    return null;
  }

  const p = completeFlash ? 1 : Math.max(0, Math.min(1, reloadPct));
  const pctDisplay = Math.round(p * 100);
  const timeLeft = completeFlash ? '0.0s' : `${Math.max(0, (1 - p) * (reloadTime || 2.1)).toFixed(1)}s`;

  // 3 tactile reload stages matching audio cues (0.25 = Mag In, 0.70 = Bolt Rack)
  const isStage1 = p < 0.25;
  const isStage2 = p >= 0.25 && p < 0.70;
  const isStage3 = p >= 0.70 && !completeFlash;

  let stageLabel = 'STAGE 1: EJECTING MAG';
  if (completeFlash) {
    stageLabel = 'WEAPON CYCLED · READY';
  } else if (isStage3) {
    stageLabel = 'STAGE 3: CHAMBERING ROUND';
  } else if (isStage2) {
    stageLabel = 'STAGE 2: INSERTING MAG';
  }

  return (
    <div
      id="hud-reload-indicator"
      className="pointer-events-none fixed inset-0 z-20 flex flex-col items-center justify-center"
    >
      <div
        className={`mt-28 flex w-64 flex-col gap-1.5 border-2 bg-panel/90 px-3.5 py-2.5 backdrop-blur-sm transition-all sm:w-72 ${
          completeFlash
            ? 'border-emerald-400 bg-black/90 shadow-[0_0_24px_rgba(52,211,153,0.4)]'
            : 'border-amber-brand/75 shadow-[0_0_20px_rgba(255,177,0,0.22)]'
        }`}
        style={{ animation: 'reloadpop 0.16s ease-out' }}
      >
        {/* Loadout Category Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-1 font-hud text-[9px] uppercase tracking-[0.25em]">
          <span className="flex items-center gap-1.5 text-white/60">
            <span className="text-amber-brand font-bold">[</span>
            <span>{weaponCls || 'TACTICAL LOADOUT'}</span>
            <span className="text-amber-brand font-bold">]</span>
          </span>
          <span className="font-display text-xs tracking-wider text-white">
            {weapon}
          </span>
        </div>

        {/* Action Status & Numerical Countdown */}
        <div className="flex items-center justify-between font-hud text-[10px] tracking-[0.2em]">
          <div className="flex items-center gap-1.5">
            {completeFlash ? (
              <Check className="h-3 w-3 text-emerald-400 animate-bounce" />
            ) : (
              <RotateCw className="h-3 w-3 text-amber-brand animate-spin" />
            )}
            <span
              className={
                completeFlash
                  ? 'font-bold text-emerald-400'
                  : 'font-semibold text-amber-brand'
              }
            >
              {stageLabel}
            </span>
          </div>
          <span className="text-white/80 font-mono text-[11px] font-bold">
            {pctDisplay}% <span className="text-white/40 font-normal">({timeLeft})</span>
          </span>
        </div>

        {/* Tactical Segmented Progress Bar */}
        <div className="relative h-4 w-full overflow-hidden border border-white/20 bg-black/80 p-[2px]">
          {/* Calibrated Stage Divider Tick Lines (25% and 70%) */}
          <div
            className="absolute bottom-0 top-0 z-10 w-[1px] bg-white/30"
            style={{ left: '25%' }}
            title="Mag Inserted"
          />
          <div
            className="absolute bottom-0 top-0 z-10 w-[1px] bg-white/30"
            style={{ left: '70%' }}
            title="Bolt Cycled"
          />

          {/* Subtly striped progress track background */}
          <div className="absolute inset-0 opacity-15 hazard" />

          {/* Glowing Animated Fill */}
          <div
            className={`relative h-full transition-[width] duration-75 ease-out ${
              completeFlash
                ? 'bg-gradient-to-r from-emerald-600 via-emerald-400 to-emerald-300 shadow-[0_0_12px_#34d399]'
                : 'bg-gradient-to-r from-amber-600 via-amber-brand to-amber-300 shadow-[0_0_12px_#ffb100]'
            }`}
            style={{ width: `${p * 100}%` }}
          >
            {/* Bright leading edge cursor */}
            {!completeFlash && p > 0.02 && (
              <div className="absolute right-0 top-0 h-full w-1 bg-white shadow-[0_0_8px_#ffffff,0_0_14px_#ffb100]" />
            )}
          </div>
        </div>

        {/* 3 Tactile Milestone Pips */}
        <div className="flex items-center justify-between font-hud text-[8px] uppercase tracking-[0.2em]">
          {/* Step 1: Mag Eject */}
          <div
            className={`flex items-center gap-1 transition-colors ${
              p >= 0.05 ? 'text-amber-brand font-bold' : 'text-white/35'
            }`}
          >
            <span
              className={`inline-block h-1.5 w-1.5 rounded-full ${
                p >= 0.05
                  ? 'bg-amber-brand shadow-[0_0_6px_#ffb100]'
                  : 'bg-white/20'
              }`}
            />
            <span>EJECT</span>
          </div>

          <div
            className={`h-[1px] flex-1 mx-1.5 transition-colors ${
              p >= 0.25 ? 'bg-amber-brand/60' : 'bg-white/15'
            }`}
          />

          {/* Step 2: Mag Insert */}
          <div
            className={`flex items-center gap-1 transition-colors ${
              p >= 0.25 ? 'text-amber-brand font-bold' : 'text-white/35'
            }`}
          >
            <span
              className={`inline-block h-1.5 w-1.5 rounded-full ${
                p >= 0.25
                  ? 'bg-amber-brand shadow-[0_0_6px_#ffb100]'
                  : 'bg-white/20'
              }`}
            />
            <span>INSERT</span>
          </div>

          <div
            className={`h-[1px] flex-1 mx-1.5 transition-colors ${
              p >= 0.70 ? 'bg-amber-brand/60' : 'bg-white/15'
            }`}
          />

          {/* Step 3: Chamber / Bolt */}
          <div
            className={`flex items-center gap-1 transition-colors ${
              completeFlash
                ? 'text-emerald-400 font-bold'
                : p >= 0.70
                ? 'text-amber-brand font-bold'
                : 'text-white/35'
            }`}
          >
            <span
              className={`inline-block h-1.5 w-1.5 rounded-full ${
                completeFlash
                  ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]'
                  : p >= 0.70
                  ? 'bg-amber-brand shadow-[0_0_6px_#ffb100]'
                  : 'bg-white/20'
              }`}
            />
            <span>{completeFlash ? 'LOCKED' : 'CHAMBER'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
