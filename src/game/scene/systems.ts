export const STEP = 1 / 60;
export type Tick = (dt: number) => void;
const ticks: Tick[] = [];

/** Register a fixed-step system tick. Returns an unregister function. */
export function registerTick(fn: Tick): () => void {
  ticks.push(fn);
  return () => {
    const i = ticks.indexOf(fn);
    if (i >= 0) ticks.splice(i, 1);
  };
}

export function runTicks(dt: number): void {
  for (let i = 0; i < ticks.length; i++) ticks[i](dt);
}
