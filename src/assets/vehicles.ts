import { KMH } from '../config';

export type Drivetrain = 'RWD' | 'FWD' | 'AWD';

/** Handling parameters consumed by PlayerCar (and refined by Step 3 physics). */
export interface Handling {
  massKg: number;
  /** Peak power at the wheels, watts. */
  powerW: number;
  topSpeed: number;
  drivetrain: Drivetrain;
  /** Lateral grip limit, m/s². Caps steering lock at speed. */
  grip: number;
  /** Yaw response time constant, s (lower = sharper turn-in). */
  yawLag: number;
  /** Steering wind-on speed at standstill / at top speed, in fractions of full lock per second. */
  rackSpeed: [number, number];
  /** Body roll (rad) per m/s² of lateral acceleration, and pitch per m/s² longitudinal. */
  rollGain: number;
  pitchGain: number;
  /** Suspension natural frequency (Hz) and damping ratio of the body motion. */
  suspensionHz: number;
  damping: number;
}

export interface VehicleSpec {
  id: string;
  name: string;
  /** Short line under the name in the garage/HUD. */
  tagline: string;
  /** Model URLs tried in order, relative to BASE_URL; drop-in custom models go first. */
  sources: string[];
  /** Target real-world size, meters. The loader rescales any model to it. */
  length: number;
  width: number;
  height: number;
  wheelDiameter: number;
  paint: number;
  /** Metallic flake amount 0..1 (0 = solid/gloss paint). */
  metallic: number;
  rim: number;
  /** Window tint: 0 clear .. 1 limo. */
  tint: number;
  /** Ride height offset from the model's stock stance, meters (negative = lowered). */
  stance: number;
  handling: Handling;
}

const custom = (id: string) => `assets/vehicles/custom/${id}.glb`;
const kenney = (name: string) => `assets/vehicles/kenney/${name}.glb`;
const sketchfab = (id: string) => `assets/vehicles/sketchfab/${id}.glb`;

/**
 * Player garage. Sources are tried in order: a drop-in `custom/<id>.glb`, the
 * CC BY Sketchfab model of the prototype (scripts/sketchfab-models.mjs), then
 * a CC0 Kenney shell rescaled to the prototype's real dimensions.
 */
export const PLAYER_CARS: VehicleSpec[] = [
  {
    id: 'samurai',
    name: 'Samurai II',
    tagline: 'Chaser Tourer · RWD · 2.5 турбо R6',
    sources: [custom('samurai'), sketchfab('samurai'), kenney('sedan-sports')],
    length: 4.76,
    width: 1.76,
    height: 1.38,
    wheelDiameter: 0.66,
    paint: 0xe8e6df,
    metallic: 0.35,
    rim: 0x2b2d31,
    tint: 0.85,
    stance: -0.05,
    handling: {
      massKg: 1490,
      powerW: 330_000,
      topSpeed: 268 * KMH,
      drivetrain: 'RWD',
      grip: 10.5,
      yawLag: 0.15,
      rackSpeed: [4.2, 2.2],
      rollGain: 0.0058,
      pitchGain: 0.0042,
      suspensionHz: 1.35,
      damping: 0.42,
    },
  },
  {
    id: 'vesta',
    name: 'Vesta RS',
    tagline: 'FWD · лёгкая и острая',
    sources: [custom('vesta'), sketchfab('vesta'), kenney('sedan')],
    length: 4.41,
    width: 1.76,
    height: 1.47,
    wheelDiameter: 0.63,
    paint: 0xd2491a,
    metallic: 0.5,
    rim: 0x1b1c1f,
    tint: 0.5,
    stance: -0.03,
    handling: {
      massKg: 1230,
      powerW: 150_000,
      topSpeed: 228 * KMH,
      drivetrain: 'FWD',
      grip: 11,
      yawLag: 0.07,
      rackSpeed: [6, 3.2],
      rollGain: 0.005,
      pitchGain: 0.0045,
      suspensionHz: 1.6,
      damping: 0.5,
    },
  },
  {
    id: 'priora',
    name: 'Priora Drive',
    tagline: 'FWD · ультра-узкая, лезет в любую щель',
    sources: [custom('priora'), sketchfab('priora'), kenney('sedan')],
    length: 4.35,
    width: 1.68,
    height: 1.42,
    wheelDiameter: 0.6,
    paint: 0x0c0d10,
    metallic: 0.2,
    rim: 0x9a9da3,
    tint: 1,
    stance: -0.07,
    handling: {
      massKg: 1090,
      powerW: 115_000,
      topSpeed: 212 * KMH,
      drivetrain: 'FWD',
      grip: 10.2,
      yawLag: 0.08,
      rackSpeed: [6, 3.4],
      rollGain: 0.0068,
      pitchGain: 0.005,
      suspensionHz: 1.45,
      damping: 0.4,
    },
  },
  {
    id: 'bavaria',
    name: 'Bavaria M-Sedan',
    tagline: 'AWD · 625 л.с., моментальная переставка',
    sources: [custom('bavaria'), sketchfab('bavaria'), kenney('sedan-sports')],
    length: 4.97,
    width: 1.9,
    height: 1.47,
    wheelDiameter: 0.7,
    paint: 0x1d3f73,
    metallic: 0.8,
    rim: 0x2a2b2e,
    tint: 0.7,
    stance: -0.04,
    handling: {
      massKg: 1855,
      powerW: 440_000,
      topSpeed: 305 * KMH,
      drivetrain: 'AWD',
      grip: 12.5,
      yawLag: 0.06,
      rackSpeed: [6, 3.5],
      rollGain: 0.0028,
      pitchGain: 0.0028,
      suspensionHz: 1.9,
      damping: 0.62,
    },
  },
  {
    id: 'stuttgart',
    name: 'Stuttgart E-AMG',
    tagline: 'AWD · «утюг», максималка 300+',
    sources: [custom('stuttgart'), sketchfab('stuttgart'), kenney('sedan')],
    length: 4.99,
    width: 1.91,
    height: 1.46,
    wheelDiameter: 0.7,
    paint: 0x5d6064,
    metallic: 0.9,
    rim: 0x111214,
    tint: 0.8,
    stance: -0.05,
    handling: {
      massKg: 1880,
      powerW: 450_000,
      topSpeed: 315 * KMH,
      drivetrain: 'AWD',
      grip: 11.8,
      yawLag: 0.11,
      rackSpeed: [4.5, 2.4],
      rollGain: 0.0026,
      pitchGain: 0.0026,
      suspensionHz: 1.75,
      damping: 0.7,
    },
  },
];

