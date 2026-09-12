import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { registerTick } from './systems';
import { bots, botsTick } from '../ai/bots';
import { T } from '../store/transient';
import { lerp, clamp } from '../utils/MathUtils';
import { useGameStore } from '../store/gameStore';

// --- Procedural Textures & Materials (Created ONCE at module load, zero per-frame cost) ---

function createUniformTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Base tactical olive drab / field grey
  ctx.fillStyle = '#424943';
  ctx.fillRect(0, 0, size, size);

  // Digital camo pixel clusters
  const splotches = ['#303631', '#4d564e', '#262a27', '#586256', '#39403a'];
  for (let i = 0; i < 60; i++) {
    ctx.fillStyle = splotches[i % splotches.length];
    const x = Math.floor(Math.random() * (size / 4)) * 4;
    const y = Math.floor(Math.random() * (size / 4)) * 4;
    const w = 4 + Math.floor(Math.random() * 3) * 4;
    const h = 4 + Math.floor(Math.random() * 3) * 4;
    ctx.fillRect(x, y, w, h);
  }

  // Micro ripstop grid weave
  ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
  for (let y = 0; y < size; y += 4) ctx.fillRect(0, y, size, 1);
  for (let x = 0; x < size; x += 4) ctx.fillRect(x, 0, 1, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2.5, 2.5);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

const uniformTex = createUniformTexture();

const uniformMat = new THREE.MeshStandardMaterial({
  map: uniformTex,
  color: uniformTex ? '#ffffff' : '#424943',
  roughness: 0.9,
  metalness: 0.05,
});

const vestMat = new THREE.MeshStandardMaterial({
  color: '#2b302d',
  roughness: 0.52,
  metalness: 0.15,
});

const helmetMat = new THREE.MeshStandardMaterial({
  color: '#363c38',
  roughness: 0.48,
  metalness: 0.2,
});

const darkGearMat = new THREE.MeshStandardMaterial({
  color: '#141617',
  roughness: 0.82,
  metalness: 0.06,
});

const gunMat = new THREE.MeshStandardMaterial({
  color: '#1b1e22',
  roughness: 0.35,
  metalness: 0.75,
});

const goggleMat = new THREE.MeshStandardMaterial({
  color: '#0d1820',
  emissive: new THREE.Color('#0b2a3a'),
  emissiveIntensity: 0.5,
  roughness: 0.12,
  metalness: 0.6,
});

const opticLensMat = new THREE.MeshStandardMaterial({
  color: '#ff2222',
  emissive: new THREE.Color('#ff2222'),
  emissiveIntensity: 1.8,
  roughness: 0.2,
});

const flashMat = new THREE.MeshBasicMaterial({
  color: '#ffe59e',
  transparent: true,
  opacity: 0.95,
  side: THREE.DoubleSide,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});

// Team identification materials: ally (cool blue) vs enemy (warm hues)
const allyTeamMat = new THREE.MeshStandardMaterial({
  color: '#2979ff',
  emissive: new THREE.Color('#1045a0'),
  emissiveIntensity: 0.5,
  roughness: 0.4,
});

const enemyTeamMatCache = new Map<number, THREE.Material>();

function getTeamMaterial(team: number, hue: number): THREE.Material {
  if (team === 0) return allyTeamMat;
  let mat = enemyTeamMatCache.get(hue);
  if (!mat) {
    const c = new THREE.Color().setHSL(hue, 0.92, 0.52);
    const em = new THREE.Color().setHSL(hue, 0.92, 0.22);
    mat = new THREE.MeshStandardMaterial({
      color: c,
      emissive: em,
      emissiveIntensity: 0.45,
      roughness: 0.4,
    });
    enemyTeamMatCache.set(hue, mat);
  }
  return mat;
}

// --- Shared Geometries (Created ONCE, shared across all bots) ---

// Head & Helmet
const headGeo = new THREE.SphereGeometry(0.18, 12, 10);
const neckGeo = new THREE.CylinderGeometry(0.09, 0.11, 0.11, 10);
const helmetGeo = new THREE.SphereGeometry(0.215, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.56);
const helmetRimGeo = new THREE.CylinderGeometry(0.218, 0.222, 0.035, 14);
const helmetBandGeo = new THREE.CylinderGeometry(0.221, 0.221, 0.04, 14);
const nvgMountGeo = new THREE.BoxGeometry(0.05, 0.06, 0.04);
const arcRailGeo = new THREE.BoxGeometry(0.025, 0.03, 0.12);
const earMuffGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.03, 8);
const goggleGeo = new THREE.BoxGeometry(0.23, 0.065, 0.07);
const goggleStrapGeo = new THREE.BoxGeometry(0.24, 0.03, 0.22);

