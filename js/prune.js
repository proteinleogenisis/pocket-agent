// Pure Cache API pruning logic (no imports) so it can be tested in Node.
const ID_RE = /\/(?:models\/(?:remote\/)?|mlc-ai\/)([^/]+)\/resolve\/main\//;
const abs = (x, baseHref) => { try { return baseHref ? new URL(x, baseHref).href : new URL(x).href; } catch { return String(x); } };
const dec = (u) => { try { return decodeURIComponent(u); } catch { return u; } };

export function modelIdForUrl(url, modelList, baseHref) {
  const u = dec(url);
  for (const m of modelList) {
    if (!m.model) continue;
    const prefix = dec(abs(m.model, baseHref));
    if (u.startsWith(prefix)) return m.model_id;
  }
  const hit = ID_RE.exec(u);
  return hit ? hit[1] : null;
}

export async function pruneCaches(cachesObj, modelList, keepIds, baseHref) {
  let deleted = 0;
  try {
    if (!cachesObj) return { deleted: 0 };
    const keep = new Set(keepIds);
    for (const name of ['webllm/model', 'webllm/config']) {
      try {
        const cache = await cachesObj.open(name);
        for (const req of await cache.keys()) {
          const id = modelIdForUrl(req.url, modelList, baseHref);
          if (id && !keep.has(id) && await cache.delete(req)) deleted++;
        }
      } catch { /* keep going */ }
    }
    try {
      const libs = new Set(modelList.filter((m) => keep.has(m.model_id) && m.model_lib).map((m) => abs(m.model_lib, baseHref)));
      const cache = await cachesObj.open('webllm/wasm');
      for (const req of await cache.keys()) {
        if (!libs.has(abs(req.url, baseHref)) && await cache.delete(req)) deleted++;
      }
    } catch { /* ignore */ }
  } catch { /* never throw */ }
  return { deleted };
}
