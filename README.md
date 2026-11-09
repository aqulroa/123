# Городской поток: Шашки

Browser 3D traffic-weaving game (No Hesi style) on **TypeScript + Three.js (r187) + Vite**, targeting Yandex Games.

## Run

```bash
npm install
npm run dev        # fetches CC0 assets on first run, then starts Vite
npm run build      # type-check + production build into dist/ (relative paths for Yandex Games)
```

`npm run fetch-assets` downloads every asset into `public/assets/`, so it ships inside the build (Yandex Games doesn't
allow loading from third-party domains at runtime):

- HDRIs (Poly Haven, CC0) and the Kenney Car Kit (CC0): always.
- Sketchfab models of the real prototypes and traffic cars (CC BY), in one of two ways:

  ```bash
  # a file downloaded by hand from the model's page (Download 3D Model → glTF or "Autoconverted format (glb)")
  npm run import-model -- samurai ~/Downloads/toyota_chaser_tourer_v_jzx100.zip

  # or all of them at once with an API token
  SKETCHFAB_TOKEN=<token from sketchfab.com/settings/password> npm run fetch-assets
  ```

  Either way:
  - every license is re-checked through the Sketchfab API, and anything other than CC BY / CC0 is refused;
  - meshes are simplified and textures recompressed to WebP + Meshopt (`scripts/optimize-glb.mjs`);
  - attribution is written to `public/assets/vehicles/sketchfab/credits.json` and the table in [CREDITS.md](CREDITS.md).

  The optimized `.glb` files are meant to be committed, so builds don't need the originals or the token.

If a download fails, the game falls back to the next source: Sketchfab → Kenney → procedural.

### Controls

| Key | Action |
| --- | --- |
| W / ↑, S / ↓ | throttle / brake |
| A / ←, D / → | steer freely (hold to change lanes, tap to nudge; the car straightens itself when released) |
| 1–9, 0 | switch car (ten cars, worst → best) |
| C | chase ↔ bumper camera |
| N | golden hour ↔ wet night |
| H | toggle HUD |

URL params: `?car=e34`, `?platform=local` (skip the SDK), `?preset=night`, `?intro=0` (skip the crane shot), `?s=600` (start 600 m down the road),
`?cam=bumper`.

## Garage

Ten cars, from worst to best. The models are committed in `public/assets/vehicles/garage` (≈15 MB after optimization);
sources and authors are in [CREDITS.md](CREDITS.md). This build is for private, local use.

| Key | In game | Car | Drive | Power | Triangles |
| --- | --- | --- | --- | --- | --- |
| 1 | Жига | VAZ «classic» (AI-generated model) | RWD | 64 hp | 5k |
| 2 | Гибрид | Toyota Prius | FWD | 122 hp | 19k |
| 3 | Камри 3.5 | Toyota Camry XV70 | FWD | 249 hp | 80k |
| 4 | Пятёрка E34 | BMW E34, stance | RWD | 192 hp | 113k |
| 5 | Samurai II | Toyota Chaser Tourer V JZX100 | RWD | 350 hp | 121k |
| 6 | Stuttgart 300SL | Mercedes-Benz 300SL «Gullwing», restomod | RWD | 340 hp | 90k |
| 7 | Эво X | Mitsubishi Lancer Evo X | AWD | 295 hp | 30k |
| 8 | Скайлайн R34 | Nissan Skyline GT-R R34 | AWD | 390 hp | 87k |
| 9 | Супра MK4 | Toyota Supra A80, 2JZ build | RWD | 500 hp | 77k |
| 0 | Bavaria M4 | BMW M4 G82 | AWD | 510 hp | 97k |

Grip, steering sharpness and suspension stiffness rise along the list (`handling()` in `src/assets/vehicles.ts`).
The HUD shows the model credit under the car name. A `public/assets/vehicles/custom/<id>.glb` overrides any car
(see the [README there](public/assets/vehicles/custom/README.md)).

Traffic models (for Step 4) are low-poly, 1–6k triangles with 512 px textures, in `public/assets/vehicles/traffic`.

