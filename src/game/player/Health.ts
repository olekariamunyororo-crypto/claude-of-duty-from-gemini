export { P } from './playerState';
import { P } from './playerState';
export function healthTick(dt: number): void {
  P.tick(dt);
}
