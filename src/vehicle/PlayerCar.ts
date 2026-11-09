import { BASE_HALF_WIDTH, LANE_WIDTH, MEDIAN_SHOULDER_WIDTH, SHOULDER_WIDTH } from '../config';
import { clamp, damp } from '../core/math';
import type { Handling } from '../assets/vehicles';
import type { RoadLayout } from '../road/RoadLayout';

const G = 9.81;

export interface Controls {
  throttle: number;
  brake: number;
  /** -1 full left .. +1 full right. */
  steer: number;
}

/** Inner faces of the median barrier and the guardrail relative to the road edges. */
const MEDIAN_FACE = MEDIAN_SHOULDER_WIDTH + 0.05;
const RAIL_FACE = SHOULDER_WIDTH + 0.37;

/** Heading-return gain (1/s) once the wheel is released. */
const ASSIST = 6;
/** Max sideways speed (m/s) per m/s² of grip: caps heading so a switch never becomes a skid across three lanes. */
const LATERAL_SPEED_PER_GRIP = 0.5;

/**
 * Free-steering arcade chassis in road space (s along the road, x lateral,
 * heading psi > 0 = pointing right). Kinematic bicycle model with:
 *  - a steering rack that takes time to wind on and self-centres;
 *  - lock limited by tyre grip, so a tap at 200 km/h is a lane change, not a spin;
 *  - first-order yaw lag per car (sharp AWD sedans vs. lazy RWD tourer);
 *  - heading assist that straightens the car when the wheel is released;
 *  - barrier contact with speed loss and a bounce.
 */
export class PlayerCar {
  s = 0;
  x = 0;
  psi = 0;
  speed = 0;
  /** Road-wheel angle, rad (+ right). */
  steerAngle = 0;
  yawRate = 0;
  latAccel = 0;
  longAccel = 0;
  /** Visual-only tail slide angle for RWD power oversteer. */
  slip = 0;
  braking = false;
  /** Lateral impact speed of the last barrier hit (m/s), cleared by the consumer. */
  impact = 0;
  private steerFrac = 0;

  constructor(
    private readonly layout: RoadLayout,
    public handling: Handling,
    public wheelbase: number,
    public width: number,
    public length: number,
  ) {}

  setVehicle(handling: Handling, wheelbase: number, width: number, length: number): void {
    this.handling = handling;
    this.wheelbase = wheelbase;
    this.width = width;
    this.length = length;
  }

  update(dt: number, c: Controls): void {
    const h = this.handling;
    const v = this.speed;
    const f = clamp(v / h.topSpeed, 0, 1);

    // --- Longitudinal. Usable power is ~60% of peak once gearing and shifts are
    // averaged in, and below ~55 km/h low gears cap the force (no instant launch).
    const shares = { RWD: 0.62, FWD: 0.55, AWD: 1 } as const;
    const power = h.powerW * 0.6;
    const traction = 1.15 * h.massKg * G * shares[h.drivetrain];
    const drive = c.throttle * Math.min(power / Math.max(v, 15), traction);
    const dragK = power / h.topSpeed ** 3;
    let a = (drive - dragK * v * v) / h.massKg - 0.012 * G;
    if (c.throttle < 0.05) a -= 0.9; // engine braking
    a -= c.brake * 10.5;
    a -= Math.abs(this.latAccel) * 0.035; // tyre scrub
    this.speed = Math.max(0, v + a * dt);
    this.longAccel = (this.speed - v) / dt;
    this.braking = c.brake > 0.05;

    // --- Steering rack: wind-on slows with speed, return-to-centre is quicker.
    const rate = c.steer !== 0 ? h.rackSpeed[0] + (h.rackSpeed[1] - h.rackSpeed[0]) * f : h.rackSpeed[0] * 1.4;
    this.steerFrac += clamp(c.steer - this.steerFrac, -rate * dt, rate * dt);
    const lock = clamp(Math.atan((this.wheelbase * h.grip) / Math.max(v * v, 1)), 0.03, 0.6);
    this.steerAngle = this.steerFrac * lock;

    // --- Yaw
    let rTarget = (v * Math.tan(this.steerAngle)) / this.wheelbase;
    if (h.drivetrain === 'RWD') rTarget *= 1 + 0.14 * c.throttle * f;
    if (h.drivetrain === 'FWD') rTarget *= 1 - 0.08 * c.throttle;
    // Heading assist: with the wheel centred the car snaps back parallel to the road,
    // so a lane change is "hold, release" rather than a manual counter-steer.
    if (Math.abs(c.steer) < 0.05) rTarget -= this.psi * ASSIST;
    // While steering, yaw stops building once sideways speed reaches the car's limit.
    const psiMax = Math.min(0.5, Math.asin(Math.min(1, (h.grip * LATERAL_SPEED_PER_GRIP) / Math.max(v, 1))));
    rTarget = clamp(rTarget, (-psiMax - this.psi) * 8, (psiMax - this.psi) * 8);
    const rMax = (h.grip * 1.05) / Math.max(v, 1);
    rTarget = clamp(rTarget, -rMax, rMax);
    this.yawRate += (rTarget - this.yawRate) * damp(1 / h.yawLag, dt);
    this.psi = clamp(this.psi + this.yawRate * dt, -0.55, 0.55);
    this.latAccel = this.speed * this.yawRate;

    const slipTarget = h.drivetrain === 'RWD' ? -Math.sign(this.steerAngle) * 0.07 * c.throttle * Math.min(1, Math.abs(this.steerFrac) * 1.5) * f : 0;
    this.slip += (slipTarget - this.slip) * damp(3, dt);

    // --- Integrate
    this.s += this.speed * Math.cos(this.psi) * dt;
    this.x += this.speed * Math.sin(this.psi) * dt;
    this.collideBarriers();
  }

  private collideBarriers(): void {
    // Footprint half-width grows when the car is yawed.
    const half = (this.width / 2) * Math.cos(this.psi) + (this.length / 2) * Math.abs(Math.sin(this.psi)) * 0.9;
    const min = this.layout.leftEdge(this.s) - MEDIAN_FACE + half;
    const max = this.layout.rightEdge(this.s) + RAIL_FACE - half;
    const hit = this.x < min ? -1 : this.x > max ? 1 : 0;
    if (!hit) return;
    this.x = hit < 0 ? min : max;
    const lateral = this.speed * Math.sin(this.psi);
    // Only a hit if moving into the wall; a closing taper just pushes us along.
    if (Math.sign(lateral) === hit) {
      const impact = Math.abs(lateral);
      this.impact = Math.max(this.impact, impact);
      this.speed *= 1 - Math.min(0.45, 0.03 + impact * 0.035);
      this.psi = -this.psi * 0.3;
      this.yawRate = 0;
      this.steerFrac *= 0.3;
    } else {
      this.speed *= 0.999;
    }
  }

  /** 0..2 main lanes, -1/3 pockets, NaN on the shoulders. */
  get laneIndex(): number {
    const i = Math.floor((this.x + BASE_HALF_WIDTH) / LANE_WIDTH);
    const pocketRight = this.x > BASE_HALF_WIDTH && this.x <= this.layout.rightEdge(this.s);
    const pocketLeft = this.x < -BASE_HALF_WIDTH && this.x >= this.layout.leftEdge(this.s);
    if (i >= 0 && i <= 2) return i;
    if (i === 3 && pocketRight) return 3;
    if (i === -1 && pocketLeft) return -1;
    return NaN;
  }
}
