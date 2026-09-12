import * as THREE from 'three';

/** Typed one-shot UI event bus (hitmarkers, damage numbers, kill confirmations). */
export interface BusEvents {
  hit: { head: boolean; kill: boolean };
  hurt: { dir: number; amount: number };          // dir = bearing relative to view (rad)
  dmg: { pos: THREE.Vector3; amount: number; head: boolean };
  kill: { head: boolean };
  toast: { text: string };
}

type Handler<T> = (e: T) => void;
const map = new Map<keyof BusEvents, Set<Handler<never>>>();

export const bus = {
  on<K extends keyof BusEvents>(k: K, fn: Handler<BusEvents[K]>): () => void {
    let s = map.get(k);
    if (!s) { s = new Set(); map.set(k, s); }
    s.add(fn as Handler<never>);
    return () => { s!.delete(fn as Handler<never>); };
  },
  emit<K extends keyof BusEvents>(k: K, e: BusEvents[K]) {
    map.get(k)?.forEach((fn) => (fn as Handler<BusEvents[K]>)(e));
  },
};
