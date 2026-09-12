import { useGameStore } from '../game/store/gameStore';

export function HealthBar(): JSX.Element {
  const hp = useGameStore((s) => s.hud.hp);
  const alive = useGameStore((s) => s.hud.alive);
  const low = hp <= 35;
  return (
    <div className="pointer-events-none fixed bottom-6 left-6 z-10">
      <div className="flex items-end gap-3">
        <span
          className={`font-display text-6xl leading-none ${low ? 'text-foe' : 'text-white'}`}
          style={low ? { animation: 'blink 0.9s infinite' } : undefined}
        >
          {alive ? hp : 0}
        </span>
        <div className="mb-2">
          <div className="h-2.5 w-56 border border-white/25 bg-black/50">
            <div
              className={`h-full ${low ? 'bg-foe' : 'bg-mate'}`}
              style={{ width: `${alive ? hp : 0}%`, transition: 'width 120ms linear' }}
            />
          </div>
          <div className="mt-1 font-hud text-[10px] tracking-[0.35em] text-white/50">VIBE INTEGRITY</div>
        </div>
      </div>
    </div>
  );
}
