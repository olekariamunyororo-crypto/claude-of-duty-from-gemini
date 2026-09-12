import type { ReactNode } from 'react';
import { Physics } from '@react-three/rapier';
import { useGameStore } from '../store/gameStore';

export function PhysicsWorld({ children }: { children: ReactNode }): JSX.Element {
  const paused = useGameStore((s) => s.phase) !== 'playing';
  return (
    <Physics gravity={[0, -22, 0]} timeStep={1 / 60} paused={paused}>
      {children}
    </Physics>
  );
}
