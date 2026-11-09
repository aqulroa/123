import { KMH } from '../config';
import type { Input } from '../core/Input';
import { clamp } from '../core/math';
import type { LaneId, RoadLayout } from '../road/RoadLayout';

/**
 * Step-1 stand-in for the player vehicle: a kinematic point that cruises and
 * hops lanes with a critically damped spring, so the camera, road streaming
 * and pockets can be exercised before the real chassis physics (Step 3).
 */
export class PreviewDriver {
  s = 0;
  x = 0;
  speed = 130 * KMH;
  lane: LaneId = 1;
  lateralVel = 0;
  lateralAccel = 0;
  longAccel = 0;
  readonly maxSpeed = 260 * KMH;
  readonly minSpeed = 40 * KMH;

  constructor(private readonly layout: RoadLayout) {
    this.x = layout.laneCenter(this.lane, 0);
  }

  update(dt: number, input: Input): void {
    const prevSpeed = this.speed;
    if (input.isDown('throttle')) this.speed += 7.5 * dt * (1 - this.speed / (this.maxSpeed * 1.05));
    if (input.isDown('brake')) this.speed -= 11 * dt;
    this.speed = clamp(this.speed, this.minSpeed, this.maxSpeed);
    this.longAccel = (this.speed - prevSpeed) / dt;

    const look = this.s + 25;
    const lanes = this.layout.availableLanes(look);
    let idx = lanes.indexOf(this.lane);
    if (idx < 0) {
      // Current pocket is closing: merge to the nearest main lane.
      this.lane = this.lane === 3 ? 2 : this.lane === -1 ? 0 : this.lane;
      idx = lanes.indexOf(this.lane);
    }
    if (input.consume('left') && idx > 0) this.lane = lanes[idx - 1];
    if (input.consume('right') && idx < lanes.length - 1) this.lane = lanes[idx + 1];

    // Spring stiffness softens with speed, like a real steering rack.
    const omega = 4.2 - 1.6 * (this.speed / this.maxSpeed);
    const target = this.layout.laneCenter(this.lane, this.s);
    this.lateralAccel = omega * omega * (target - this.x) - 2 * omega * this.lateralVel;
    this.lateralVel += this.lateralAccel * dt;
    this.x += this.lateralVel * dt;
    this.s += this.speed * dt;
  }

  get speedKmh(): number {
    return this.speed / KMH;
  }
}