// Torso & Armor
const torsoShirtGeo = new THREE.CylinderGeometry(0.22, 0.17, 0.42, 10);
const plateCarrierFrontGeo = new THREE.BoxGeometry(0.28, 0.30, 0.08);
const plateCarrierBackGeo = new THREE.BoxGeometry(0.28, 0.30, 0.07);
const cummerbundGeo = new THREE.BoxGeometry(0.31, 0.16, 0.18);
const shoulderStrapGeo = new THREE.BoxGeometry(0.07, 0.05, 0.22);
const shoulderCapGeo = new THREE.BoxGeometry(0.10, 0.09, 0.09);
const shoulderPatchGeo = new THREE.BoxGeometry(0.015, 0.065, 0.085);
const chestPouchGeo = new THREE.BoxGeometry(0.065, 0.12, 0.045);
const chestPatchGeo = new THREE.BoxGeometry(0.09, 0.045, 0.01);
const backpackGeo = new THREE.BoxGeometry(0.22, 0.28, 0.11);
const backpackPocketGeo = new THREE.BoxGeometry(0.18, 0.13, 0.05);
const backpackPatchGeo = new THREE.BoxGeometry(0.10, 0.035, 0.01);

// Pelvis & Belt
const pelvisGeo = new THREE.CylinderGeometry(0.17, 0.15, 0.15, 10);
const beltGeo = new THREE.CylinderGeometry(0.19, 0.19, 0.06, 12);
const beltBuckleGeo = new THREE.BoxGeometry(0.05, 0.05, 0.02);
const holsterGeo = new THREE.BoxGeometry(0.06, 0.14, 0.07);
const utilityPouchGeo = new THREE.BoxGeometry(0.08, 0.09, 0.06);

// Limbs
const thighGeo = new THREE.CylinderGeometry(0.085, 0.072, 0.36, 10);
const thighPouchGeo = new THREE.BoxGeometry(0.05, 0.11, 0.09);
const kneePadGeo = new THREE.BoxGeometry(0.10, 0.09, 0.05);
const shinGeo = new THREE.CylinderGeometry(0.072, 0.062, 0.32, 10);
const bootGeo = new THREE.BoxGeometry(0.11, 0.12, 0.22);
const upperArmGeo = new THREE.CylinderGeometry(0.06, 0.052, 0.24, 8);
const forearmGeo = new THREE.CylinderGeometry(0.052, 0.046, 0.22, 8);
const handGeo = new THREE.BoxGeometry(0.065, 0.065, 0.085);

// Weapon
const rifleReceiverGeo = new THREE.BoxGeometry(0.055, 0.085, 0.28);
const rifleHandguardGeo = new THREE.BoxGeometry(0.05, 0.06, 0.20);
const rifleBarrelGeo = new THREE.CylinderGeometry(0.014, 0.014, 0.24, 8);
const rifleMuzzleGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.05, 8);
const rifleGripGeo = new THREE.BoxGeometry(0.04, 0.11, 0.055);
const rifleMagGeo = new THREE.BoxGeometry(0.038, 0.15, 0.075);
const rifleStockGeo = new THREE.BoxGeometry(0.04, 0.085, 0.16);
const rifleOpticGeo = new THREE.BoxGeometry(0.038, 0.045, 0.10);
const rifleOpticLensGeo = new THREE.CylinderGeometry(0.014, 0.014, 0.005, 8);
const flashPlaneGeo = new THREE.PlaneGeometry(0.28, 0.28);

// Pre-allocated per-bot animation states (Zero allocations in useFrame)
interface BotAnimState {
  walkPhase: number;
  headYawLag: number;
  prevYaw: number;
}

const animStates: BotAnimState[] = Array.from({ length: 12 }, () => ({
  walkPhase: 0,
  headYawLag: 0,
  prevYaw: 0,
}));

