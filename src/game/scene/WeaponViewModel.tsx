import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { T } from '../store/transient';
import { useGameStore } from '../store/gameStore';
import { W } from '../weapons/WeaponState';
import { clamp, lerp } from '../utils/MathUtils';

// --- Hip and ADS Rest Positions ---
const HIP_POS = { x: 0.24, y: -0.22, z: -0.50 };
const ADS_POS = { x: 0.00, y: -0.14, z: -0.32 };

// --- Muzzle Barrel Tip Offsets per Weapon (Negative Z = forward) ---
const MUZZLE_Z: Record<string, number> = {
  ar: -0.62,
  smg: -0.50,
  dmr: -0.80,
  sg: -0.64,
  pistol: -0.36,
};

// --- Shared Weapon Materials (Created once at module scope) ---
const MAT_METAL = new THREE.MeshStandardMaterial({
  color: 0x2a2f36,
  roughness: 0.4,
  metalness: 0.65,
});

const MAT_GRIP = new THREE.MeshStandardMaterial({
  color: 0x16181c,
  roughness: 0.8,
});

const MAT_ACCENT = new THREE.MeshStandardMaterial({
  color: 0x3a2f10,
  emissive: new THREE.Color(0xffb100),
  emissiveIntensity: 0.9,
  roughness: 0.5,
});

const MAT_WOOD = new THREE.MeshStandardMaterial({
  color: 0x5d3a26,
  roughness: 0.7,
});

const MAT_LENS = new THREE.MeshStandardMaterial({
  color: 0x7fd8ff,
  emissive: new THREE.Color(0x7fd8ff),
  emissiveIntensity: 1.5,
  roughness: 0.1,
});

const MAT_FLASH = new THREE.MeshBasicMaterial({
  color: 0xffe6b0,
  transparent: true,
  opacity: 0.95,
  side: THREE.DoubleSide,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  depthTest: false,
});

// --- Module-Scope Scratch Objects for Zero-Allocation Transforms ---
const _localOffset = new THREE.Vector3();
const _localEuler = new THREE.Euler(0, 0, 0, 'YXZ');
const _localQuat = new THREE.Quaternion();
const _worldPos = new THREE.Vector3();
const _worldQuat = new THREE.Quaternion();
const _muzzleLocal = new THREE.Vector3();
const _muzzleWorld = new THREE.Vector3();

