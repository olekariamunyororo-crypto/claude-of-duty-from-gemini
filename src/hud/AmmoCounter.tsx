import { useGameStore } from '../game/store/gameStore';

export function AmmoCounter(): JSX.Element {
  const { mag, magSize, reserve, weapon, reloading, reloadPct, nades } = useGameStore((s) => s.hud);
  const low = mag <= Math.ceil(magSize * 0.25);
  return (
    <div className="pointer-events-none fixed bottom-5 right-6 z-10 text-right">
      <div className="font-display text-sm uppercase tracking-[0.25em] text-white/70">{weapon}</div>
      <div className="flex items-end justify-end gap-2">
        <span className={`font-display text-6xl leading-none ${low ? 'text-foe' : 'text-white'}`}>{mag}</span>
        <span className="font-hud text-xl text-white/50">/ {reserve}</span>
      </div>
      <div className="mt-1 flex items-center justify-end gap-3">
        <span className="font-hud text-xs text-amber-brand">FRAG ×{nades}</span>
        {reloading && (
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-1 font-hud text-[10px] tracking-wider text-amber-brand">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-brand animate-ping" />
              <span>RELOAD {Math.round(reloadPct * 100)}%</span>
            </div>
            <div className="relative h-2.5 w-36 border border-amber-brand/60 bg-black/80 p-[1px] shadow-[0_0_10px_rgba(255,177,0,0.25)]">
              {/* Stage markers */}
              <div className="absolute bottom-0 top-0 left-1/4 w-[1px] bg-white/25 z-10" />
              <div className="absolute bottom-0 top-0 left-[70%] w-[1px] bg-white/25 z-10" />
              {/* Progress Fill */}
              <div
                className="relative h-full bg-gradient-to-r from-amber-600 via-amber-brand to-amber-300 transition-[width] duration-75"
                style={{ width: `${Math.max(0, Math.min(1, reloadPct)) * 100}%` }}
              >
                {reloadPct > 0.05 && (
                  <div className="absolute right-0 top-0 h-full w-1 bg-white shadow-[0_0_6px_#fff]" />
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