/** Visuals for the AI bots: realistic procedural modern tactical infantry soldiers. */
export function BotsView(): JSX.Element {
  const rootGroups = useRef<Array<THREE.Group | null>>([]);
  const torsoGroups = useRef<Array<THREE.Group | null>>([]);
  const leftLegGroups = useRef<Array<THREE.Group | null>>([]);
  const rightLegGroups = useRef<Array<THREE.Group | null>>([]);
  const headGroups = useRef<Array<THREE.Group | null>>([]);
  const flashGroups = useRef<Array<THREE.Group | null>>([]);

  // Subscribe to roster so bots re-render if match re-initializes
  useGameStore((s) => s.roster);

  useEffect(() => registerTick(botsTick), []);

  useFrame(() => {
    const now = performance.now() * 0.001;

    for (let i = 0; i < bots.length; i++) {
      const b = bots[i];
      const root = rootGroups.current[i];
      if (!root) continue;

      const flash = flashGroups.current[i];
      const leftLeg = leftLegGroups.current[i];
      const rightLeg = rightLegGroups.current[i];
      const torso = torsoGroups.current[i];
      const head = headGroups.current[i];
      const anim = animStates[i];

      // Death animation: flop backwards onto back, sink slightly, hide after 3.2s
      if (!b.alive) {
        const t = Math.min(1, b.deathT * 2.2);
        const sink = Math.min(1, b.deathT * 2.8) * 0.45;
        root.rotation.x = -t * Math.PI * 0.48;
        root.rotation.z = t * 0.15;
        root.rotation.y = b.yaw;
        root.position.set(b.pos.x, b.pos.y - sink, b.pos.z);
        root.visible = b.deathT < 3.2;
        if (flash) flash.visible = false;
        continue;
      }

      root.visible = true;
      root.rotation.x = 0;
      root.rotation.z = 0;

      // Fixed-step render interpolation
      const x = lerp(b.prevPos.x, b.pos.x, T.alpha);
      const y = lerp(b.prevPos.y, b.pos.y, T.alpha);
      const z = lerp(b.prevPos.z, b.pos.z, T.alpha);
      root.position.set(x, y, z);
      root.rotation.y = b.yaw;

      // Locomotion & walk cycle
      const dx = b.pos.x - b.prevPos.x;
      const dz = b.pos.z - b.prevPos.z;
      const moveDist = Math.hypot(dx, dz);

      if (moveDist > 0.004) {
        anim.walkPhase += moveDist * 6.2;
        const swing = Math.sin(anim.walkPhase) * 0.44;
        if (leftLeg) leftLeg.rotation.x = swing;
        if (rightLeg) rightLeg.rotation.x = -swing;
        const bob = Math.abs(Math.sin(anim.walkPhase * 2)) * 0.024;
        if (torso) torso.position.y = 0.80 + bob;
      } else {
        if (leftLeg) leftLeg.rotation.x = lerp(leftLeg.rotation.x, 0, 0.15);
        if (rightLeg) rightLeg.rotation.x = lerp(rightLeg.rotation.x, 0, 0.15);
        const breath = Math.sin(now * 2.2 + i * 0.7) * 0.006;
        if (torso) torso.position.y = 0.80 + breath;
      }

      // Aim & organic head lag/lead
      if (head) {
        const yawDelta = b.yaw - anim.prevYaw;
        const normDelta = Math.atan2(Math.sin(yawDelta), Math.cos(yawDelta));
        anim.headYawLag = lerp(anim.headYawLag, normDelta * 0.45, 0.14);
        anim.prevYaw = b.yaw;
        head.rotation.y = clamp(anim.headYawLag, -0.32, 0.32);
      }

      // Muzzle flash visibility & flicker
      if (flash) {
        const isFlashing = b.flash > 0;
        flash.visible = isFlashing;
        if (isFlashing) {
          flash.rotation.z += 0.8;
        }
      }
    }
  });

  return (
    <group>
      {bots.map((b, i) => {
        const teamMat = getTeamMaterial(b.team, b.hue);

        return (
          <group
            key={b.id}
            ref={(el) => {
              rootGroups.current[i] = el;
            }}
          >
            {/* --- LEFT LEG (Pivot at hip y=0.78, swings with walk cycle) --- */}
            <group
              ref={(el) => {
                leftLegGroups.current[i] = el;
              }}
              position={[-0.13, 0.78, 0]}
            >
              <mesh geometry={thighGeo} material={uniformMat} position={[0, -0.18, 0]} castShadow />
              <mesh geometry={thighPouchGeo} material={uniformMat} position={[-0.07, -0.16, 0]} />
              <mesh geometry={kneePadGeo} material={darkGearMat} position={[0, -0.36, 0.06]} />
              <mesh geometry={shinGeo} material={uniformMat} position={[0, -0.53, 0]} castShadow />
              <mesh geometry={bootGeo} material={darkGearMat} position={[0, -0.72, 0.04]} castShadow />
            </group>

            {/* --- RIGHT LEG (Pivot at hip y=0.78, swings with walk cycle) --- */}
            <group
              ref={(el) => {
                rightLegGroups.current[i] = el;
              }}
              position={[0.13, 0.78, 0]}
            >
              <mesh geometry={thighGeo} material={uniformMat} position={[0, -0.18, 0]} castShadow />
              <mesh geometry={holsterGeo} material={darkGearMat} position={[0.07, -0.14, 0]} />
              <mesh geometry={kneePadGeo} material={darkGearMat} position={[0, -0.36, 0.06]} />
              <mesh geometry={shinGeo} material={uniformMat} position={[0, -0.53, 0]} castShadow />
              <mesh geometry={bootGeo} material={darkGearMat} position={[0, -0.72, 0.04]} castShadow />
            </group>

            {/* --- PELVIS & TACTICAL DUTY BELT (Hips level at y=0.78) --- */}
            <group position={[0, 0.78, 0]}>
              <mesh geometry={pelvisGeo} material={uniformMat} position={[0, 0, 0]} />
              <mesh geometry={beltGeo} material={darkGearMat} position={[0, 0.06, 0]} />
              <mesh geometry={beltBuckleGeo} material={gunMat} position={[0, 0.06, 0.18]} />
              <mesh geometry={utilityPouchGeo} material={vestMat} position={[0, 0.06, -0.18]} />
            </group>

            {/* --- UPPER BODY / TORSO & WEAPON (Bobs during walk/idle) --- */}
            <group
              ref={(el) => {
                torsoGroups.current[i] = el;
              }}
              position={[0, 0.80, 0]}
            >
              {/* Combat shirt under vest */}
              <mesh geometry={torsoShirtGeo} material={uniformMat} position={[0, 0.24, 0]} castShadow />

              {/* Tactical Plate Carrier (Front & Back Ballistic Plates) */}
              <mesh geometry={plateCarrierFrontGeo} material={vestMat} position={[0, 0.32, 0.10]} castShadow />
              <mesh geometry={plateCarrierBackGeo} material={vestMat} position={[0, 0.32, -0.10]} castShadow />
              <mesh geometry={cummerbundGeo} material={vestMat} position={[0, 0.26, 0]} />
              <mesh geometry={shoulderStrapGeo} material={vestMat} position={[-0.13, 0.48, 0]} />
              <mesh geometry={shoulderStrapGeo} material={vestMat} position={[0.13, 0.48, 0]} />

              {/* Chest Magazine Pouches */}
              <mesh geometry={chestPouchGeo} material={vestMat} position={[0, 0.24, 0.155]} />
              <mesh geometry={chestPouchGeo} material={vestMat} position={[-0.08, 0.24, 0.155]} />
              <mesh geometry={chestPouchGeo} material={vestMat} position={[0.08, 0.24, 0.155]} />

              {/* Chest Team ID Badge / Patch */}
              <mesh geometry={chestPatchGeo} material={teamMat} position={[0, 0.42, 0.15]} />

              {/* Tactical Assault Backpack (Rear hitbox profile) */}
              <mesh geometry={backpackGeo} material={vestMat} position={[0, 0.34, -0.20]} castShadow />
              <mesh geometry={backpackPocketGeo} material={vestMat} position={[0, 0.26, -0.27]} />
              <mesh geometry={backpackPatchGeo} material={teamMat} position={[0, 0.42, -0.265]} />

              {/* --- RIGHT ARM (Trigger Arm: Shoulder, Upper Arm, Forearm, Hand) --- */}
              <group position={[0.22, 0.48, 0]}>
                <mesh geometry={shoulderCapGeo} material={vestMat} position={[0, 0, 0]} />
                <mesh geometry={shoulderPatchGeo} material={teamMat} position={[0.055, 0, 0]} />
                <mesh geometry={upperArmGeo} material={uniformMat} position={[-0.01, -0.10, 0.08]} rotation={[0.4, 0.1, -0.2]} castShadow />
                <mesh geometry={forearmGeo} material={uniformMat} position={[-0.05, -0.18, 0.20]} rotation={[0.6, -0.25, -0.15]} castShadow />
                <mesh geometry={handGeo} material={darkGearMat} position={[-0.10, -0.18, 0.22]} />
              </group>

              {/* --- LEFT ARM (Support Arm: C-clamp rifle grip) --- */}
              <group position={[-0.22, 0.48, 0]}>
                <mesh geometry={shoulderCapGeo} material={vestMat} position={[0, 0, 0]} />
                <mesh geometry={shoulderPatchGeo} material={teamMat} position={[-0.055, 0, 0]} />
                <mesh geometry={upperArmGeo} material={uniformMat} position={[0.03, -0.10, 0.12]} rotation={[0.5, -0.2, 0.2]} castShadow />
                <mesh geometry={forearmGeo} material={uniformMat} position={[0.14, -0.16, 0.32]} rotation={[0.45, 0.4, 0.35]} castShadow />
                <mesh geometry={handGeo} material={darkGearMat} position={[0.28, -0.12, 0.42]} />
              </group>

              {/* --- TACTICAL RIFLE (Braced at chest level, pointing forward) --- */}
              <group position={[0.10, 0.40, 0.24]}>
                <mesh geometry={rifleReceiverGeo} material={gunMat} position={[0, 0, 0]} castShadow />
                <mesh geometry={rifleStockGeo} material={darkGearMat} position={[0, 0.02, -0.21]} />
                <mesh geometry={rifleGripGeo} material={darkGearMat} position={[0.01, -0.09, -0.06]} rotation={[-0.3, 0, 0]} />
                <mesh geometry={rifleMagGeo} material={darkGearMat} position={[0, -0.12, 0.08]} rotation={[0.15, 0, 0]} />
                <mesh geometry={rifleHandguardGeo} material={gunMat} position={[0, 0.01, 0.20]} castShadow />
                <mesh geometry={rifleBarrelGeo} material={gunMat} position={[0, 0.01, 0.42]} rotation={[Math.PI / 2, 0, 0]} castShadow />
                <mesh geometry={rifleMuzzleGeo} material={gunMat} position={[0, 0.01, 0.56]} rotation={[Math.PI / 2, 0, 0]} />

                {/* Tactical Optic / Red Dot Sight */}
                <mesh geometry={rifleOpticGeo} material={gunMat} position={[0, 0.075, 0.04]} />
                <mesh geometry={rifleOpticLensGeo} material={opticLensMat} position={[0, 0.075, 0.10]} rotation={[Math.PI / 2, 0, 0]} />

                {/* Muzzle Flash (Anchored right at rifle barrel tip) */}
                <group
                  ref={(el) => {
                    flashGroups.current[i] = el;
                  }}
                  position={[0, 0.01, 0.62]}
                  visible={false}
                >
                  <mesh geometry={flashPlaneGeo} material={flashMat} />
                  <mesh geometry={flashPlaneGeo} material={flashMat} rotation={[0, 0, Math.PI / 2]} />
                  <mesh geometry={flashPlaneGeo} material={flashMat} rotation={[0, Math.PI / 2, 0]} />
                </group>
              </group>
            </group>

            {/* --- HEAD & COMBAT HELMET (Hitbox center at y=1.56, r=0.27) --- */}
            <group
              ref={(el) => {
                headGroups.current[i] = el;
              }}
              position={[0, 1.56, 0]}
            >
              {/* Balaclava / Face base */}
              <mesh geometry={neckGeo} material={darkGearMat} position={[0, -0.14, 0]} />
              <mesh geometry={headGeo} material={darkGearMat} position={[0, 0, 0]} castShadow />

              {/* Tactical Ballistic Helmet Shell (FAST / MICH style) */}
              <mesh geometry={helmetGeo} material={helmetMat} position={[0, 0.04, -0.01]} castShadow />
              <mesh geometry={helmetRimGeo} material={helmetMat} position={[0, 0.04, -0.01]} />

              {/* Team Colored Helmet Identification Band */}
              <mesh geometry={helmetBandGeo} material={teamMat} position={[0, 0.045, -0.01]} />

              {/* Front Night Vision Mount / Shroud */}
              <mesh geometry={nvgMountGeo} material={gunMat} position={[0, 0.06, 0.22]} />

              {/* Side Accessory ARC Rails */}
              <mesh geometry={arcRailGeo} material={darkGearMat} position={[-0.20, 0.04, 0.02]} rotation={[0, 0, 0.1]} />
              <mesh geometry={arcRailGeo} material={darkGearMat} position={[0.20, 0.04, 0.02]} rotation={[0, 0, -0.1]} />

              {/* Tactical Comms Headset */}
              <mesh geometry={earMuffGeo} material={darkGearMat} position={[-0.19, -0.01, -0.02]} rotation={[0, 0, Math.PI / 2]} />
              <mesh geometry={earMuffGeo} material={darkGearMat} position={[0.19, -0.01, -0.02]} rotation={[0, 0, Math.PI / 2]} />

              {/* Ballistic Goggles & Strap */}
              <mesh geometry={goggleGeo} material={goggleMat} position={[0, 0.02, 0.17]} />
              <mesh geometry={goggleStrapGeo} material={darkGearMat} position={[0, 0.02, -0.02]} />
            </group>
          </group>
        );
      })}
    </group>
  );
}

