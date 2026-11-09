#!/usr/bin/env node
/**
 * Downloads external CC0 assets into public/assets so the game ships them inside
 * the build (Yandex Games disallows runtime loading from third-party domains).
 *
 *   node scripts/fetch-assets.mjs           fetch missing assets
 *   node scripts/fetch-assets.mjs --force   re-download everything
 *   node scripts/fetch-assets.mjs --soft    never fail the calling npm script
 */
import { mkdir, stat, writeFile, rename } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const force = process.argv.includes('--force');
const soft = process.argv.includes('--soft');

/** Poly Haven HDRIs are CC0. Step 2 appends the .glb vehicle list here. */
const ASSETS = [
  {
    id: 'hdri-golden',
    out: 'public/assets/hdri/golden_hour.hdr',
    urls: ['https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/2k/venice_sunset_2k.hdr'],
    minBytes: 1_000_000,
  },
  {
    id: 'hdri-night',
    out: 'public/assets/hdri/night_city.hdr',
    urls: ['https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/2k/shanghai_bund_2k.hdr'],
    minBytes: 1_000_000,
  },
];

async function exists(path, minBytes) {
  try {
    return (await stat(path)).size >= minBytes;
  } catch {
    return false;
  }
}

async function download(url, attempts = 3) {
  let lastError;
  for (let i = 1; i <= attempts; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(120_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    } catch (err) {
      lastError = err;
      if (i < attempts) await new Promise((r) => setTimeout(r, 1000 * i));
    }
  }
  throw lastError;
}

let failures = 0;
for (const asset of ASSETS) {
  const out = join(root, asset.out);
  if (!force && (await exists(out, asset.minBytes))) {
    console.log(`✓ ${asset.id} (cached)`);
    continue;
  }
  await mkdir(dirname(out), { recursive: true });
  let ok = false;
  for (const url of asset.urls) {
    try {
      const data = await download(url);
      if (data.length < asset.minBytes) throw new Error(`file too small (${data.length} B)`);
      await writeFile(`${out}.part`, data);
      await rename(`${out}.part`, out);
      console.log(`↓ ${asset.id} → ${relative(root, out)} (${(data.length / 1e6).toFixed(1)} MB)`);
      ok = true;
      break;
    } catch (err) {
      console.warn(`! ${asset.id}: ${url} failed: ${err.message}`);
    }
  }
  if (!ok) failures++;
}

if (failures) {
  console.warn(`${failures} asset(s) missing; the game falls back to procedural substitutes.`);
  if (!soft) process.exit(1);
}
