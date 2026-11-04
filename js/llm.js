// Local model runtime: WebLLM (MLC) on WebGPU, inside a Web Worker.
// Weights download once from Hugging Face and are cached on-device (Cache API).
// Prompts and outputs never leave the device.
import { CreateWebWorkerMLCEngine, prebuiltAppConfig, hasModelInCache, deleteModelAllInfoInCache } from '../vendor/web-llm/index.js';

// Candidates sized for a 4 GB iPad. VRAM figures come from WebLLM's config (at 4k context).
export const CANDIDATES = [
  { base: 'Qwen2.5-Coder-0.5B-Instruct', label: 'Qwen2.5-Coder 0.5B', note: 'best for code here — hosted with this app' },
  { base: 'Qwen3-0.6B',                  label: 'Qwen3 0.6B',         note: 'newer general model — hosted with this app' },
  { base: 'Qwen2.5-Coder-1.5B-Instruct', label: 'Qwen2.5-Coder 1.5B', note: 'smarter, ~1.6 GB — needs Hugging Face (blocked on some networks)' },
  { base: 'Llama-3.2-1B-Instruct',       label: 'Llama 3.2 1B',       note: 'general chat — needs Hugging Face (blocked on some networks)' },
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
  'Qwen3-0.6B-q4f16_1-MLC': 'Qwen3-0.6B-q4f16_1_cs1k-webgpu.wasm',
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

// iPadOS can take the GPU away (app backgrounded, Slide Over hidden, memory pressure).
// WebLLM then disposes its runtime and every later call throws "…has already been disposed".
const GPU_LOST = /disposed|device (was )?lost|DeviceLost|GPUDevice|Instance\.dispose|GPU connection|out of memory/i;
const stripThink = (t) => t.replace(/<think>[\s\S]*?(<\/think>\s*|$)/, '');
export const isGpuLost = (e) => GPU_LOST.test(String(e?.message || e));
// Temporary WebGPU failures (e.g. "OperationError: map async was not successful").
const GPU_TRANSIENT = /map ?async|OperationError|mapAsync|GPUBuffer/i;
export const isTransientGpu = (e) => GPU_TRANSIENT.test(`${e?.name || ''} ${e?.message || e}`);

class LocalLLM {
  engine = null; worker = null; modelId = null; loadSeconds = 0; busy = false;
  lastLoad = null;           // { id, contextWindow } — used to rebuild after GPU loss
  loading = null;            // in-flight load promise: loads are serialized
  onRecover = null;          // UI hook: (phase) => void

  load(id, opts = {}) {
    const run = async () => {
      if (this.modelId === id && this.engine) return;
      await this.unload();
      const { contextWindow = 2048, onProgress } = opts;
      const t0 = performance.now();
      this.worker = new Worker(new URL('./llm-worker.js', import.meta.url), { type: 'module' });
      this.engine = await CreateWebWorkerMLCEngine(this.worker, id,
        { appConfig: APP_CONFIG, initProgressCallback: (r) => onProgress?.(r) },
        { context_window_size: contextWindow });
      this.modelId = id;
      this.lastLoad = { id, contextWindow };
      this.loadSeconds = (performance.now() - t0) / 1000;
    };
    const p = (this.loading || Promise.resolve()).catch(() => {}).then(run);
    const tracked = p.finally(() => { if (this.loading === tracked) this.loading = null; });
    tracked.catch(() => {});
    this.loading = tracked;
    return p;
  }

  async unload() {
    try { await this.engine?.unload(); } catch {}
    this.worker?.terminate();
    this.engine = null; this.worker = null; this.modelId = null;
  }

  // Rebuild the engine from the on-device copy (no download) after the GPU was lost.
  async recover() {
    if (!this.lastLoad) throw new Error('Model not loaded');
    const { id, contextWindow } = this.lastLoad;
    this.onRecover?.('start');
    this.worker?.terminate(); this.engine = null; this.worker = null; this.modelId = null;
    try { await this.load(id, { contextWindow }); this.onRecover?.('done'); }
    catch (e) { this.onRecover?.('failed'); throw e; }
  }

  get ready() { return !!this.engine; }
  get recoverable() { return !!this.lastLoad; }

  // Runs a model call with two safety nets:
  //  - GPU loss → rebuild from the on-device copy and retry once.
  //  - Watchdog → if no progress for `idleMs`, interrupt; if still stuck, restart the engine.
  async withRecovery(fn, { idleMs = 60000 } = {}) {
    if (this.loading) await this.loading.catch(() => {});
    if (!this.engine) { if (this.lastLoad) await this.recover(); else throw new Error('Model not loaded'); }
    this.busy = true;
    const attempt = () => new Promise((resolve, reject) => {
      let done = false, timer = null;
      const finish = (f, v) => { if (!done) { done = true; clearTimeout(timer); f(v); } };
      const arm = () => {
        clearTimeout(timer);
        timer = setTimeout(async () => {
          this.interrupt();                                   // ask nicely first
          await new Promise((r) => setTimeout(r, 3000));
          if (done) return;
          finish(reject, new Error('STALLED'));
          this.recover().catch(() => {});                     // then restart the engine
        }, idleMs);
      };
      arm();
      fn(arm).then((v) => finish(resolve, v), (e) => finish(reject, e));
    });
    try {
      try { return await attempt(); }
      catch (e) {
        if (e?.message === 'STALLED') throw new Error('The model stopped responding, so it was restarted. Please try again.');
        if (isTransientGpu(e)) {
          // Seen on a 4 GB iPad under memory pressure: retry once, then rebuild the engine.
          await new Promise((r) => setTimeout(r, 400));
          try { return await attempt(); } catch (e2) { if (!isTransientGpu(e2) && !isGpuLost(e2)) throw e2; }
          await this.recover();
          return await attempt();
        }
        if (!isGpuLost(e)) throw e;
        await this.recover();           // one automatic retry
        return await attempt();
      }
    } finally { this.busy = false; }
  }

  // Streams text. Returns { text, stats }.
  stream(messages, { onToken, temperature = 0.2, maxTokens = 768 } = {}) {
    return this.withRecovery(async (progress) => {
      let text = '', raw = '', stats = null;
      const chunks = await this.engine.chat.completions.create({
        messages, temperature, max_tokens: maxTokens, stream: true, stream_options: { include_usage: true }, ...this.extra(),
      });
      for await (const c of chunks) {
        progress();
        const d = c.choices?.[0]?.delta?.content;
        if (d) { raw += d; text = stripThink(raw); onToken?.(text); }
        if (c.usage) stats = c.usage;
      }
      return { text, stats };
    });
  }

  // Grammar-constrained JSON: output is guaranteed to parse and match the schema's shape.
  json(messages, schema, { maxTokens = 160, idleMs = 30000 } = {}) {
    return this.withRecovery(async () => {
      const r = await this.engine.chat.completions.create({
        messages, temperature: 0, max_tokens: maxTokens,
        response_format: { type: 'json_object', schema: JSON.stringify(schema) }, ...this.extra(),
      });
      return { value: JSON.parse(stripThink(r.choices[0].message.content).trim()), stats: r.usage };
    }, { idleMs });
  }

  extra() { return /^Qwen3/.test(this.modelId || '') ? { extra_body: { enable_thinking: false } } : {}; }

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
