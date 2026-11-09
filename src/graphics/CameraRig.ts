import * as THREE from 'three';
import { damp } from '../core/math';
import type { PreviewDriver } from '../vehicle/PreviewDriver';

/**
 * Low "bumper" camera with inertia: lags lateral moves, rolls into lane
 * changes, pitches with acceleration, widens FOV with speed, and opens with a
 * cinematic crane-down shot.
 */
export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  private introT = 0;
  private readonly introDuration = 4.2;
  private fov = 56;
  private roll = 0;
  private pitch = 0;
  private lagX = 0;
  private time = 0;
  private readonly look = new THREE.Vector3();
  private readonly crane = new THREE.Vector3();

  constructor(aspect: number, skipIntro = false) {
    this.camera = new THREE.PerspectiveCamera(56, aspect, 0.3, 4000);
    if (skipIntro) this.introT = 1;
  }

  get introDone(): boolean {
    return this.introT >= 1;
  }

  update(dt: number, d: PreviewDriver, origin: number): void {
    this.time += dt;
    this.introT = Math.min(1, this.introT + dt / this.introDuration);
    const speed01 = d.speed / d.maxSpeed;

    this.lagX += (d.x - this.lagX) * damp(9, dt);
    const z = -(d.s - origin);
    const shake = speed01 * speed01 * 0.012;
    const drive = new THREE.Vector3(
      this.lagX + Math.sin(this.time * 31) * shake,
      1.32 + Math.sin(this.time * 23.7) * shake * 0.6,
      z + 1.5,
    );

    // Intro: crane shot from high above-right, easing into the driving position.
    const e = 1 - Math.pow(1 - this.introT, 3);
    this.crane.set(d.x + 14, 26, z + 55);
    const pos = this.crane.lerp(drive, e);
    this.camera.position.copy(pos);

    this.look.set(this.lagX + d.lateralVel * 0.35, 0.95, z - 40);
    this.look.y = THREE.MathUtils.lerp(0, this.look.y, e);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(this.look);

    this.roll += (-d.lateralAccel * 0.006 - this.roll) * damp(6, dt);
    this.pitch += (-d.longAccel * 0.0035 - this.pitch) * damp(5, dt);
    this.camera.rotateZ(this.roll * e);
    this.camera.rotateX(this.pitch * e);

    const targetFov = THREE.MathUtils.lerp(44, 56 + 24 * Math.pow(speed01, 1.6), e);
    this.fov += (targetFov - this.fov) * damp(3, dt);
    this.camera.fov = this.fov;
    this.camera.updateProjectionMatrix();
  }

  setAspect(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }
}
