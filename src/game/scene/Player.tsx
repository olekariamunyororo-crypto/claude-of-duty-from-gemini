import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { CapsuleCollider, RigidBody, useRapier, type RapierRigidBody, type RapierCollider } from '@react-three/rapier';
import { registerTick } from './systems';
import { P } from '../player/playerState';
import { computeWish, GRAV, JUMP_V, postMove } from '../player/Movement';
import { cameraCompose } from '../player/Camera';
import { W } from '../weapons/WeaponState';
import { Input } from '../input/InputManager';
import { T } from '../store/transient';
import { damp } from '../utils/MathUtils';

const ph: {
  body: RapierRigidBody | null;
  col: RapierCollider | null;
  ctrl: ReturnType<ReturnType<typeof useRapier>['world']['createCharacterController']> | null;
} = { body: null, col: null, ctrl: null };

/** Fixed-step player simulation: character controller + stance + slide. */
function playerFixedTick(dt: number): void {
  if (P.pendingTeleport) {
    const p = P.pendingTeleport;
    P.pendingTeleport = null;
    T.player.pos.copy(p);
    T.player.prevPos.copy(p);
    T.player.vel.set(0, 0, 0);
    T.player.vy = 0;
    if (ph.body) ph.body.setTranslation({ x: p.x, y: p.y, z: p.z }, true);
    return;
  }
  if (!P.alive || !ph.body || !ph.col || !ph.ctrl) return;

  const def = W.def();
  const wasGrounded = T.player.grounded;

  const wish = computeWish(def);

  if (Input.crouch && T.player.sprint > 0.5 && T.player.grounded && P.slideT <= 0 && T.player.speed > 6) {
    P.slideT = 0.75;
    T.player.vel.x *= 1.35;
    T.player.vel.z *= 1.35;
  }

  if (T.player.inWater) {
    T.player.vy = damp(T.player.vy, -1.0, 3, dt);
    if (Input.jumpQueued) { T.player.vy = 8.4; Input.jumpQueued = false; }
  } else {
    T.player.vy -= GRAV * dt;
  }
  P.fallV = Math.min(P.fallV, T.player.vy);
  if (Input.jumpQueued && T.player.grounded && !T.player.inWater && P.slideT <= 0) {
    Input.jumpQueued = false;
    T.player.vy = JUMP_V;
    T.player.grounded = false;
    ph.ctrl.disableSnapToGround();
  } else if (Input.jumpQueued) {
    Input.jumpQueued = false;
  }

  const accel = P.slideT > 0 ? 1.2 : (T.player.grounded ? 14 : 3);
  const fric = P.slideT > 0 ? 0.6 : 1;
  T.player.vel.x = damp(T.player.vel.x, wish.vx * fric, accel, dt);
  T.player.vel.z = damp(T.player.vel.z, wish.vz * fric, accel, dt);

  const cur = ph.body.translation();
  const desired = { x: T.player.vel.x * dt, y: T.player.vy * dt, z: T.player.vel.z * dt };
  ph.ctrl.computeColliderMovement(ph.col, desired);
  const mv = ph.ctrl.computedMovement();
  const next = { x: cur.x + mv.x, y: cur.y + mv.y, z: cur.z + mv.z };
  ph.body.setNextKinematicTranslation(next);

  T.player.grounded = ph.ctrl.computedGrounded();
  if (T.player.grounded) {
    if (T.player.vy < 0) T.player.vy = -0.5;
    ph.ctrl.enableSnapToGround(0.35);
  }

  T.player.prevPos.copy(T.player.pos);
  T.player.pos.set(next.x, next.y, next.z);
  T.player.alive = P.alive;

  postMove(dt, wasGrounded);

  if (next.y < -10) P.damage(999, T.player.pos, 'void');
}

export function Player(): JSX.Element {
  const bodyRef = useRef<RapierRigidBody>(null);
  const colRef = useRef<RapierCollider>(null);
  const { world } = useRapier();
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  camera.rotation.order = 'YXZ';

  const ctrl = useMemo(() => {
    const c = world.createCharacterController(0.02);
    c.enableAutostep(0.5, 0.2, true);
    c.enableSnapToGround(0.35);
    c.setMaxSlopeClimbAngle((55 * Math.PI) / 180);
    c.setMinSlopeSlideAngle((35 * Math.PI) / 180);
    return c;
  }, [world]);

  useEffect(() => {
    ph.body = bodyRef.current;
    ph.col = colRef.current;
    ph.ctrl = ctrl;
    const t1 = registerTick(playerFixedTick);
    const t2 = registerTick((dt) => P.tick(dt));
    return () => {
      t1(); t2();
      ph.body = null; ph.col = null; ph.ctrl = null;
      world.removeCharacterController(ctrl);
    };
  }, [world, ctrl]);

  useFrame((_, delta) => {
    cameraCompose(camera, Math.min(delta, 0.1));
  });

  const spawn = P.pendingTeleport ?? new THREE.Vector3(-34, 0.95, 8);
  return (
    <RigidBody ref={bodyRef} type="kinematicPosition" colliders={false} ccd position={[spawn.x, spawn.y, spawn.z]}>
      <CapsuleCollider ref={colRef} args={[0.55, 0.4]} />
    </RigidBody>
  );
}
