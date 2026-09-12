export interface WeaponDef {
  id: string;
  name: string;
  cls: string;
  damage: number;
  headMult: number;
  rpm: number;
  auto: boolean;
  pellets: number;
  mag: number;
  reserve: number;
  reloadTime: number;
  spreadHip: number;      // radians
  spreadAds: number;
  bloom: number;          // per-shot spread growth
  adsTime: number;
  adsFov: number;
  recoilV: number;
  recoilH: number;
  falloffStart: number;
  falloffEnd: number;
  falloffMin: number;
  moveMult: number;
  soundBody: number;
  soundBright: number;
  soundDur: number;
  soundCrack: number;
  soundMech: number;
  soundTail: number;
  tracer: number;
}

export const WEAPONS: Record<string, WeaponDef> = {
  ar: {
    id: 'ar', name: 'SLOP-7', cls: 'ASSAULT RIFLE',
    damage: 26, headMult: 1.6, rpm: 690, auto: true, pellets: 1,
    mag: 30, reserve: 120, reloadTime: 2.1,
    spreadHip: 0.028, spreadAds: 0.004, bloom: 0.0035,
    adsTime: 0.22, adsFov: 58,
    recoilV: 0.012, recoilH: 0.0045,
    falloffStart: 28, falloffEnd: 52, falloffMin: 0.72,
    moveMult: 1.0, soundBody: 170, soundBright: 1300, soundDur: 0.14,
    soundCrack: 3400, soundMech: 1100, soundTail: 0.45, tracer: 0xffc36b,
  },
  smg: {
    id: 'smg', name: 'CAP RAPID', cls: 'SMG',
    damage: 19, headMult: 1.5, rpm: 950, auto: true, pellets: 1,
    mag: 34, reserve: 170, reloadTime: 1.8,
    spreadHip: 0.035, spreadAds: 0.008, bloom: 0.003,
    adsTime: 0.16, adsFov: 62,
    recoilV: 0.009, recoilH: 0.006,
    falloffStart: 14, falloffEnd: 32, falloffMin: 0.6,
    moveMult: 1.06, soundBody: 220, soundBright: 1600, soundDur: 0.1,
    soundCrack: 3600, soundMech: 1300, soundTail: 0.35, tracer: 0xffe08a,
  },
  dmr: {
    id: 'dmr', name: 'VIBE DMR', cls: 'MARKSMAN',
    damage: 68, headMult: 2.0, rpm: 230, auto: false, pellets: 1,
    mag: 12, reserve: 60, reloadTime: 2.5,
    spreadHip: 0.02, spreadAds: 0.0015, bloom: 0.006,
    adsTime: 0.26, adsFov: 42,
    recoilV: 0.032, recoilH: 0.006,
    falloffStart: 60, falloffEnd: 90, falloffMin: 0.85,
    moveMult: 0.95, soundBody: 120, soundBright: 900, soundDur: 0.22,
    soundCrack: 3000, soundMech: 900, soundTail: 0.60, tracer: 0xa0e8ff,
  },
  sg: {
    id: 'sg', name: 'YACHT CANNON', cls: 'SHOTGUN',
    damage: 13, headMult: 1.3, rpm: 78, auto: false, pellets: 8,
    mag: 6, reserve: 30, reloadTime: 2.6,
    spreadHip: 0.05, spreadAds: 0.035, bloom: 0.004,
    adsTime: 0.3, adsFov: 60,
    recoilV: 0.05, recoilH: 0.012,
    falloffStart: 8, falloffEnd: 18, falloffMin: 0.3,
    moveMult: 0.98, soundBody: 90, soundBright: 700, soundDur: 0.26,
    soundCrack: 2200, soundMech: 800, soundTail: 0.50, tracer: 0xffb36b,
  },
  pistol: {
    id: 'pistol', name: 'FLOP-45', cls: 'SIDEARM',
    damage: 30, headMult: 1.7, rpm: 320, auto: false, pellets: 1,
    mag: 12, reserve: 48, reloadTime: 1.5,
    spreadHip: 0.02, spreadAds: 0.005, bloom: 0.005,
    adsTime: 0.14, adsFov: 60,
    recoilV: 0.016, recoilH: 0.005,
    falloffStart: 18, falloffEnd: 35, falloffMin: 0.7,
    moveMult: 1.08, soundBody: 200, soundBright: 1400, soundDur: 0.12,
    soundCrack: 3200, soundMech: 1200, soundTail: 0.35, tracer: 0xd8ffe0,
  },
};

export const PRIMARY_IDS = ['ar', 'smg', 'dmr', 'sg'];