// --- Procedural Weapon Meshes per Class ---
function GunParts({
  id,
  magRef,
  boltRef,
}: {
  id: string;
  magRef: React.RefObject<THREE.Group>;
  boltRef: React.RefObject<THREE.Group>;
}): JSX.Element {
  switch (id) {
    case 'smg': // CAP RAPID — Stubby, suppressed submachine gun
      return (
        <group>
          {/* Receiver / Body */}
          <mesh position={[0, 0, -0.06]} material={MAT_METAL}>
            <boxGeometry args={[0.068, 0.095, 0.32]} />
          </mesh>
          {/* Integral Suppressor Barrel */}
          <mesh position={[0, 0.01, -0.34]} rotation={[Math.PI / 2, 0, 0]} material={MAT_METAL}>
            <cylinderGeometry args={[0.025, 0.025, 0.28, 12]} />
          </mesh>
          {/* Vertical Foregrip under suppressor */}
          <mesh position={[0, -0.10, -0.24]} material={MAT_GRIP}>
            <boxGeometry args={[0.038, 0.11, 0.045]} />
          </mesh>
          {/* Angled Stick Magazine well forward of grip */}
          <group ref={magRef}>
            <mesh position={[0, -0.15, -0.04]} rotation={[0.22, 0, 0]} material={MAT_METAL}>
              <boxGeometry args={[0.038, 0.20, 0.05]} />
            </mesh>
          </group>
          {/* Pistol Grip */}
          <mesh position={[0, -0.10, 0.10]} rotation={[-0.30, 0, 0]} material={MAT_GRIP}>
            <boxGeometry args={[0.042, 0.11, 0.055]} />
          </mesh>
          {/* Compact Stock */}
          <mesh position={[0, 0.01, 0.18]} material={MAT_GRIP}>
            <boxGeometry args={[0.048, 0.06, 0.16]} />
          </mesh>
          {/* Top Sight Rail */}
          <mesh position={[0, 0.055, -0.06]} material={MAT_METAL}>
            <boxGeometry args={[0.032, 0.016, 0.22]} />
          </mesh>
          {/* Front Sight Nub & Rear Notch */}
          <mesh position={[0, 0.075, -0.20]} material={MAT_ACCENT}>
            <boxGeometry args={[0.010, 0.026, 0.010]} />
          </mesh>
          <mesh position={[0, 0.075, 0.04]} material={MAT_ACCENT}>
            <boxGeometry args={[0.022, 0.024, 0.012]} />
          </mesh>
          {/* Side Charging Handle */}
          <group ref={boltRef}>
            <mesh position={[0.036, 0.035, -0.10]} material={MAT_ACCENT}>
              <boxGeometry args={[0.014, 0.014, 0.04]} />
            </mesh>
          </group>
        </group>
      );

    case 'dmr': // VIBE DMR — Long-range precision rifle with sniper scope & bipod
      return (
        <group>
          {/* Extended Precision Receiver */}
          <mesh position={[0, 0, 0.02]} material={MAT_METAL}>
            <boxGeometry args={[0.070, 0.095, 0.58]} />
          </mesh>
          {/* Heavy Match Barrel */}
          <mesh position={[0, 0.01, -0.52]} rotation={[Math.PI / 2, 0, 0]} material={MAT_METAL}>
            <cylinderGeometry args={[0.015, 0.015, 0.48, 10]} />
          </mesh>
          {/* Muzzle Brake */}
          <mesh position={[0, 0.01, -0.78]} rotation={[Math.PI / 2, 0, 0]} material={MAT_METAL}>
            <cylinderGeometry args={[0.022, 0.022, 0.06, 8]} />
          </mesh>
          {/* Sniper Scope Tube */}
          <mesh position={[0, 0.11, -0.04]} rotation={[Math.PI / 2, 0, 0]} material={MAT_METAL}>
            <cylinderGeometry args={[0.032, 0.032, 0.28, 12]} />
          </mesh>
          {/* Scope Objective Bell (Front) */}
          <mesh position={[0, 0.11, -0.19]} rotation={[Math.PI / 2, 0, 0]} material={MAT_METAL}>
            <cylinderGeometry args={[0.042, 0.032, 0.06, 12]} />
          </mesh>
          {/* Illuminated Lens Disc */}
          <mesh position={[0, 0.11, -0.22]} rotation={[Math.PI / 2, 0, 0]} material={MAT_LENS}>
            <cylinderGeometry args={[0.038, 0.038, 0.005, 12]} />
          </mesh>
          {/* Scope Eyepiece (Rear) */}
          <mesh position={[0, 0.11, 0.11]} rotation={[Math.PI / 2, 0, 0]} material={MAT_METAL}>
            <cylinderGeometry args={[0.038, 0.032, 0.05, 12]} />
          </mesh>
          {/* Scope Mount Rings */}
          <mesh position={[0, 0.06, -0.10]} material={MAT_METAL}>
            <boxGeometry args={[0.030, 0.040, 0.030]} />
          </mesh>
          <mesh position={[0, 0.06, 0.06]} material={MAT_METAL}>
            <boxGeometry args={[0.030, 0.040, 0.030]} />
          </mesh>
          {/* Elevation Turret */}
          <mesh position={[0, 0.145, -0.04]} material={MAT_METAL}>
            <boxGeometry args={[0.022, 0.020, 0.022]} />
          </mesh>
          {/* Bipod Mount Stub */}
          <mesh position={[0, -0.06, -0.32]} material={MAT_METAL}>
            <boxGeometry args={[0.038, 0.032, 0.05]} />
          </mesh>
          {/* Folded Bipod Legs */}
          <mesh position={[-0.032, -0.08, -0.25]} material={MAT_METAL}>
            <boxGeometry args={[0.012, 0.012, 0.16]} />
          </mesh>
          <mesh position={[0.032, -0.08, -0.25]} material={MAT_METAL}>
            <boxGeometry args={[0.012, 0.012, 0.16]} />
          </mesh>
          {/* 12-round DMR Magazine */}
          <group ref={magRef}>
            <mesh position={[0, -0.14, 0.06]} rotation={[0.08, 0, 0]} material={MAT_METAL}>
              <boxGeometry args={[0.045, 0.18, 0.09]} />
            </mesh>
          </group>
          {/* Sniper Pistol Grip */}
          <mesh position={[0, -0.11, 0.22]} rotation={[-0.35, 0, 0]} material={MAT_GRIP}>
            <boxGeometry args={[0.045, 0.12, 0.065]} />
          </mesh>
          {/* Marksman Fixed Stock with Cheek Rest */}
          <mesh position={[0, -0.01, 0.40]} material={MAT_GRIP}>
            <boxGeometry args={[0.048, 0.09, 0.20]} />
          </mesh>
          <mesh position={[0, 0.055, 0.38]} material={MAT_GRIP}>
            <boxGeometry args={[0.040, 0.032, 0.12]} />
          </mesh>
          {/* Bolt Handle */}
          <group ref={boltRef}>
            <mesh position={[0.042, 0.03, 0.06]} material={MAT_ACCENT}>
              <boxGeometry args={[0.025, 0.016, 0.04]} />
            </mesh>
          </group>
        </group>
      );

    case 'sg': // YACHT CANNON — Pump shotgun with real warm walnut wood furniture
      return (
        <group>
          {/* Thick Solid Shotgun Receiver */}
          <mesh position={[0, 0, -0.04]} material={MAT_METAL}>
            <boxGeometry args={[0.082, 0.11, 0.38]} />
          </mesh>
          {/* Wide 12-Gauge Barrel */}
          <mesh position={[0, 0.02, -0.42]} rotation={[Math.PI / 2, 0, 0]} material={MAT_METAL}>
            <cylinderGeometry args={[0.026, 0.026, 0.40, 12]} />
          </mesh>
          {/* Tubular Magazine Tube */}
          <mesh position={[0, -0.025, -0.40]} rotation={[Math.PI / 2, 0, 0]} material={MAT_METAL}>
            <cylinderGeometry args={[0.019, 0.019, 0.38, 10]} />
          </mesh>
          {/* Pump Foregrip Handle (Warm Wood) */}
          <group ref={boltRef}>
            <mesh position={[0, -0.025, -0.32]} material={MAT_WOOD}>
              <boxGeometry args={[0.062, 0.065, 0.18]} />
            </mesh>
          </group>
          {/* Fresh shell entering port */}
          <group ref={magRef}>
            <mesh position={[0, -0.055, -0.08]} rotation={[0.4, 0, 0]} material={MAT_ACCENT}>
              <cylinderGeometry args={[0.012, 0.012, 0.06, 8]} />
            </mesh>
          </group>
          {/* Full Wooden Stock */}
          <mesh position={[0, -0.03, 0.28]} material={MAT_WOOD}>
            <boxGeometry args={[0.055, 0.11, 0.26]} />
          </mesh>
          {/* Grip Neck (Warm Wood) */}
          <mesh position={[0, -0.09, 0.11]} rotation={[-0.32, 0, 0]} material={MAT_WOOD}>
            <boxGeometry args={[0.048, 0.08, 0.07]} />
          </mesh>
          {/* Rubber Recoil Buttpad */}
          <mesh position={[0, -0.03, 0.415]} material={MAT_GRIP}>
            <boxGeometry args={[0.056, 0.115, 0.015]} />
          </mesh>
          {/* Front Brass Sight Bead */}
          <mesh position={[0, 0.055, -0.62]} material={MAT_ACCENT}>
            <boxGeometry args={[0.012, 0.014, 0.012]} />
          </mesh>
          {/* Side Ejection Port */}
          <mesh position={[0.042, 0.02, -0.06]} material={MAT_GRIP}>
            <boxGeometry args={[0.008, 0.035, 0.08]} />
          </mesh>
        </group>
      );

    case 'pistol': // FLOP-45 — Tactical polymer/steel compact sidearm
      return (
        <group>
          {/* Steel Slide that cycles backwards */}
          <group ref={boltRef}>
            <mesh position={[0, 0.02, -0.10]} material={MAT_METAL}>
              <boxGeometry args={[0.052, 0.068, 0.26]} />
            </mesh>
            <mesh position={[0, 0.062, -0.21]} material={MAT_ACCENT}>
              <boxGeometry args={[0.008, 0.018, 0.012]} />
            </mesh>
            <mesh position={[0, 0.062, 0.02]} material={MAT_GRIP}>
              <boxGeometry args={[0.022, 0.016, 0.012]} />
            </mesh>
          </group>
          {/* Polymer Lower Receiver / Frame */}
          <mesh position={[0, -0.015, -0.08]} material={MAT_GRIP}>
            <boxGeometry args={[0.048, 0.035, 0.24]} />
          </mesh>
          {/* Barrel poking out the slide front */}
          <mesh position={[0, 0.022, -0.27]} rotation={[Math.PI / 2, 0, 0]} material={MAT_METAL}>
            <cylinderGeometry args={[0.016, 0.016, 0.14, 10]} />
          </mesh>
          {/* Angled Pistol Grip */}
          <mesh position={[0, -0.085, 0.02]} rotation={[-0.25, 0, 0]} material={MAT_GRIP}>
            <boxGeometry args={[0.044, 0.13, 0.065]} />
          </mesh>
          {/* Trigger Guard */}
          <mesh position={[0, -0.06, -0.06]} material={MAT_GRIP}>
            <boxGeometry args={[0.030, 0.040, 0.06]} />
          </mesh>
          {/* Magazine Baseplate & Column */}
          <group ref={magRef}>
            <mesh position={[0, -0.155, 0.04]} rotation={[-0.25, 0, 0]} material={MAT_METAL}>
              <boxGeometry args={[0.048, 0.02, 0.075]} />
            </mesh>
            <mesh position={[0, -0.11, 0.025]} rotation={[-0.25, 0, 0]} material={MAT_METAL}>
              <boxGeometry args={[0.038, 0.09, 0.055]} />
            </mesh>
          </group>
        </group>
      );

    default: // 'ar' SLOP-7 — Standard tactical assault rifle
      return (
        <group>
          {/* Receiver Body */}
          <mesh position={[0, 0, 0]} material={MAT_METAL}>
            <boxGeometry args={[0.072, 0.095, 0.50]} />
          </mesh>
          {/* Handguard around barrel */}
          <mesh position={[0, 0.005, -0.27]} material={MAT_GRIP}>
            <boxGeometry args={[0.062, 0.072, 0.24]} />
          </mesh>
          {/* Barrel Cylinder */}
          <mesh position={[0, 0.01, -0.45]} rotation={[Math.PI / 2, 0, 0]} material={MAT_METAL}>
            <cylinderGeometry args={[0.015, 0.015, 0.28, 10]} />
          </mesh>
          {/* Muzzle Brake at tip */}
          <mesh position={[0, 0.01, -0.60]} rotation={[Math.PI / 2, 0, 0]} material={MAT_METAL}>
            <cylinderGeometry args={[0.020, 0.020, 0.05, 10]} />
          </mesh>
          {/* Top Picatinny Rail / Carry Handle */}
          <mesh position={[0, 0.055, -0.04]} material={MAT_METAL}>
            <boxGeometry args={[0.032, 0.020, 0.32]} />
          </mesh>
          {/* Rear Peep Sight Ring */}
          <mesh position={[0, 0.078, 0.14]} rotation={[Math.PI / 2, 0, 0]} material={MAT_METAL}>
            <torusGeometry args={[0.022, 0.006, 8, 16]} />
          </mesh>
          {/* Front Sight Post / Gas Block */}
          <mesh position={[0, 0.072, -0.42]} material={MAT_ACCENT}>
            <boxGeometry args={[0.012, 0.048, 0.016]} />
          </mesh>
          {/* Magazine Well */}
          <mesh position={[0, -0.06, -0.04]} material={MAT_METAL}>
            <boxGeometry args={[0.056, 0.05, 0.09]} />
          </mesh>
          {/* 30-round Curved Mag */}
          <group ref={magRef}>
            <mesh position={[0, -0.15, -0.02]} rotation={[0.16, 0, 0]} material={MAT_METAL}>
              <boxGeometry args={[0.042, 0.17, 0.08]} />
            </mesh>
          </group>
          {/* Angled Pistol Grip */}
          <mesh position={[0, -0.11, 0.16]} rotation={[-0.32, 0, 0]} material={MAT_GRIP}>
            <boxGeometry args={[0.044, 0.12, 0.06]} />
          </mesh>
          {/* Tactical Buttstock */}
          <mesh position={[0, -0.01, 0.33]} material={MAT_GRIP}>
            <boxGeometry args={[0.050, 0.09, 0.18]} />
          </mesh>
          {/* Side Charging Handle / Bolt */}
          <group ref={boltRef}>
            <mesh position={[0.038, 0.025, 0.04]} material={MAT_ACCENT}>
              <boxGeometry args={[0.015, 0.015, 0.05]} />
            </mesh>
          </group>
        </group>
      );
  }
}

