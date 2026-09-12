/** Small gesture helpers shared by the touch controls. */
export function onDoubleTap(el: HTMLElement, cb: () => void): () => void {
  let last = 0;
  const handler = () => {
    const now = performance.now();
    if (now - last < 300) cb();
    last = now;
  };
  el.addEventListener('pointerdown', handler);
  return () => el.removeEventListener('pointerdown', handler);
}

export function holdPress(el: HTMLElement, down: () => void, up: () => void): () => void {
  const d = (e: PointerEvent) => { e.stopPropagation(); el.setPointerCapture(e.pointerId); down(); };
  const u = (e: PointerEvent) => { e.stopPropagation(); up(); };
  el.addEventListener('pointerdown', d);
  el.addEventListener('pointerup', u);
  el.addEventListener('pointercancel', u);
  return () => {
    el.removeEventListener('pointerdown', d);
    el.removeEventListener('pointerup', u);
    el.removeEventListener('pointercancel', u);
  };
}
