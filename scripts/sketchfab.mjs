/**
 * Sketchfab vehicle download: license check → authenticated download →
 * optimize → credits. Downloads need SKETCHFAB_TOKEN (sketchfab.com/settings/password,
 * "API Token"); without it the game keeps using the stock Kenney bodies.
 */
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { unzipSync } from 'fflate';
import { optimizeGlb } from './optimize-glb.mjs';
import { ALLOWED_LICENSES, SKETCHFAB_MODELS } from './sketchfab-models.mjs';

const API = 'https://api.sketchfab.com/v3';

async function getJson(url, token) {
  const res = await fetch(url, {
    headers: token ? { Authorization: `Token ${token}` } : {},
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url.replace(/\?.*/, '')}`);
  return res.json();
}

async function getBuffer(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(600_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} downloading archive`);
  return new Uint8Array(await res.arrayBuffer());
}

async function findGltf(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true, recursive: true })) {
    if (entry.isFile() && /\.(gltf|glb)$/i.test(entry.name)) return join(entry.parentPath ?? entry.path, entry.name);
  }
  throw new Error('archive has no .gltf/.glb');
}

/** Downloads the best available archive and returns a path the optimizer can read. */
async function downloadModel(uid, token, work) {
  const links = await getJson(`${API}/models/${uid}/download`, token);
  if (links.glb?.url) {
    const file = join(work, 'model.glb');
    await writeFile(file, await getBuffer(links.glb.url));
    return file;
  }
  if (!links.gltf?.url) throw new Error('no glTF archive offered');
  const files = unzipSync(await getBuffer(links.gltf.url));
  for (const [name, data] of Object.entries(files)) {
    if (name.endsWith('/')) continue;
    const path = join(work, name);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, data);
  }
  return findGltf(work);
}

function creditsMarkdown(credits) {
  const rows = Object.entries(credits)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, c]) => `| \`${id}\` | [${c.title}](${c.url}) | [${c.author}](${c.authorUrl}) | [${c.license}](${c.licenseUrl}) |`);
  return [
    '| Game id | Model | Author | License |',
    '| --- | --- | --- | --- |',
    ...rows,
    '',
    'Changes: rescaled, re-oriented, simplified, textures recompressed, materials replaced, badge meshes hidden.',
  ].join('\n');
}

async function updateCreditsMd(root, credits) {
  const path = join(root, 'CREDITS.md');
  const md = await readFile(path, 'utf8');
  const start = '<!-- sketchfab:start -->';
  const end = '<!-- sketchfab:end -->';
  const i = md.indexOf(start);
  const j = md.indexOf(end);
  if (i < 0 || j < 0) return;
  await writeFile(path, `${md.slice(0, i + start.length)}\n${creditsMarkdown(credits)}\n${md.slice(j)}`);
}

export async function fetchSketchfab(root, { force = false } = {}) {
  const token = process.env.SKETCHFAB_TOKEN?.trim();
  const dir = join(root, 'public/assets/vehicles/sketchfab');
  const creditsPath = join(dir, 'credits.json');
  await mkdir(dir, { recursive: true });
  let credits = {};
  try {
    credits = JSON.parse(await readFile(creditsPath, 'utf8'));
  } catch {
    credits = {};
  }

  let skipped = 0;
  let failed = 0;
  for (const m of SKETCHFAB_MODELS) {
    const out = join(dir, `${m.id}.glb`);
    const cached = await stat(out).then((s) => s.size > 10_000, () => false);
    if (cached && credits[m.id] && !force) {
      console.log(`✓ sketchfab ${m.id} (cached)`);
      continue;
    }
    try {
      const meta = await getJson(`${API}/models/${m.uid}`);
      if (!ALLOWED_LICENSES.has(meta.license?.slug)) {
        console.warn(`! sketchfab ${m.id}: license "${meta.license?.label}" is not CC BY/CC0, skipped`);
        failed++;
        continue;
      }
      if (!token) {
        skipped++;
        continue;
      }
      const work = await mkdtemp(join(tmpdir(), `sf-${m.id}-`));
      try {
        const src = await downloadModel(m.uid, token, work);
        const r = await optimizeGlb(src, out, { maxTris: m.maxTris, texSize: m.texSize });
        const size = (await stat(out)).size / 1e6;
        console.log(`↓ sketchfab ${m.id}: "${meta.name}" by ${meta.user.username}, ${r.before} → ${r.after} tris, ${size.toFixed(1)} MB`);
      } finally {
        await rm(work, { recursive: true, force: true });
      }
      credits[m.id] = {
        title: meta.name,
        author: meta.user.displayName || meta.user.username,
        authorUrl: meta.user.profileUrl,
        url: meta.viewerUrl,
        license: meta.license.label,
        licenseUrl: meta.license.url,
      };
      await writeFile(creditsPath, `${JSON.stringify(credits, null, 2)}\n`);
    } catch (err) {
      console.warn(`! sketchfab ${m.id}: ${err.message}`);
      failed++;
    }
  }
  if (skipped) console.log(`· ${skipped} Sketchfab model(s) not downloaded: set SKETCHFAB_TOKEN to fetch them (stock bodies are used meanwhile).`);
  await updateCreditsMd(root, credits);
  return failed;
}
