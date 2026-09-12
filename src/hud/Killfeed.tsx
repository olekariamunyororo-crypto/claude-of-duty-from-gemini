import { useGameStore } from '../game/store/gameStore';

export function Killfeed(): JSX.Element {
  const killfeed = useGameStore((s) => s.killfeed);
  return (
    <div className="flex flex-col items-end gap-1">
      {killfeed.map((e) => (
        <div key={e.id} className="flex items-center gap-2 border border-white/10 bg-black/60 px-2.5 py-1 font-hud text-xs" style={{ animation: 'feedin 0.15s ease-out' }}>
          <span style={{ color: e.killerTeam === 0 ? '#37b6ff' : '#ff4d4d' }}>{e.killer}</span>
          <span className="text-white/50">[{e.weapon || '—'}{e.head ? ' HS' : ''}]</span>
          <span style={{ color: e.victimTeam === 0 ? '#37b6ff' : '#ff4d4d' }}>{e.victim}</span>
        </div>
      ))}
    </div>
  );
}
