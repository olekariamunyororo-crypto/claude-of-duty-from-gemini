import { rand } from '../utils/MathUtils';

/** Camera recoil state: kicks up/sideways, then springs back. */
class RecoilImpl {
  pitch = 0;
  yaw = 0;
  private pv = 0;
  private yv = 0;

  add(v: number, h: number): void {
    this.pv += v * (0.85 + Math.random() * 0.3);
    this.yv += rand(-h, h);
  }

  tick(dt: number): void {
    this.pv += (-this.pitch * 90 - this.pv * 14) * dt;
    this.yv += (-this.yaw * 90 - this.yv * 14) * dt;
    this.pitch += this.pv * dt;
    this.yaw += this.yv * dt;
    if (Math.abs(this.pitch) < 1e-5 && Math.abs(this.pv) < 1e-4) { this.pitch = 0; this.pv = 0; }
    if (Math.abs(this.yaw) < 1e-5 && Math.abs(this.yv) < 1e-4) { this.yaw = 0; this.yv = 0; }
  }

  reset(): void { this.pitch = 0; this.yaw = 0; this.pv = 0; this.yv = 0; }
}

export const Recoil = new RecoilImpl();
