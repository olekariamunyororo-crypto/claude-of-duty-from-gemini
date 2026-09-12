import { useEffect, useRef } from 'react';
import { Input } from './InputManager';
import { onDoubleTap } from './Gestures';
import { useGameStore } from '../store/gameStore';

/** Virtual joysticks + action buttons for touch devices. */
export function TouchControls(): JSX.Element {
  const stickRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const lookRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stick = stickRef.current, knob = knobRef.current, look = lookRef.current;
    if (!stick || !knob || !look) return;

    // ---- movement stick ----
    let stickId = -1;
    const R = 52;
    const onStickDown = (e: PointerEvent) => {
      if (stickId !== -1) return;
      stickId = e.pointerId;
      stick.setPointerCapture(e.pointerId);
    };
    const onStickMove = (e: PointerEvent) => {
      if (e.pointerId !== stickId) return;
      const r = stick.getBoundingClientRect();
      let dx = e.clientX - (r.left + r.width / 2);
      let dy = e.clientY - (r.top + r.height / 2);
      const len = Math.hypot(dx, dy);
      if (len > R) { dx = (dx / len) * R; dy = (dy / len) * R; }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      Input.tMoveX = dx / R;
      Input.tMoveY = -dy / R;
    };
    const onStickUp = (e: PointerEvent) => {
      if (e.pointerId !== stickId) return;
      stickId = -1;
      knob.style.transform = 'translate(0,0)';
      Input.tMoveX = 0; Input.tMoveY = 0;
    };
    stick.addEventListener('pointerdown', onStickDown);
    stick.addEventListener('pointermove', onStickMove);
    stick.addEventListener('pointerup', onStickUp);
    stick.addEventListener('pointercancel', onStickUp);

    // ---- look area (right half) ----
    let lookId = -1, lx = 0, ly = 0;
    const onLookDown = (e: PointerEvent) => {
      if (lookId !== -1) return;
      lookId = e.pointerId;
      lx = e.clientX; ly = e.clientY;
      look.setPointerCapture(e.pointerId);
    };
    const onLookMove = (e: PointerEvent) => {
      if (e.pointerId !== lookId) return;
      Input.lookX += (e.clientX - lx) * 2.4;
      Input.lookY += (e.clientY - ly) * 2.4;
      lx = e.clientX; ly = e.clientY;
    };
    const onLookUp = (e: PointerEvent) => { if (e.pointerId === lookId) lookId = -1; };
    look.addEventListener('pointerdown', onLookDown);
    look.addEventListener('pointermove', onLookMove);
    look.addEventListener('pointerup', onLookUp);
    look.addEventListener('pointercancel', onLookUp);

    const offDouble = onDoubleTap(look, () => { Input.adsToggle = !Input.adsToggle; });

    return () => {
      stick.removeEventListener('pointerdown', onStickDown);
      stick.removeEventListener('pointermove', onStickMove);
      stick.removeEventListener('pointerup', onStickUp);
      stick.removeEventListener('pointercancel', onStickUp);
      look.removeEventListener('pointerdown', onLookDown);
      look.removeEventListener('pointermove', onLookMove);
      look.removeEventListener('pointerup', onLookUp);
      look.removeEventListener('pointercancel', onLookUp);
      offDouble();
    };
  }, []);

  const btn = 'pointer-events-auto flex items-center justify-center rounded-full border-2 border-white/30 bg-black/40 font-display uppercase tracking-widest text-white/80 active:bg-amber-brand/40 active:border-amber-brand';

  return (
    <div className="pointer-events-none fixed inset-0 z-30" style={{ touchAction: 'none' }}>
      {/* look zone */}
      <div ref={lookRef} className="pointer-events-auto absolute right-0 top-0 h-full w-1/2" style={{ touchAction: 'none' }} />

      {/* movement stick */}
      <div ref={stickRef} className="pointer-events-auto absolute bottom-8 left-6 h-32 w-32 rounded-full border-2 border-white/25 bg-black/30" style={{ touchAction: 'none' }}>
        <div ref={knobRef} className="absolute left-1/2 top-1/2 -ml-7 -mt-7 h-14 w-14 rounded-full border-2 border-amber-brand/70 bg-black/50" />
      </div>

      {/* action cluster */}
      <div className="absolute bottom-6 right-5 grid grid-cols-3 gap-3" style={{ width: 210 }}>
        <button className={`${btn} h-14 w-14 text-[10px]`} onPointerDown={(e) => { e.stopPropagation(); Input.nadeQueued = true; }}>Nade</button>
        <button className={`${btn} h-14 w-14 text-[10px]`} onPointerDown={(e) => { e.stopPropagation(); Input.reloadQueued = true; }}>Reload</button>
        <button className={`${btn} h-14 w-14 text-[10px]`} onPointerDown={(e) => { e.stopPropagation(); Input.jumpQueued = true; }}>Jump</button>
        <button className={`${btn} h-14 w-14 text-[10px]`} onPointerDown={(e) => { e.stopPropagation(); Input.swapQueued = 1; }}>Swap</button>
        <button className={`${btn} h-14 w-14 text-[10px]`} onPointerDown={(e) => { e.stopPropagation(); Input.adsToggle = !Input.adsToggle; }}>ADS</button>
        <button className={`${btn} h-16 w-16 text-xs !border-amber-brand/60`} onPointerDown={(e) => { e.stopPropagation(); Input.tFire = true; }} onPointerUp={() => { Input.tFire = false; }} onPointerCancel={() => { Input.tFire = false; }}>Fire</button>
      </div>

      {/* crouch hold */}
      <button className={`${btn} absolute bottom-48 left-8 h-14 w-14 text-[10px]`}
        onPointerDown={(e) => { e.stopPropagation(); Input.crouch = true; }}
        onPointerUp={() => { Input.crouch = false; }}>Crouch</button>

      {/* pause */}
      <button
        className="pointer-events-auto absolute right-3 top-3 rounded border-2 border-white/25 bg-black/50 px-3 py-1 font-display text-xs uppercase tracking-widest text-white/80"
        onPointerDown={(e) => { e.stopPropagation(); useGameStore.getState().setPhase('paused'); }}
      >Pause</button>
    </div>
  );
}
