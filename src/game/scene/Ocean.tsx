import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useGameStore } from '../store/gameStore';
import { SUN_DIRECTION } from './Sky';

export function Ocean(): JSX.Element {
  const quality = useGameStore((s) => s.settings.quality);
  const qVal = quality === 'low' ? 0 : quality === 'med' ? 1 : 2;
  const segments = quality === 'low' ? 32 : quality === 'med' ? 64 : 96;

  const geometry = useMemo(() => new THREE.PlaneGeometry(2000, 2000, segments, segments), [segments]);

  const oceanMat = useMemo(() => new THREE.ShaderMaterial({
    fog: true,
    depthWrite: true,
    transparent: false,
    uniforms: {
      ...THREE.UniformsLib.fog,
      uTime: { value: 0 },
      uSunDir: { value: SUN_DIRECTION },
      uQuality: { value: qVal },
      uHorizonColor: { value: new THREE.Vector3(0.812, 0.894, 0.957) }, // matches sky horizon & scene fog #cfe4f4
    },
    vertexShader: `
      uniform float uTime;
      uniform float uQuality; // 0=low, 1=med, 2=high

      #ifdef USE_FOG
        #ifdef FOG_EXP2
          uniform float fogDensity;
        #else
          uniform float fogNear;
          uniform float fogFar;
        #endif
      #endif

      varying vec3 vWorldPos;
      varying vec3 vNormal;
      varying float vWaveHeight;
      varying float vFogFactor;

      // Gerstner Wave definition:
      // dir: normalized 2D horizontal wave propagation direction (x, z)
      // amp: wave amplitude (A) in meters
      // k: wavenumber (2 * pi / wavelength)
      // speed: angular phase velocity (omega)
      // Q: steepness factor controlling horizontal crest pinch
      struct GerstnerWave {
        vec2 dir;
        float amp;
        float k;
        float speed;
        float Q;
      };

      void evaluateWave(GerstnerWave w, vec2 xz, float time,
                        inout vec3 disp, inout vec3 normGrad) {
        float phi = w.k * dot(w.dir, xz) + time * w.speed;
        float c = cos(phi);
        float s = sin(phi);

        // Gerstner horizontal pinch (toward crests) and vertical lift
        disp.x += w.Q * w.amp * w.dir.x * c;
        disp.z += w.Q * w.amp * w.dir.y * c;
        disp.y += w.amp * s;

        // Exact partial derivative gradient for analytical normal
        float WA = w.k * w.amp;
        normGrad.x -= w.dir.x * WA * c;
        normGrad.z -= w.dir.y * WA * c;
        normGrad.y -= w.Q * WA * s;
      }

      void main() {
        // Plane geometry is rotated -PI/2 on X axis in model space
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vec2 xz = worldPos.xz;

        vec3 disp = vec3(0.0);
        vec3 normGrad = vec3(0.0, 1.0, 0.0);

        // Wave 1: Primary deep ocean swell from northwest (wavelength ~90m, amp 0.32m)
        GerstnerWave w1 = GerstnerWave(
          normalize(vec2(0.85, 0.52)),
          0.32,
          0.0698,
          1.10,
          1.40
        );
        evaluateWave(w1, xz, uTime, disp, normGrad);

        // Wave 2: Secondary cross-swell (wavelength ~52m, amp 0.18m)
        GerstnerWave w2 = GerstnerWave(
          normalize(vec2(-0.45, 0.89)),
          0.18,
          0.1208,
          1.50,
          1.30
        );
        evaluateWave(w2, xz, uTime, disp, normGrad);

        // Wave 3: Wind-driven surface chop (wavelength ~24m, amp 0.09m, med and high quality)
        if (uQuality > 0.5) {
          GerstnerWave w3 = GerstnerWave(
            normalize(vec2(0.72, -0.69)),
            0.09,
            0.2618,
            2.30,
            1.10
          );
          evaluateWave(w3, xz, uTime, disp, normGrad);
        }

        // Wave 4: Capillary ripples (wavelength ~12m, amp 0.04m, high quality only)
        if (uQuality > 1.5) {
          GerstnerWave w4 = GerstnerWave(
            normalize(vec2(-0.80, -0.60)),
            0.04,
            0.5236,
            3.40,
            0.90
          );
          evaluateWave(w4, xz, uTime, disp, normGrad);
        }

        worldPos.xyz += disp;

        vWorldPos = worldPos.xyz;
        vNormal = normalize(normGrad);
        vWaveHeight = disp.y;

        vec4 mvPosition = viewMatrix * worldPos;
        gl_Position = projectionMatrix * mvPosition;

        // Vertex-based fog integration:
        // Evaluated per-vertex with spherical view distance to eliminate fragment overhead
        #ifdef USE_FOG
          float fogDist = length(mvPosition.xyz);
          #ifdef FOG_EXP2
            vFogFactor = 1.0 - exp(-fogDensity * fogDensity * fogDist * fogDist);
          #else
            vFogFactor = clamp((fogDist - fogNear) / (fogFar - fogNear), 0.0, 1.0);
          #endif
        #else
          float fogDist = length(mvPosition.xyz);
          vFogFactor = clamp((fogDist - 70.0) / (380.0 - 70.0), 0.0, 1.0);
        #endif
      }
    `,
    fragmentShader: `
      uniform float uQuality; // 0=low, 1=med, 2=high
      uniform vec3 uSunDir;
      uniform vec3 uHorizonColor;

      #ifdef USE_FOG
        uniform vec3 fogColor;
      #endif

      varying vec3 vWorldPos;
      varying vec3 vNormal;
      varying float vWaveHeight;
      varying float vFogFactor;

      void main() {
        vec3 V = normalize(cameraPosition - vWorldPos);
        vec3 N = normalize(vNormal);
        if (dot(N, V) < 0.0) N = -N;
        vec3 L = normalize(uSunDir);

        // Water Palette
        vec3 colDeep = vec3(0.038, 0.155, 0.315);    // Deep oceanic navy
        vec3 colShallow = vec3(0.12, 0.44, 0.58);    // Turquoise shallows near yacht
        vec3 colCrest = vec3(0.25, 0.64, 0.76);      // Sunlight wave crest translucency

        // Proximity to yacht perimeter (yacht spans roughly X in [-38, 38], Z in [-13, 13])
        vec2 yachtBox = max(abs(vWorldPos.xz) - vec2(37.5, 12.0), 0.0);
        float distToYacht = length(yachtBox);
        float shallowFactor = clamp(1.0 - distToYacht / 36.0, 0.0, 1.0);
        shallowFactor = smoothstep(0.0, 1.0, shallowFactor);

        // Quality-tiered color bands:
        // low: single ocean color band
        // med: two color bands (deep + shallow near hull)
        // high: three color bands (deep + shallow + crest highlight)
        vec3 waterCol;
        if (uQuality < 0.5) {
          waterCol = colDeep;
        } else if (uQuality < 1.5) {
          waterCol = mix(colDeep, colShallow, shallowFactor * 0.78);
        } else {
          waterCol = mix(colDeep, colShallow, shallowFactor * 0.78);
          float crest = smoothstep(0.10, 0.45, vWaveHeight);
          waterCol = mix(waterCol, colCrest, crest * 0.45);
        }

        // Sky hemisphere ambient light reflection
        float hemi = clamp(N.y * 0.5 + 0.5, 0.0, 1.0);
        vec3 skyHemisphere = mix(vec3(0.03, 0.07, 0.12), vec3(0.14, 0.24, 0.34), hemi);
        waterCol += skyHemisphere;

        // Optical Fresnel reflection towards horizon
        float NdotV = max(dot(N, V), 0.0);
        float fresnel = pow(1.0 - NdotV, 4.0);
        waterCol = mix(waterCol, uHorizonColor * 0.85, fresnel * 0.38);

        // Sun specular highlight aligned with sun direction
        vec3 H = normalize(V + L);
        float NdotH = max(dot(N, H), 0.0);
        float specSharp = pow(NdotH, 260.0);
        float specGlint = pow(NdotH, 40.0);
        vec3 sunColor = vec3(1.0, 0.95, 0.85);
        vec3 specular = (specSharp * 1.35 + specGlint * 0.30) * sunColor;
        waterCol += specular;

        // Soft static foam band around the hull
        float foamRing = smoothstep(5.5, 0.2, distToYacht) * (1.0 - smoothstep(8.0, 24.0, distToYacht));
        vec3 foamCol = vec3(0.92, 0.96, 0.98);
        waterCol = mix(waterCol, foamCol, foamRing * 0.75);

        // Vertex-based fog integration blend
        #ifdef USE_FOG
          waterCol = mix(waterCol, fogColor, vFogFactor);
        #else
          waterCol = mix(waterCol, uHorizonColor, vFogFactor);
        #endif

        gl_FragColor = vec4(waterCol, 1.0);
      }
    `,
  }), [qVal]);

  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    oceanMat.uniforms.uTime.value = clock.getElapsedTime();
  });

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      material={oceanMat}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, -3.1, 0]}
    />
  );
}
