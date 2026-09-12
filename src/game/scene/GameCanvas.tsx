import { Suspense, useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { MapMeshes } from './Map';
import { Player } from './Player';
import { BotsView } from './BotsView';
import { GrenadeView } from './Grenades';
import { Effects } from './Effects';
import { WeaponViewModel } from './WeaponViewModel';
import { GameLoop } from './GameLoop';
import { useGameStore } from '../store/gameStore';
import { Input } from '../input/InputManager';
import { LoadingScreen } from '../../components/LoadingScreen';

function ReadyNotifier({ onReady }: { onReady: () => void }): null {
  useEffect(() => {
    onReady();
  }, [onReady]);
  return null;
}

export function GameCanvas(): JSX.Element {
  const quality = useGameStore((s) => s.settings.quality);
  const [ready, setReady] = useState(false);

  return (
    <>
      {!ready && <LoadingScreen />}
      <Canvas
        className="absolute inset-0"
        style={{ touchAction: 'none' }}
        dpr={quality === 'low' ? 1 : quality === 'med' ? 1.5 : 2}
        shadows={quality === 'high'}
        camera={{ fov: 80, near: 0.04, far: 600, position: [-34, 1.62, 8] }}
        gl={{ antialias: quality !== 'low', powerPreference: 'high-performance' }}
        onCreated={({ gl, camera }) => {
          gl.toneMappingExposure = 1.12;
          camera.rotation.order = 'YXZ';
          Input.attachCanvas(gl.domElement);
        }}
      >
        <color attach="background" args={['#cfe4f4']} />
        <fog attach="fog" args={['#cfe4f4', 70, 380]} />
        <Suspense fallback={null}>
          <PhysicsWorld>
            <ReadyNotifier onReady={() => setReady(true)} />
            <GameLoop />
            <MapMeshes />
            <Player />
            <BotsView />
            <GrenadeView />
            <Effects />
            <WeaponViewModel />
          </PhysicsWorld>
        </Suspense>
      </Canvas>
    </>
  );
}
