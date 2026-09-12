import type { StateStorage } from 'zustand/middleware';

/** localStorage-backed storage for the persisted slice (settings/loadout). */
export const storage: StateStorage = {
  getItem: (name) => {
    try { return localStorage.getItem(name); } catch { return null; }
  },
  setItem: (name, value) => {
    try { localStorage.setItem(name, value); } catch { /* private mode */ }
  },
  removeItem: (name) => {
    try { localStorage.removeItem(name); } catch { /* noop */ }
  },
};

export const PERSIST_KEY = 'claude-of-duty-v2';
