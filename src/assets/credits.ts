export interface ModelCredit {
  title: string;
  author: string;
  authorUrl: string;
  url: string;
  license: string;
  licenseUrl: string;
}

let credits: Promise<Record<string, ModelCredit>> | null = null;

/** Attribution for a loaded vehicle source (CC BY requires crediting the author). */
export async function creditFor(source: string): Promise<ModelCredit | null> {
  const m = /\/sketchfab\/([\w-]+)\.glb$/.exec(source);
  if (!m) return null;
  credits ??= fetch(`${import.meta.env.BASE_URL}assets/vehicles/sketchfab/credits.json`)
    .then((r) => (r.ok ? r.json() : {}))
    .catch(() => ({}));
  return (await credits)[m[1]] ?? null;
}