/**
 * First-person weapon viewmodel.
 *
 * Positioned and rotated in world space every frame to follow the camera without
 * reparenting or portal hijacking, guaranteeing rock-solid stability across pauses,
 * resumes, and match restarts with zero per-frame garbage allocations.
 */
export function WeaponViewModel(): JSX.Element {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const group = useRef<THREE.Group>(null);
  const flashRef = useRef<THREE.Mesh>(null);
  const magGroup = useRef<THREE.Group>(null);
  const boltGroup = useRef<THREE.Group>(null);
  const [wid, setWid] = useState<string>(T.viewmodel.wid);

  // Ensure all weapon meshes render over the world geometry
  useEffect(() => {
    if (group.current) {
      group.current.traverse((child) => {
        if (child instanceof THREE.Mesh && child !== flashRef.current) {
          child.renderOrder = 999;
        }
      });
    }
  }, [wid]);

  useFrame(() => {
    const g = group.current;
    if (!g) return;

    // Reactively swap geometry when active weapon slot changes
    if (T.viewmodel.wid !== wid) {
      setWid(T.viewmodel.wid);
    }

    const ads = T.player.ads;
    const reloading = W.state === 'reload';
    const swapping = W.state === 'swap';
    const swapP = swapping ? clamp(W.t / 0.45, 0, 1) : 0;
    const reloadP = reloading ? clamp(W.t / W.def().reloadTime, 0, 1) : 0;

    // Bobbing: hip fire only, muted during ADS
    const bobAmt = T.player.grounded ? clamp(T.player.speed / 7, 0, 1) * (1 - ads * 0.8) : 0;
    const bobX = Math.cos(T.player.bobPhase) * 0.009 * bobAmt;
    const bobY = Math.sin(T.player.bobPhase * 2) * 0.012 * bobAmt;

    // Tactile multi-phase reload choreography:
    let relX = 0;
    let relY = 0;
    let relZ = 0;
    let relPitch = 0;
    let relYaw = 0;
    let relRoll = 0;

    let magY = 0;
    let magZ = 0;
    let magRotX = 0;
    let magVisible = true;

    let boltZ = 0;

    if (reloading) {
      if (reloadP < 0.25) {
        // Stage 1 (0.00 - 0.25): Tilt gun, eject magazine
        const t1 = reloadP / 0.25;
        relX = -0.05 * Math.sin(t1 * Math.PI * 0.5);
        relY = -0.06 * Math.sin(t1 * Math.PI * 0.5);
        relRoll = -0.32 * Math.sin(t1 * Math.PI * 0.5);
        relPitch = 0.16 * Math.sin(t1 * Math.PI * 0.5);
        relYaw = 0.07 * Math.sin(t1 * Math.PI * 0.5);

        // Mag drops out downwards
        magY = -0.32 * (t1 * t1);
        magZ = 0.05 * t1;
        magRotX = 0.35 * t1;
        if (t1 > 0.82) magVisible = false;
      } else if (reloadP < 0.70) {
        // Stage 2 (0.25 - 0.70): Gun held tilted; fresh mag enters and slaps in
        const t2 = (reloadP - 0.25) / 0.45;
        relX = -0.05;
        relY = -0.06;
        relRoll = -0.32;
        relPitch = 0.16;
        relYaw = 0.07;

        if (t2 < 0.72) {
          // New mag rises from below
          const riseT = t2 / 0.72;
          magVisible = true;
          magY = -0.28 * (1 - riseT);
          magZ = 0.04 * (1 - riseT);
          magRotX = 0.18 * (1 - riseT);
        } else {
          // Mag seated! Tactile slap/jolt at 0.72 - 1.00
          magVisible = true;
          magY = 0;
          magZ = 0;
          magRotX = 0;
          const slapT = (t2 - 0.72) / 0.28;
          relY = -0.06 + 0.038 * Math.sin(slapT * Math.PI);
          relPitch = 0.16 - 0.09 * Math.sin(slapT * Math.PI);
        }
      } else if (reloadP < 0.88) {
        // Stage 3 (0.70 - 0.88): Bolt rack / Slide pull / Shotgun pump
        const t3 = (reloadP - 0.70) / 0.18;
        relX = -0.03 * (1 - t3);
        relRoll = -0.20 * (1 - t3);
        relYaw = 0.04 * (1 - t3);

        if (t3 < 0.5) {
          const pull = t3 / 0.5;
          boltZ = wid === 'sg' ? 0.09 * pull : 0.055 * pull;
          relPitch = 0.08 + 0.06 * pull;
          relZ = 0.025 * pull;
        } else {
          const snap = (t3 - 0.5) / 0.5;
          boltZ = wid === 'sg' ? 0.09 * (1 - snap) : 0.055 * (1 - snap);
          relPitch = 0.14 - 0.14 * snap;
          relZ = 0.025 * (1 - snap);
        }
      } else {
        // Stage 4 (0.88 - 1.00): Return smoothly to hip ready stance
        const t4 = (reloadP - 0.88) / 0.12;
        const ret = 1 - t4;
        relX = -0.02 * ret;
        relY = -0.02 * ret;
        relRoll = -0.08 * ret;
        relPitch = 0.04 * ret;
        boltZ = 0;
        magY = 0;
      }
    } else {
      magVisible = true;
      magY = 0;
      magZ = 0;
      magRotX = 0;
      boltZ = 0;
    }

    if (magGroup.current) {
      magGroup.current.position.set(0, magY, magZ);
      magGroup.current.rotation.x = magRotX;
      magGroup.current.visible = magVisible;
    }

    if (boltGroup.current) {
      boltGroup.current.position.set(0, 0, boltZ);
    }

    // Local position: lerp between Hip and ADS + bob + dips + recoil kick + reload motion
    const lx = lerp(HIP_POS.x, ADS_POS.x, ads) + bobX + relX;
    const ly =
      lerp(HIP_POS.y, ADS_POS.y, ads) +
      bobY +
      relY -
      Math.sin(swapP * Math.PI) * 0.30;
    const lz = lerp(HIP_POS.z, ADS_POS.z, ads) + T.viewmodel.kick + relZ;
    _localOffset.set(lx, ly, lz);

    // Local rotation: kick pitch + reload tilt + subtle sway + roll
    const pitch = T.viewmodel.kick * 1.6 + relPitch;
    const yaw = Math.sin(T.player.bobPhase) * 0.008 * bobAmt + relYaw;
    const roll = relRoll;
    _localEuler.set(pitch, yaw, roll);
    _localQuat.setFromEuler(_localEuler);

    // Drive WORLD transform to track camera directly without reconciler conflict
    _worldPos.copy(_localOffset).applyQuaternion(camera.quaternion).add(camera.position);
    _worldQuat.copy(camera.quaternion).multiply(_localQuat);

    g.position.copy(_worldPos);
    g.quaternion.copy(_worldQuat);

    // FOV-size compensation so the gun does not shrink/grow disproportionately on ADS zoom
    const baseFov = useGameStore.getState().settings.fov;
    const halfBase = Math.tan((baseFov * Math.PI) / 360);
    const halfCur = Math.tan((T.cam.fov * Math.PI) / 360);
    const gunScale = 1.5 * Math.max(0.35, halfCur / halfBase);
    g.scale.setScalar(gunScale);

    // Muzzle flash visibility, flicker rotation, and pulse scale
    const flashMesh = flashRef.current;
    if (flashMesh) {
      const isFlashing = T.viewmodel.flash > 0.35;
      flashMesh.visible = isFlashing;
      if (isFlashing) {
        flashMesh.rotation.z = Math.random() * Math.PI * 2;
        const s = 0.7 + T.viewmodel.flash * 0.6;
        flashMesh.scale.set(s, s, s);
      }
    }

    // Update world-space muzzle coordinate for bullet tracers
    const mz = MUZZLE_Z[wid] ?? -0.60;
    _muzzleLocal.set(0, 0.01, mz).multiplyScalar(gunScale);
    _muzzleWorld.copy(_muzzleLocal).applyQuaternion(_worldQuat).add(_worldPos);
    T.viewmodel.muzzle.copy(_muzzleWorld);
  });

  const muzzleZ = MUZZLE_Z[wid] ?? -0.60;

  return (
    <group ref={group} renderOrder={999}>
      <GunParts id={wid} magRef={magGroup} boltRef={boltGroup} />
      <mesh
        ref={flashRef}
        position={[0, 0.01, muzzleZ - 0.03]}
        material={MAT_FLASH}
        renderOrder={1000}
        visible={false}
      >
        <planeGeometry args={[0.26, 0.26]} />
      </mesh>
    </group>
  );
}
