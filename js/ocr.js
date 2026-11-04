// On-device screen understanding: Tesseract OCR (WebAssembly) + cheap visual observations.
// The image is processed in memory only and released right after OCR.
// The result is structured text with approximate positions, never the image itself.

let workerPromise = null;

function loadScript(src) {
  return new Promise((res, rej) => {
    if (window.Tesseract) return res();
    const s = document.createElement('script');
    s.src = src; s.onload = res; s.onerror = () => rej(new Error('Could not load OCR engine'));
    document.head.appendChild(s);
  });
}

async function getWorker(onProgress) {
  if (!workerPromise) {
    workerPromise = (async () => {
      const base = new URL('../vendor/tesseract/', import.meta.url).href;
      await loadScript(base + 'tesseract.min.js');
      return window.Tesseract.createWorker('eng', 1, {
        workerPath: base + 'worker.min.js',
        corePath: base + 'core',
        langPath: base + 'lang',
        gzip: true,
        cacheMethod: 'none',        // service worker already caches the language file
        workerBlobURL: false,
        logger: (m) => onProgress?.(m),
      });
    })().catch((e) => { workerPromise = null; throw e; });
  }
  return workerPromise;
}

export function warmOCR() { getWorker().catch(() => {}); }

const REGION_V = ['top', 'middle', 'bottom'];
const REGION_H = ['left', 'center', 'right'];

// Takes a Blob/File, returns { width, height, lines:[{text, conf, region, y}], observations:[], ms }
export async function analyzeImage(blob, { onProgress } = {}) {
  const t0 = performance.now();
  let bitmap = await createImageBitmap(blob);
  const { width, height } = bitmap;
  // Downscale very large images: faster OCR, lower memory.
  const scale = Math.min(1, 2400 / Math.max(width, height));
  let canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale); canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close(); bitmap = null;

  const observations = visualObservations(ctx, canvas.width, canvas.height);

  const worker = await getWorker(onProgress);
  const { data } = await worker.recognize(canvas, {}, { blocks: true, text: false });

  // Release pixels immediately.
  canvas.width = 0; canvas.height = 0; canvas = null;

  const W = Math.round(width * scale), H = Math.round(height * scale);
  const lines = [];
  for (const b of data.blocks || []) for (const p of b.paragraphs || []) for (const l of p.lines || []) {
    const text = (l.text || '').replace(/\s+/g, ' ').trim();
    if (!text || l.confidence < 45 || !/[a-z0-9]/i.test(text)) continue;
    const cx = (l.bbox.x0 + l.bbox.x1) / 2 / W, cy = (l.bbox.y0 + l.bbox.y1) / 2 / H;
    lines.push({
      text, conf: Math.round(l.confidence), y: cy, x: cx,
      region: `${REGION_V[Math.min(2, Math.floor(cy * 3))]}-${REGION_H[Math.min(2, Math.floor(cx * 3))]}`,
    });
  }
  lines.sort((a, b) => a.y - b.y || a.x - b.x);

  const all = lines.map(l => l.text).join('\n');
  if (/(error|exception|traceback|failed|undefined is not|cannot|unexpected token|syntaxerror|typeerror)/i.test(all)) observations.push('error or warning text is visible');
  const codeish = lines.filter(l => /[{};=()<>]|^\s*(def|function|const|let|var|import|class|return|if|for)\b/.test(l.text)).length;
  if (codeish >= 3) observations.push(`looks like source code (${codeish} code-like lines)`);
  if (/https?:\/\/|www\.|\.com\b/i.test(all)) observations.push('a web address is visible (likely a browser)');

  return { width, height, lines, observations, ms: Math.round(performance.now() - t0) };
}

function visualObservations(ctx, w, h) {
  const obs = [];
  try {
    const step = Math.max(1, Math.floor(Math.min(w, h) / 64));
    const img = ctx.getImageData(0, 0, w, h).data;
    let sum = 0, n = 0;
    for (let y = 0; y < h; y += step) for (let x = 0; x < w; x += step) {
      const i = (y * w + x) * 4; sum += 0.2126 * img[i] + 0.7152 * img[i + 1] + 0.0722 * img[i + 2]; n++;
    }
    obs.push(sum / n < 100 ? 'dark theme' : 'light theme');
    obs.push(w > h ? 'landscape' : 'portrait');
  } catch {}
  return obs;
}

// Compact, position-aware text for the model, within a character budget.
export function toContext(result, budget = 2400) {
  const head = `Screenshot ${result.width}x${result.height}; ${result.observations.join('; ')}.\n`;
  let body = '', lastRegion = '';
  for (const l of result.lines) {
    const line = (l.region !== lastRegion ? `[${l.region}] ` : '') + l.text + '\n';
    if (head.length + body.length + line.length > budget) { body += '…(more text truncated)\n'; break; }
    body += line; lastRegion = l.region;
  }
  return head + (body || '(no readable text found)\n');
}
