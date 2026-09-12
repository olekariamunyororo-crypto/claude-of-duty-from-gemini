import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { PERSIST_KEY, storage } from './persist';

export type Phase = 'menu' | 'loadout' | 'settings' | 'playing' | 'paused' | 'results';
export type Mode = 'ffa' | 'tdm';
export type Quality = 'low' | 'med' | 'high';

export interface Settings { sens: number; volume: number; fov: number; quality: Quality; }
export interface RosterEntry { id: string; name: string; team: number; kills: number; deaths: number; }
export interface KillfeedEntry {
  id: number; killer: string; victim: string; weapon: string; head: boolean;
  killerTeam: number; victimTeam: number; t: number;
}
export interface HudState {
  hp: number; mag: number; magSize: number; reserve: number; nades: number;
  weapon: string; weaponCls: string; reloadTime: number; reloading: boolean; reloadPct: number; timer: number; alive: boolean;
}

export const SCORE_LIMIT: Record<Mode, number> = { ffa: 25, tdm: 40 };
export const MATCH_TIME = 600;

interface GameStore {
  phase: Phase;
  mode: Mode;
  primary: string;
  settings: Settings;
  roster: RosterEntry[];
  killfeed: KillfeedEntry[];
  hud: HudState;
  winnerTeam: number | null;
  victory: boolean;
  tutorialSeen: boolean;

  setPhase: (p: Phase) => void;
  setMode: (m: Mode) => void;
  setPrimary: (id: string) => void;
  setSettings: (p: Partial<Settings>) => void;
  setRoster: (r: RosterEntry[]) => void;
  setHud: (p: Partial<HudState>) => void;
  startMatch: () => void;
  quitToMenu: () => void;
  endMatch: (winnerTeam: number) => void;
  registerKill: (killerId: string, victimId: string, head: boolean, weapon: string) => void;
  dismissTutorial: () => void;
}

let kfId = 1;

const initialHud: HudState = {
  hp: 100, mag: 30, magSize: 30, reserve: 120, nades: 2,
  weapon: 'SLOP-7', weaponCls: 'ASSAULT RIFLE', reloadTime: 2.1, reloading: false, reloadPct: 0, timer: MATCH_TIME, alive: true,
};

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
      phase: 'menu',
      mode: 'ffa',
      primary: 'ar',
      settings: { sens: 1.0, volume: 0.8, fov: 80, quality: 'high' },
      roster: [],
      killfeed: [],
      hud: { ...initialHud },
      winnerTeam: null,
      victory: false,
      tutorialSeen: false,

      setPhase: (phase) => set({ phase }),
      setMode: (mode) => set({ mode }),
      setPrimary: (primary) => set({ primary }),
      setSettings: (p) => set((s) => ({ settings: { ...s.settings, ...p } })),
      setRoster: (roster) => set({ roster }),
      setHud: (p) => set((s) => ({ hud: { ...s.hud, ...p } })),

      startMatch: () => {
        set({
          phase: 'playing',
          roster: [],
          killfeed: [],
          hud: { ...initialHud, timer: MATCH_TIME },
          winnerTeam: null,
          victory: false,
        });
      },

      quitToMenu: () => {
        document.exitPointerLock?.();
        set({ phase: 'menu' });
      },

      endMatch: (winnerTeam) => {
        if (get().phase !== 'playing') return;
        set({ winnerTeam, victory: winnerTeam === 0, phase: 'results' });
        document.exitPointerLock?.();
      },

      registerKill: (killerId, victimId, head, weapon) => {
        const s = get();
        if (s.phase !== 'playing') return;
        const roster = s.roster.map((r) => ({ ...r }));
        const k = roster.find((r) => r.id === killerId);
        const v = roster.find((r) => r.id === victimId);
        if (k && killerId !== victimId) k.kills++; // suicides never score
        if (v) v.deaths++;
        const feed: KillfeedEntry = {
          id: kfId++,
          killer: k ? k.name : killerId,
          victim: v ? v.name : victimId,
          weapon, head,
          killerTeam: k ? k.team : -1,
          victimTeam: v ? v.team : -1,
          t: Date.now(),
        };
        const killfeed = [feed, ...s.killfeed.filter((e) => Date.now() - e.t < 6000)].slice(0, 6);
        set({ roster, killfeed });

        const limit = SCORE_LIMIT[s.mode];
        if (k && killerId !== victimId) {
          if (s.mode === 'ffa') {
            if (k.kills >= limit) get().endMatch(k.team);
          } else {
            const teamKills = roster.filter((r) => r.team === k.team).reduce((a, r) => a + r.kills, 0);
            if (teamKills >= limit) get().endMatch(k.team);
          }
        }
      },

      dismissTutorial: () => set({ tutorialSeen: true }),
    }),
    {
      name: PERSIST_KEY,
      storage: createJSONStorage(() => storage),
      partialize: (s) => ({
        settings: s.settings, primary: s.primary, mode: s.mode, tutorialSeen: s.tutorialSeen,
      }),
    }
  )
);
