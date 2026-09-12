import * as THREE from 'three';
import { useGameStore } from '../store/gameStore';
import { T } from '../store/transient';
import { bus } from '../utils/Bus';
import { SFX } from '../audio/AudioEngine';
import { SPAWNS } from '../scene/Map';
import { bots } from '../ai/bots';
import { W } from '../weapons/WeaponState';

class PlayerStateImpl {
  hp = 100;
  alive = true;
  lastHurt = -99;
  respawnT = 0;
  slideT = 0;
  fallV = 0;
  footAcc = 0;
  /** Applied by the Player component to teleport the rapier body. */
  pendingTeleport: THREE.Vector3 | null = null;

  reset(): void {
    this.hp = 100;
    this.alive = true;
    this.slideT = 0;
    this.respawnT = 0;
    const s = this.pickSpawn();
    this.pendingTeleport = new THREE.Vector3(s[0], s[1] + 0.95, s[2]);
  }

  pickSpawn(): [number, number, number] {
    let best = SPAWNS[0];
    let bestD = -1;
    const candidates = [...SPAWNS].sort(() => Math.random() - 0.5).slice(0, 4);
    for (const sp of candidates) {
      let minD = 1e9;
      for (const b of bots) {
        if (!b.alive) continue;
        const d = Math.hypot(sp[0] - b.pos.x, sp[2] - b.pos.z);
        if (d < minD) minD = d;
      }
      if (minD > bestD) { bestD = minD; best = sp; }
    }
    return best;
  }

  damage(amount: number, from: THREE.Vector3, killerId: string, head = false): void {
    if (!this.alive) return;
    this.hp -= amount;
    this.lastHurt = performance.now() / 1000;
    const dx = from.x - T.player.pos.x, dz = from.z - T.player.pos.z;
    const bearing = Math.atan2(-dx, -dz);
    bus.emit('hurt', { dir: bearing - T.cam.yaw, amount });
    SFX.hurt();
    T.shake = Math.min(1, T.shake + 0.12);
    useGameStore.getState().setHud({ hp: Math.max(0, Math.round(this.hp)) });
    if (this.hp <= 0) this.die(killerId, head);
  }

  die(killerId: string, head: boolean): void {
    this.alive = false;
    this.respawnT = 3.0;
    T.player.alive = false;
    T.player.ads = 0;
    const st = useGameStore.getState();
    st.setHud({ alive: false, hp: 0 });
    st.registerKill(killerId, 'player', head, '');
  }

  respawn(): void {
    const s = this.pickSpawn();
    this.pendingTeleport = new THREE.Vector3(s[0], s[1] + 0.95, s[2]);
    this.hp = 100;
    this.alive = true;
    T.player.alive = true;
    W.refill();
    useGameStore.getState().setHud({ hp: 100, alive: true });
  }

  /** Regen + respawn countdown; called from the fixed tick. */
  tick(dt: number): void {
    if (!this.alive) {
      this.respawnT -= dt;
      if (this.respawnT <= 0) this.respawn();
      return;
    }
    const now = performance.now() / 1000;
    if (this.hp < 100 && now - this.lastHurt > 4.5) {
      this.hp = Math.min(100, this.hp + 45 * dt);
      useGameStore.getState().setHud({ hp: Math.round(this.hp) });
    }
  }
}

export const P = new PlayerStateImpl();
