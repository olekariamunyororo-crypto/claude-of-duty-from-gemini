let enabled = false;
export const Logger = {
  setEnabled(v: boolean) { enabled = v; },
  log: (...args: unknown[]) => { if (enabled) console.log('[CoD]', ...args); },
  warn: (...args: unknown[]) => { if (enabled) console.warn('[CoD]', ...args); },
  error: (...args: unknown[]) => console.error('[CoD]', ...args),
};
