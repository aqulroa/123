# Городской поток: Шашки

Browser 3D traffic-weaving game (No Hesi style) on **TypeScript + Three.js (r187) + Vite**, targeting Yandex Games.

## Run

```bash
npm install
npm run dev        # fetches CC0 assets on first run, then starts Vite
npm run build      # type-check + production build into dist/ (relative paths for Yandex Games)
```

`npm run fetch-assets` downloads the HDRIs (Poly Haven) and vehicle models (Kenney Car Kit), all CC0, into
`public/assets/` so they ship inside the build. Yandex Games doesn't allow loading from third-party domains at runtime.
If a download fails, the game falls back to a procedural sky and procedural car bodies. Sources are listed in [CREDITS.md](CREDITS.md).

### Controls

| Key | Action |
| --- | --- |
| W / ↑, S / ↓ | throttle / brake |
| A / ←, D / → | steer freely (hold to change lanes, tap to nudge; the car straightens itself when released) |
| 1–5 | switch car |
| C | chase ↔ bumper camera |
| N | golden hour ↔ wet night |
| H | toggle HUD |

URL params: `?car=bavaria`, `?preset=night`, `?intro=0` (skip the crane shot), `?s=600` (start 600 m down the road),
`?cam=bumper`.

## Garage

| # | Car | Prototype | Drive | Stock shell |
| --- | --- | --- | --- | --- |
| 1 | Samurai II | Toyota Mark II JZX100 | RWD | Kenney `sedan-sports` |
| 2 | Vesta RS | Lada Vesta Sport | FWD | Kenney `sedan` |
| 3 | Priora Drive | Lada Priora | FWD | Kenney `sedan` |
| 4 | Bavaria M-Sedan | BMW M5 F90 | AWD | Kenney `sedan-sports` |
| 5 | Stuttgart E-AMG | Mercedes-AMG E63 S | AWD | Kenney `sedan` |

Freely licensed models of the actual prototypes don't exist. Each car therefore rescales a CC0 shell to the prototype's
real length, width, height and wheel size, with its own paint, tint, rims and handling. To swap in a licensed model,
drop it into `public/assets/vehicles/custom/<id>.glb` (see the [README there](public/assets/vehicles/custom/README.md)).

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

- `VehicleLoader` (GLTF + Draco + Meshopt) handles arbitrary car models:
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

Next steps: 3 — deeper chassis physics (weight transfer, drift) · 4 — traffic · 5 — near miss / combo ·
6 — touch + Yandex SDK.

## Layout

```
src/
├── assets/     vehicle manifest, VehicleLoader, car materials
├── core/       game loop (fixed step), event bus, input, math
├── graphics/   environment/IBL, materials, procedural textures, road shader, post FX, camera, scenery
├── road/       RoadLayout (pocket zones, lane queries), chunk builder, streamer
├── vehicle/    PlayerCar (handling), CarView (model, suspension, wheels, lights)
└── ui/         loading screen + HUD
```
