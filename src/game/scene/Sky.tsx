import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useGameStore } from '../store/gameStore';

/**
 * Global sun direction shared between visible sky dome and scene directional light.
 * Direction from origin towards (60, 90, 30).
 */
export const SUN_DIRECTION = new THREE.Vector3(60, 90, 30).normalize();

// Pre-allocated scratch objects for zero-allocation useFrame updates
const _scratchPos = new THREE.Vector3();
const _scratchQuat = new THREE.Quaternion();
const _scratchScale = new THREE.Vector3(1, 1, 1);
const _scratchMatrix = new THREE.Matrix4();

interface BirdTrack {
  radius: number;
  height: number;
  speed: number;
  phase: number;
  bobFreq: number;
  bobAmp: number;
  scale: number;
}

// 12 unique orbital tracks circling the yacht (radius 40-80m, height 20-45m)
const BIRD_TRACKS: readonly BirdTrack[] = [
  { radius: 45, height: 24, speed: 0.14, phase: 0.2, bobFreq: 0.8, bobAmp: 1.6, scale: 1.1 },
  { radius: 52, height: 28, speed: 0.11, phase: 1.4, bobFreq: 0.7, bobAmp: 2.1, scale: 1.0 },
  { radius: 60, height: 32, speed: 0.09, phase: 2.7, bobFreq: 0.9, bobAmp: 1.8, scale: 1.2 },
  { radius: 42, height: 22, speed: 0.16, phase: 3.9, bobFreq: 1.1, bobAmp: 1.4, scale: 0.95 },
  { radius: 68, height: 38, speed: 0.08, phase: 4.8, bobFreq: 0.6, bobAmp: 2.4, scale: 1.25 },
  { radius: 56, height: 26, speed: 0.12, phase: 5.6, bobFreq: 0.85, bobAmp: 1.7, scale: 1.05 },
  { radius: 74, height: 42, speed: 0.07, phase: 0.9, bobFreq: 0.55, bobAmp: 2.6, scale: 1.3 },
  { radius: 48, height: 30, speed: 0.13, phase: 2.1, bobFreq: 0.95, bobAmp: 1.9, scale: 1.0 },
  { radius: 64, height: 35, speed: 0.085, phase: 3.3, bobFreq: 0.75, bobAmp: 2.2, scale: 1.15 },
  { radius: 78, height: 44, speed: 0.065, phase: 4.4, bobFreq: 0.5, bobAmp: 2.8, scale: 1.35 },
  { radius: 50, height: 25, speed: 0.125, phase: 5.2, bobFreq: 1.0, bobAmp: 1.5, scale: 0.98 },
  { radius: 70, height: 36, speed: 0.075, phase: 6.1, bobFreq: 0.65, bobAmp: 2.3, scale: 1.2 },
];

let gullTexture: THREE.CanvasTexture | null = null;
function getGullTexture(): THREE.CanvasTexture {
  if (gullTexture) return gullTexture;
  const cv = document.createElement('canvas');
  cv.width = 128;
  cv.height = 128;
  const ctx = cv.getContext('2d')!;
  ctx.clearRect(0, 0, 128, 128);

  // Smooth silhouette of flying gull in dark charcoal
  ctx.fillStyle = '#1c2128';
  ctx.beginPath();
  // Beak & Head
  ctx.moveTo(64, 44);
  // Right wing leading edge
  ctx.quadraticCurveTo(86, 36, 122, 44);
  // Right wing trailing edge
  ctx.quadraticCurveTo(94, 58, 68, 56);
  // Tail
  ctx.lineTo(64, 76);
  // Left wing trailing edge
  ctx.lineTo(60, 56);
  ctx.quadraticCurveTo(34, 58, 6, 44);
  // Left wing leading edge
  ctx.quadraticCurveTo(42, 36, 64, 44);
  ctx.closePath();
  ctx.fill();

  gullTexture = new THREE.CanvasTexture(cv);
  gullTexture.colorSpace = THREE.SRGBColorSpace;
  return gullTexture;
}

