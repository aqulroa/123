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
- Sketchfab models of the real prototypes and traffic cars (CC BY): only with a token.

  ```bash
  SKETCHFAB_TOKEN=<token from sketchfab.com/settings/password> npm run fetch-assets
  ```

  The script:
  - re-checks every license through the Sketchfab API and refuses anything other than CC BY / CC0;
  - simplifies the meshes and recompresses textures to WebP + Meshopt (`scripts/optimize-glb.mjs`);
  - writes `public/assets/vehicles/sketchfab/credits.json` and the table in [CREDITS.md](CREDITS.md).

  The optimized `.glb` files are meant to be committed, so builds don't need the token.

If a download fails, the game falls back to the next source: Sketchfab → Kenney → procedural.

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

| # | In game | Prototype | Drive | Sketchfab model (CC BY) | Fallback |
| --- | --- | --- | --- | --- | --- |
| 1 | Samurai II | Toyota Mark II JZX100 | RWD | [Toyota Chaser Tourer V (JZX100)](https://sketchfab.com/3d-models/d52227ff4f034942a86dfcefe44deeac) — Car2022 | Kenney `sedan-sports` |
| 2 | Vesta RS | Lada Vesta Sport | FWD | [Lada Vesta](https://sketchfab.com/3d-models/3c333139feb744ae9d36767c0e9cabfd) — tiunov.se | Kenney `sedan` |
| 3 | Priora Drive | Lada Priora | FWD | [Priora](https://sketchfab.com/3d-models/1551b8223bdf4d78ab3e8e568530836d) — faffdf | Kenney `sedan` |
| 4 | Bavaria M-Sedan | BMW M5 F90 | AWD | [Bmw M5 F90](https://sketchfab.com/3d-models/5478e978bd634337adc8e3dc413fbfa3) — Res1n | Kenney `sedan-sports` |
| 5 | Stuttgart E-AMG | Mercedes-AMG E63 S | AWD | [Mercedes-AMG E 63 S (W213)](https://sketchfab.com/3d-models/f61d8efb0b9b4c499fc66fcf35a4d09c) — Car2022 | Kenney `sedan` |

Traffic (for Step 4): Toyota Camry 40, Renault Logan, LADA 2107, Škoda Octavia, Land Cruiser 100, a taxi and a Kamaz,
all CC BY. The full list is in `scripts/sketchfab-models.mjs`.

Cars use fictional names in the game, and separate badge/logo meshes are hidden. CC BY requires crediting the author, so
the HUD shows the model credit under the car name. A model in `public/assets/vehicles/custom/<id>.glb` overrides
everything (see the [README there](public/assets/vehicles/custom/README.md)).

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