## Yandex Games SDK

`src/platform/YandexPlatform.ts` loads `/sdk.js` and runs `YaGames.init()`. If the script isn't there (plain
`npm run dev`), a local stand-in with the same interface takes over and saves to `localStorage`. The HUD shows which one
is active.

| SDK call | When |
| --- | --- |
| `features.LoadingAPI.ready()` | the loading screen closes |
| `features.GameplayAPI.start()` / `stop()` | driving starts; stops for ads and hidden tabs (the simulation pauses too) |
| `getPlayer().getData()` / `setData()` | the selected car and the best distance |
| `adv.showFullscreenAdv()` | after switching cars, at most once a minute |
| `leaderboards.setScore('distance', m)` | best distance, every 30 s and on page hide (authorized players only) |

To test against the real SDK locally:

```bash
npm run build
npx @yandex-games/sdk-dev-proxy -p dist --dev-mode=true   # https://localhost:8080
```

## Status

**Step 1 — scene, lighting, road (done)**

- HDRI image-based lighting; the sun is detected from the brightest HDRI texel, rotated ahead-left of the driver and
  drives a 4K soft PCF shadow map that follows the camera with texel snapping. (`PCFSoftShadowMap` was removed
  in r18x, so this uses `PCFShadowMap` + `shadow.radius`.)
- Procedural PBR asphalt: aggregate albedo/normal/roughness tiles generated at startup, plus world-anchored shader
  detail: rubbered wheel paths, repair patches, skid marks, cracks, tar seals, oil drips, dusty shoulders.
  The night preset adds puddles through a clear-coat water film.
- Endless 3-lane road (3.75 m lanes) with procedural 4th-lane overtake pockets: 60–80 m tapers, 300–600 m
  pockets, «Конец полосы» signs with a 150 m plate, and merge arrows in the last 150 m.
- W-beam guardrail, New-Jersey median barrier, street lights (a pooled set of real spot lights at night),
  instanced skyline, ACES tone mapping, bloom, and speed-driven radial blur, chromatic aberration and FOV warp.
- Floating origin keeps GPU coordinates small on long runs.

**Step 2 — vehicle loading (done)**

- `VehicleLoader` (GLTF + Draco + Meshopt, tested on Kenney, the three.js Ferrari 458 and Khronos CarConcept) handles arbitrary car models:
  - finds the forward axis from the lights;
  - finds wheels by name and clusters them spatially into four rigged units (steer + spin);
  - classifies surfaces into paint / glass / head / tail / trim / plate / tyre / rim, by node and material names or,
    for palette-atlas models, per triangle (the atlas is segmented into swatches);
  - applies PBR materials: clear-coat metallic paint, tinted glass, emissive lamps;
  - rescales to real dimensions with the pivot on the ground between the axles. Analysis is cached per file, so
    instances share geometry (ready for the traffic pool).
- Free steering (pulled forward from Step 3): a speed-sensitive steering rack with lag, lock limited by grip,
  per-car yaw response, a heading cap so sideways speed stays near ~5–6 m/s, self-straightening on release, and barrier
  collisions with speed loss. Body roll and pitch run on damped springs, the wheels spin and steer, and the brake
  lights work. The chase camera lags behind lateral moves.

**Yandex Games SDK adapter (done, ahead of Step 6)** — see above.

Next steps: 3 — deeper chassis physics (weight transfer, drift) · 4 — traffic · 5 — near miss / combo ·
6 — touch controls.

## Layout

```
src/
├── assets/     vehicle manifest, VehicleLoader, car materials
├── core/       game loop (fixed step), event bus, input, math
├── graphics/   environment/IBL, materials, procedural textures, road shader, post FX, camera, scenery
├── road/       RoadLayout (pocket zones, lane queries), chunk builder, streamer
├── vehicle/    PlayerCar (handling), CarView (model, suspension, wheels, lights)
├── platform/   Yandex Games SDK adapter + local stand-in
└── ui/         loading screen + HUD
```
