import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { COLL } from '../scene/Map';

/** Static world colliders (single fixed body, one cuboid per map box). */
export function MapColliders(): JSX.Element {
  return (
    <RigidBody type="fixed" colliders={false}>
      {COLL.map((b, i) => (
        <CuboidCollider key={i} args={[b.hx, b.hy, b.hz]} position={[b.x, b.y, b.z]} />
      ))}
    </RigidBody>
  );
}
