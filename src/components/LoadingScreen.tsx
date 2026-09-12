export function LoadingScreen(): JSX.Element {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-ink">
      <div className="font-display text-4xl uppercase tracking-[0.3em] text-amber-brand">Claude of Duty</div>
      <div className="font-hud text-xs uppercase tracking-[0.4em] text-white/60">Vibe Slops II — generating yacht</div>
      <div className="relative h-3 w-72 overflow-hidden border border-white/25">
        <div className="hazard absolute inset-y-0 w-1/3" style={{ animation: 'sweep 1.1s linear infinite' }} />
      </div>
    </div>
  );
}
