# Городской поток: Шашки

Browser 3D traffic-weaving game (No Hesi style) on **TypeScript + Three.js (r187) + Vite**, targeting Yandex Games.

## Run

```bash
npm install
npm run dev        # fetches CC0 assets on first run, then starts Vite
npm run build      # type-check + production build into dist/ (relative paths for Yandex Games)
```

`npm run fetch-assets` downloads the HDRIs (Poly Haven, CC0) into `public/assets/` so they ship inside the
build. Yandex Games doesn't allow loading from third-party domains at runtime. If a download fails, the game falls back to
a procedural sky.

### Controls (preview drive)

| Key | Action |
| --- | --- |
| W / ↑, S / ↓ | throttle / brake |
| A / ←, D / → | lane change (including into an open overtake pocket) |
| N | golden hour ↔ wet night |
| H | toggle HUD |

URL params: `?preset=night`, `?intro=0` (skip the crane shot), `?s=600` (start 600 m down the road).

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

Next steps: 2 — `.glb` vehicle loader · 3 — chassis physics · 4 — traffic · 5 — near miss / combo · 6 — touch + Yandex SDK.

## Layout

```
src/
├── core/       game loop (fixed step), event bus, input, math
├── graphics/   environment/IBL, materials, procedural textures, road shader, post FX, camera, scenery
├── road/       RoadLayout (pocket zones, lane queries), chunk builder, streamer
├── vehicle/    PreviewDriver (kinematic stand-in until Step 3)
└── ui/         loading screen + HUD
```