let sharedBirdMaterial: THREE.MeshBasicMaterial | null = null;
function getBirdMaterial(): THREE.MeshBasicMaterial {
  if (sharedBirdMaterial) return sharedBirdMaterial;
  sharedBirdMaterial = new THREE.MeshBasicMaterial({
    map: getGullTexture(),
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  return sharedBirdMaterial;
}

const birdGeometry = new THREE.PlaneGeometry(1.9, 1.2);

export function Sky(): JSX.Element {
  const quality = useGameStore((s) => s.settings.quality);
  const qVal = quality === 'low' ? 0 : quality === 'med' ? 1 : 2;
  const birdCount = quality === 'low' ? 0 : quality === 'med' ? 6 : 12;

  const skyMat = useMemo(() => new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uSunDir: { value: SUN_DIRECTION },
      uTime: { value: 0 },
      uQuality: { value: qVal },
    },
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vDir;
      uniform vec3 uSunDir;
      uniform float uTime;
      uniform float uQuality; // 0.0 = low, 1.0 = med, 2.0 = high

      // Procedural noise for FBM clouds
      float hash(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float a = hash(i);
        float b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0));
        float d = hash(i + vec2(1.0, 1.0));
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }

      void main() {
        vec3 d = normalize(vDir);
        float h = clamp(d.y * 0.5 + 0.5, 0.0, 1.0);

        // Horizon & Zenith color gradient
        vec3 hor = vec3(0.812, 0.894, 0.957); // matches scene fog #cfe4f4
        vec3 zen = vec3(0.18, 0.44, 0.82);
        vec3 col = mix(hor, zen, pow(h, 0.72));

        // Faint horizon haze band just above the waterline:
        // Seamlessly blends into the ocean's horizon haze at d.y == 0
        float hazeBand = exp(-max(d.y, 0.0) * 16.0);
        col = mix(col, hor, hazeBand * 0.75);

        // Enhanced Sun Disk: sharp core + inner glow + soft annular bloom ring + outer halo
        float s = max(dot(d, uSunDir), 0.0);
        vec3 sunColor = vec3(1.0, 0.93, 0.80);

        float core = pow(s, 1600.0) * 1.8;
        float innerGlow = pow(s, 220.0) * 0.65;
        // Soft bloom ring around the solar disk
        float bloomRing = smoothstep(0.988, 0.995, s) * (1.0 - smoothstep(0.995, 0.9988, s)) * 0.5;
        float outerHalo = pow(s, 18.0) * 0.28;

        col += sunColor * (core + innerGlow + bloomRing + outerHalo);

        // Subtle god-ray hint on the horizon (High quality only)
        if (uQuality > 1.5) {
          float rayAngle = atan(d.x - uSunDir.x, d.y - uSunDir.y);
          float rays = sin(rayAngle * 14.0 + uTime * 0.03) * 0.5 + 0.5;
          float godRay = rays * pow(s, 7.0) * smoothstep(0.01, 0.35, d.y) * 0.18;
          col += vec3(1.0, 0.95, 0.85) * godRay;
        }

        // Procedural 2D FBM clouds:
        // low: no clouds (0 octaves)
        // med: 1 octave layer
        // high: 2 octave layers
        if (uQuality > 0.5 && d.y > 0.02) {
          vec2 skyCoord = (d.xz / max(d.y, 0.06)) * 0.28;
          vec2 drift = vec2(uTime * 0.005, uTime * 0.0025);

          float cloudNoise = 0.0;
          if (uQuality > 1.5) {
            cloudNoise = noise(skyCoord * 2.2 + drift);
            cloudNoise += 0.5 * noise(skyCoord * 4.6 - drift * 1.3);
            cloudNoise /= 1.5;
          } else {
            cloudNoise = noise(skyCoord * 2.2 + drift);
          }

          float cloudMask = smoothstep(0.52, 0.80, cloudNoise) * smoothstep(0.02, 0.22, d.y);
          vec3 cloudColor = mix(vec3(0.94, 0.96, 0.98), vec3(1.0, 0.97, 0.91), pow(s, 4.0));
          col = mix(col, cloudColor, cloudMask * 0.72);
        }

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  }), [qVal]);

  const instancedMeshRef = useRef<THREE.InstancedMesh>(null);

  useFrame(({ clock, camera }) => {
    const t = clock.getElapsedTime();
    skyMat.uniforms.uTime.value = t;

    const mesh = instancedMeshRef.current;
    if (!mesh || birdCount === 0) return;

    // Update circling seagulls with zero per-frame object allocations
    for (let i = 0; i < birdCount; i++) {
      const b = BIRD_TRACKS[i];
      const angle = b.phase + t * b.speed;
      const x = Math.cos(angle) * b.radius;
      const z = Math.sin(angle) * b.radius;
      const y = b.height + Math.sin(t * b.bobFreq + b.phase) * b.bobAmp;

      _scratchPos.set(x, y, z);
      _scratchQuat.copy(camera.quaternion);
      _scratchScale.set(b.scale, b.scale, b.scale);
      _scratchMatrix.compose(_scratchPos, _scratchQuat, _scratchScale);
      mesh.setMatrixAt(i, _scratchMatrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      {/* Sky dome backdrop */}
      <mesh material={skyMat} frustumCulled={false} renderOrder={-10}>
        <sphereGeometry args={[460, 32, 24]} />
      </mesh>

      {/* Circling visual seagulls */}
      {birdCount > 0 && (
        <instancedMesh
          ref={instancedMeshRef}
          args={[birdGeometry, getBirdMaterial(), birdCount]}
          frustumCulled={false}
        />
      )}
    </group>
  );
}
