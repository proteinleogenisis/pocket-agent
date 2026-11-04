// Local model runtime: WebLLM (MLC) on WebGPU, inside a Web Worker.
// Weights download once from Hugging Face and are cached on-device (Cache API).
// Prompts and outputs never leave the device.
import { CreateWebWorkerMLCEngine, prebuiltAppConfig, hasModelInCache, deleteModelAllInfoInCache } from '../vendor/web-llm/index.js';

// Candidates sized for a 4 GB iPad. VRAM figures come from WebLLM's config (at 4k context).
export const CANDIDATES = [
  { base: 'Qwen2.5-Coder-0.5B-Instruct', label: 'Qwen2.5-Coder 0.5B', note: 'fastest, lowest memory — default, hosted with this app' },
  { base: 'Qwen2.5-Coder-1.5B-Instruct', label: 'Qwen2.5-Coder 1.5B', note: 'better code, needs ~1.6 GB' },
  { base: 'Llama-3.2-1B-Instruct',       label: 'Llama 3.2 1B',      note: 'general chat, ~0.9 GB' },
  { base: 'Qwen3-0.6B',                  label: 'Qwen3 0.6B',        note: 'newer small model, ~1.4 GB' },
];

let gpuInfo = null;
export async function probeGPU() {
  if (gpuInfo) return gpuInfo;
  if (!('gpu' in navigator)) return (gpuInfo = { ok: false, reason: 'WebGPU is not available in this browser.' });
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) return (gpuInfo = { ok: false, reason: 'No WebGPU adapter.' });
    gpuInfo = {
      ok: true,
      f16: adapter.features.has('shader-f16'),
      maxBuffer: adapter.limits.maxBufferSize,
      maxStorage: adapter.limits.maxStorageBufferBindingSize,
      vendor: adapter.info?.vendor || '', arch: adapter.info?.architecture || '',
    };
  } catch (e) { gpuInfo = { ok: false, reason: String(e?.message || e) }; }
  return gpuInfo;
}

// Models mirrored on this site (same origin), for networks that block huggingface.co.
const MIRRORED = {
  'Qwen2.5-Coder-0.5B-Instruct-q4f16_1-MLC': 'Qwen2-0.5B-Instruct-q4f16_1_cs1k-webgpu.wasm',
};
const modelsBase = new URL('../models/', import.meta.url).href;
export const APP_CONFIG = {
  ...prebuiltAppConfig,
  model_list: prebuiltAppConfig.model_list.map((m) => MIRRORED[m.model_id]
    ? { ...m, model: `${modelsBase}${m.model_id}/resolve/main/`, model_lib: `${modelsBase}lib/${MIRRORED[m.model_id]}` }
    : m),
};
export const isMirrored = (id) => !!MIRRORED[id];

export function modelIdFor(base, f16) {
  const id = `${base}-${f16 ? 'q4f16_1' : 'q4f32_1'}-MLC`;
  return APP_CONFIG.model_list.find(m => m.model_id === id) ? id : null;
}
export function modelRecord(id) { return APP_CONFIG.model_list.find(m => m.model_id === id); }

export async function isCached(id) { try { return await hasModelInCache(id, APP_CONFIG); } catch { return false; } }
export async function deleteCached(id) { await deleteModelAllInfoInCache(id, APP_CONFIG); }

class LocalLLM {
  engine = null; worker = null; modelId = null; loadSeconds = 0; busy = false;

  async load(id, { contextWindow = 2048, onProgress } = {}) {
    if (this.modelId === id && this.engine) return;
    await this.unload();
    const t0 = performance.now();
    this.worker = new Worker(new URL('./llm-worker.js', import.meta.url), { type: 'module' });
    this.engine = await CreateWebWorkerMLCEngine(this.worker, id,
      { appConfig: APP_CONFIG, initProgressCallback: (r) => onProgress?.(r) },
      { context_window_size: contextWindow });
    this.modelId = id;
    this.loadSeconds = (performance.now() - t0) / 1000;
  }

  async unload() {
    try { await this.engine?.unload(); } catch {}
    this.worker?.terminate();
    this.engine = null; this.worker = null; this.modelId = null;
  }

  get ready() { return !!this.engine; }

  // Streams text. Returns { text, stats }.
  async stream(messages, { onToken, temperature = 0.2, maxTokens = 768 } = {}) {
    if (!this.engine) throw new Error('Model not loaded');
    this.busy = true;
    let text = '', stats = null;
    try {
      const chunks = await this.engine.chat.completions.create({
        messages, temperature, max_tokens: maxTokens, stream: true, stream_options: { include_usage: true },
      });
      for await (const c of chunks) {
        const d = c.choices?.[0]?.delta?.content;
        if (d) { text += d; onToken?.(text); }
        if (c.usage) stats = c.usage;
      }
    } finally { this.busy = false; }
    return { text, stats };
  }

  // Grammar-constrained JSON: output is guaranteed to parse and match the schema's shape.
  async json(messages, schema, { maxTokens = 160 } = {}) {
    if (!this.engine) throw new Error('Model not loaded');
    this.busy = true;
    try {
      const r = await this.engine.chat.completions.create({
        messages, temperature: 0, max_tokens: maxTokens,
        response_format: { type: 'json_object', schema: JSON.stringify(schema) },
      });
      return { value: JSON.parse(r.choices[0].message.content), stats: r.usage };
    } finally { this.busy = false; }
  }

  interrupt() { try { this.engine?.interruptGenerate(); } catch {} }
}

export const llm = new LocalLLM();

// After a failed download: find out which server is unreachable, so the error is specific.
export async function diagnoseNetwork(id) {
  const rec = modelRecord(id);
  const targets = [...new Set([new URL(rec.model).origin, new URL(rec.model_lib).origin])];
  const results = [];
  for (const origin of targets) {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 8000);
    try { await fetch(origin + '/', { mode: 'no-cors', cache: 'no-store', signal: ctl.signal }); results.push({ origin, ok: true }); }
    catch { results.push({ origin, ok: false }); }
    finally { clearTimeout(t); }
  }
  return results;
}
