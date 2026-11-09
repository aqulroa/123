import * as THREE from 'three';
import { CHUNK_LENGTH } from './config';
import { events, type LightingPreset } from './core/EventBus';
import { GameLoop } from './core/GameLoop';
import { Input } from './core/Input';
import { CameraRig } from './graphics/CameraRig';
import { Environment } from './graphics/Environment';
import { Materials } from './graphics/Materials';
import { PostFX } from './graphics/PostFX';
import { Scenery } from './graphics/Scenery';
import { StreetLightPool } from './graphics/StreetLightPool';
import { RoadStreamer } from './road/RoadStreamer';
import { Hud } from './ui/Hud';
import { PreviewDriver } from './vehicle/PreviewDriver';

/**
 * Floating origin step. Everything road-related lives under `world`, whose
 * z offset absorbs the travelled distance so GPU-side coordinates stay small.
 * Must be a multiple of the grass tile (12 m) to keep the terrain texture stable.
 */
const ORIGIN_STEP = 1200;

const LANE_LABELS: Record<number, string> = { [-1]: 'Карман слева', 0: 'Ряд 1', 1: 'Ряд 2', 2: 'Ряд 3', 3: 'Карман справа' };

async function boot(): Promise<void> {
  const app = document.getElementById('app')!;
  // ?preset=night, ?intro=0 (skip crane shot), ?s=<meters> (start offset)
  const params = new URLSearchParams(location.search);
  const hud = new Hud(document.body);
  events.on('loading:progress', ({ label, progress }) => hud.progress(label, progress));
  const step = (label: string, progress: number) => {
    events.emit('loading:progress', { label, progress });
    // Yield so the loading bar repaints between heavy synchronous steps.
    return new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
  };

  const mobile = matchMedia('(pointer: coarse)').matches || Math.min(screen.width, screen.height) < 600;
  const renderer = new THREE.WebGLRenderer({
    antialias: false,
    powerPreference: 'high-performance',
    stencil: false,
    // No logarithmic depth: gl_FragDepth disables early-Z (costly on mobile) and broke
    // the road's depth under heavy light counts. Coplanar layers use polygonOffset instead.
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.5 : 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  app.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const world = new THREE.Group();
  world.name = 'world';
  scene.add(world);
  let origin = 0;

  await step('Генерация асфальта и материалов…', 0.1);
  const mats = new Materials(renderer.capabilities.getMaxAnisotropy(), mobile);

  await step('Загрузка HDRI-окружения…', 0.35);
  const env = new Environment(renderer, scene, mobile);
  const envReady = env.preloadAll();

  await step('Процедурная трасса…', 0.55);
  const road = new RoadStreamer(world, mats);
  road.prime(0);
  const scenery = new Scenery(scene, world, mats, mobile);
  // 4 real lights: more makes the clear-coat road shader too heavy (it stopped rasterising under SwiftShader at 8).
  const lights = new StreetLightPool(scene, road, 4);

  const rig = new CameraRig(innerWidth / innerHeight, params.get('intro') === '0');
  const post = new PostFX(renderer, scene, rig.camera, mobile);
  post.setSize(innerWidth, innerHeight);

  const input = new Input();
  const driver = new PreviewDriver(road.layout);

  await envReady;
  await step('Свет и тени…', 0.85);
  const applyPreset = async (preset: LightingPreset) => {
    await env.apply(preset);
    mats.applyPreset(preset);
    post.applyPreset(preset);
    lights.setEnabled(preset === 'night');
    events.emit('preset:changed', preset);
  };
  await applyPreset(params.get('preset') === 'night' ? 'night' : 'golden');
  input.onKey('KeyN', () => void applyPreset(env.preset === 'golden' ? 'night' : 'golden'));
  input.onKey('KeyH', () => hud.toggle());

  // Optional start offset (?s=meters) is handy for jumping straight to a pocket.
  const startS = Number(params.get('s') ?? 0);
  if (startS > 0) {
    driver.s = startS;
    origin = Math.floor(startS / ORIGIN_STEP) * ORIGIN_STEP;
    world.position.z = origin;
    road.prime(startS);
  }

  // Compile every program up front so the first frames don't hitch.
  rig.update(0.016, driver, origin);
  await renderer.compileAsync(scene, rig.camera);
  await step('Готово', 1);
  hud.hideLoader();

  const onResize = () => {
    renderer.setSize(innerWidth, innerHeight);
    rig.setAspect(innerWidth / innerHeight);
    post.setSize(innerWidth, innerHeight);
  };
  addEventListener('resize', onResize);

  const focus = new THREE.Vector3();
  let time = 0;
  let hudTimer = 0;

  const loop = new GameLoop({
    fixedUpdate: (dt) => driver.update(dt, input),
    update: (dt) => {
      time += dt;
      if (driver.s - origin > ORIGIN_STEP) {
        origin += ORIGIN_STEP;
        world.position.z = origin;
      }
      road.update(driver.s);
      rig.update(dt, driver, origin);
      focus.copy(rig.camera.position).add(new THREE.Vector3(0, 0, -CHUNK_LENGTH * 0.25));
      env.follow(focus);
      lights.update(driver.s, origin);
      scenery.update(rig.camera.position, driver.s);
      post.update(rig.introDone ? driver.speed / driver.maxSpeed : 0, time);

      hudTimer -= dt;
      if (hudTimer <= 0) {
        hudTimer = 0.1;
        const zone = road.layout.zoneAt(driver.s + 200) ?? road.layout.zoneAt(driver.s);
        let pocketInfo = '';
        if (zone) {
          const side = zone.side === 1 ? 'справа' : 'слева';
          if (driver.s < zone.start) pocketInfo = `карман ${side} через ${Math.round(zone.start - driver.s)} м`;
          else if (driver.s < zone.fullEnd) pocketInfo = `карман ${side}, сужение через ${Math.round(zone.fullEnd - driver.s)} м`;
          else pocketInfo = 'сужение';
        }
        hud.update({
          speedKmh: driver.speedKmh,
          fps: loop.fps,
          preset: env.preset,
          laneLabel: LANE_LABELS[driver.lane],
          pocketInfo,
        });
      }
    },
    render: () => post.render(1 / 60),
  });
  loop.start();

  // Debug handle for console tinkering and automated screenshots.
  Object.assign(window, { __game: { renderer, scene, driver, road, env, rig, applyPreset } });
}

boot().catch((err) => {
  console.error(err);
  document.body.insertAdjacentHTML(
    'beforeend',
    `<div class="fatal">Не удалось запустить WebGL: ${String(err?.message ?? err)}</div>`,
  );
});