/** Traffic body types for the Step 4 pool (paint `-1` keeps the model's own livery). */
/** Traffic body types for the Step 4 pool (paint `-1` keeps the model's own livery). */
export interface TrafficSpec {
  id: string;
  sources: string[];
  length: number;
  width: number;
  height: number;
  wheelDiameter: number;
  paints: number[];
  weight: number;
}

const CIVIL_PAINTS = [0xdedede, 0x1a1a1c, 0x8c9096, 0x5b1a1a, 0x23324a, 0xc9c3b4, 0x2f3d33, 0x7a7d80];

export const TRAFFIC_CARS: TrafficSpec[] = [
  { id: 'camry', sources: [sketchfab('traffic-camry'), kenney('sedan')], length: 4.81, width: 1.82, height: 1.48, wheelDiameter: 0.66, paints: CIVIL_PAINTS, weight: 4 },
  { id: 'logan', sources: [sketchfab('traffic-logan'), kenney('sedan')], length: 4.29, width: 1.74, height: 1.53, wheelDiameter: 0.62, paints: CIVIL_PAINTS, weight: 3 },
  { id: 'zhiguli', sources: [sketchfab('traffic-zhiguli'), kenney('sedan')], length: 4.13, width: 1.62, height: 1.44, wheelDiameter: 0.6, paints: [0xe8e4d8, 0x7a1f1f, 0x2b4a2e, 0x1e2f4f, 0xb8b2a0], weight: 2 },
  { id: 'octavia', sources: [sketchfab('traffic-octavia'), kenney('hatchback-sports')], length: 4.69, width: 1.83, height: 1.46, wheelDiameter: 0.66, paints: CIVIL_PAINTS, weight: 2 },
  { id: 'cruiser', sources: [sketchfab('traffic-cruiser'), kenney('suv-luxury')], length: 4.89, width: 1.94, height: 1.85, wheelDiameter: 0.8, paints: [0x111111, 0xe5e5e5, 0x3a3d42], weight: 2 },
  { id: 'taxi', sources: [sketchfab('traffic-taxi'), kenney('taxi')], length: 4.6, width: 1.8, height: 1.5, wheelDiameter: 0.64, paints: [-1], weight: 2 },
  { id: 'van', sources: [kenney('van')], length: 5.3, width: 2.0, height: 2.25, wheelDiameter: 0.7, paints: [0xf2f2f2, 0xd8d8d8], weight: 2 },
  { id: 'kamaz', sources: [sketchfab('traffic-kamaz'), kenney('truck')], length: 7.4, width: 2.5, height: 2.9, wheelDiameter: 1.1, paints: [-1], weight: 1 },
];

export const findPlayerCar = (id: string | null): VehicleSpec => PLAYER_CARS.find((c) => c.id === id) ?? PLAYER_CARS[0];
