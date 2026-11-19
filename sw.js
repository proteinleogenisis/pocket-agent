// Offline support: precaches the app shell and vendored engines (OCR, Python, model runtime).
// Model weights are cached separately by WebLLM; this worker never touches them.
const VERSION = 'aa2508189121';
const CACHE = `pocket-agent-${VERSION}`;
const FILES = [
  "./",
  ".claude/worktrees/agent-aa563f9b7aa0ce719/README.md",
  ".claude/worktrees/agent-aa563f9b7aa0ce719/callback.html",
  ".claude/worktrees/agent-aa563f9b7aa0ce719/icons/icon-180.png",
  ".claude/worktrees/agent-aa563f9b7aa0ce719/icons/icon-192.png",
  ".claude/worktrees/agent-aa563f9b7aa0ce719/icons/icon-512.png",
  ".claude/worktrees/agent-aa563f9b7aa0ce719/index.html",
  ".claude/worktrees/agent-aa563f9b7aa0ce719/js/actions.js",
  ".claude/worktrees/agent-aa563f9b7aa0ce719/js/agent.js",
  ".claude/worktrees/agent-aa563f9b7aa0ce719/js/app.js",
  ".claude/worktrees/agent-aa563f9b7aa0ce719/js/calc.js",
  ".claude/worktrees/agent-aa563f9b7aa0ce719/js/device.js",
  ".claude/worktrees/agent-aa563f9b7aa0ce719/js/llm-worker.js",
  ".claude/worktrees/agent-aa563f9b7aa0ce719/js/llm.js",
  ".claude/worktrees/agent-aa563f9b7aa0ce719/js/net.js",
  ".claude/worktrees/agent-aa563f9b7aa0ce719/js/ocr.js",
  ".claude/worktrees/agent-aa563f9b7aa0ce719/js/prune.js",
  ".claude/worktrees/agent-aa563f9b7aa0ce719/js/sandbox-js-worker.js",
  ".claude/worktrees/agent-aa563f9b7aa0ce719/js/sandbox-py-worker.js",
  ".claude/worktrees/agent-aa563f9b7aa0ce719/js/sandbox.js",
  ".claude/worktrees/agent-aa563f9b7aa0ce719/js/store.js",
  ".claude/worktrees/agent-aa563f9b7aa0ce719/js/web.js",
  ".claude/worktrees/agent-aa563f9b7aa0ce719/manifest.webmanifest",
  ".claude/worktrees/agent-aa563f9b7aa0ce719/models/NOTICE.md",
  ".claude/worktrees/agent-aa563f9b7aa0ce719/models/Pocket-Agent-0.5B-q4f16_1-MLC/resolve/main/merges.txt",
  ".claude/worktrees/agent-aa563f9b7aa0ce719/models/Pocket-Agent-0.5B-q4f16_1-MLC/resolve/main/mlc-chat-config.json",
  ".claude/worktrees/agent-aa563f9b7aa0ce719/models/Pocket-Agent-0.5B-q4f16_1-MLC/resolve/main/ndarray-cache.json",
  ".claude/worktrees/agent-aa563f9b7aa0ce719/models/Pocket-Agent-0.5B-q4f16_1-MLC/resolve/main/params_shard_0.bin",
  ".claude/worktrees/agent-aa563f9b7aa0ce719/models/Pocket-Agent-0.5B-q4f16_1-MLC/resolve/main/params_shard_1.bin",
  ".claude/worktrees/agent-aa563f9b7aa0ce719/models/Pocket-Agent-0.5B-q4f16_1-MLC/resolve/main/params_shard_2.bin",
  ".claude/worktrees/agent-aa563f9b7aa0ce719/models/Pocket-Agent-0.5B-q4f16_1-MLC/resolve/main/params_shard_3.bin",
  ".claude/worktrees/agent-aa563f9b7aa0ce719/models/Pocket-Agent-0.5B-q4f16_1-MLC/resolve/main/params_shard_4.bin",
  ".claude/worktrees/agent-aa563f9b7aa0ce719/models/Pocket-Agent-0.5B-q4f16_1-MLC/resolve/main/params_shard_5.bin",
  ".claude/worktrees/agent-aa563f9b7aa0ce719/models/Pocket-Agent-0.5B-q4f16_1-MLC/resolve/main/params_shard_6.bin",
  ".claude/worktrees/agent-aa563f9b7aa0ce719/models/Pocket-Agent-0.5B-q4f16_1-MLC/resolve/main/params_shard_7.bin",
  ".claude/worktrees/agent-aa563f9b7aa0ce719/models/Pocket-Agent-0.5B-q4f16_1-MLC/resolve/main/tensor-cache.json",
  ".claude/worktrees/agent-aa563f9b7aa0ce719/models/Pocket-Agent-0.5B-q4f16_1-MLC/resolve/main/tokenizer.json",
  ".claude/worktrees/agent-aa563f9b7aa0ce719/models/Pocket-Agent-0.5B-q4f16_1-MLC/resolve/main/tokenizer_config.json",
  ".claude/worktrees/agent-aa563f9b7aa0ce719/models/Pocket-Agent-0.5B-q4f16_1-MLC/resolve/main/vocab.json",
  ".claude/worktrees/agent-aa563f9b7aa0ce719/models/Qwen3-0.6B-q4f16_1-MLC/resolve/main/README.md",
  ".claude/worktrees/agent-aa563f9b7aa0ce719/models/Qwen3-0.6B-q4f16_1-MLC/resolve/main/merges.txt",
  ".claude/worktrees/agent-aa563f9b7aa0ce719/models/Qwen3-0.6B-q4f16_1-MLC/resolve/main/mlc-chat-config.json",
  ".claude/worktrees/agent-aa563f9b7aa0ce719/models/Qwen3-0.6B-q4f16_1-MLC/resolve/main/ndarray-cache.json",
  ".claude/worktrees/agent-aa563f9b7aa0ce719/models/Qwen3-0.6B-q4f16_1-MLC/resolve/main/params_shard_0.bin",
  ".claude/worktrees/agent-aa563f9b7aa0ce719/models/Qwen3-0.6B-q4f16_1-MLC/resolve/main/params_shard_1.bin",
  ".claude/worktrees/agent-aa563f9b7aa0ce719/models/Qwen3-0.6B-q4f16_1-MLC/resolve/main/params_shard_2.bin",
  ".claude/worktrees/agent-aa563f9b7aa0ce719/models/Qwen3-0.6B-q4f16_1-MLC/resolve/main/params_shard_3.bin",
  ".claude/worktrees/agent-aa563f9b7aa0ce719/models/Qwen3-0.6B-q4f16_1-MLC/resolve/main/params_shard_4.bin",
  ".claude/worktrees/agent-aa563f9b7aa0ce719/models/Qwen3-0.6B-q4f16_1-MLC/resolve/main/params_shard_5.bin",
  ".claude/worktrees/agent-aa563f9b7aa0ce719/models/Qwen3-0.6B-q4f16_1-MLC/resolve/main/params_shard_6.bin",
  ".claude/worktrees/agent-aa563f9b7aa0ce719/models/Qwen3-0.6B-q4f16_1-MLC/resolve/main/params_shard_7.bin",
  ".claude/worktrees/agent-aa563f9b7aa0ce719/models/Qwen3-0.6B-q4f16_1-MLC/resolve/main/params_shard_8.bin",
  ".claude/worktrees/agent-aa563f9b7aa0ce719/models/Qwen3-0.6B-q4f16_1-MLC/resolve/main/tensor-cache.json",
  ".claude/worktrees/agent-aa563f9b7aa0ce719/models/Qwen3-0.6B-q4f16_1-MLC/resolve/main/tokenizer.json",
  ".claude/worktrees/agent-aa563f9b7aa0ce719/models/Qwen3-0.6B-q4f16_1-MLC/resolve/main/tokenizer_config.json",
  ".claude/worktrees/agent-aa563f9b7aa0ce719/models/Qwen3-0.6B-q4f16_1-MLC/resolve/main/vocab.json",
  ".claude/worktrees/agent-aa563f9b7aa0ce719/models/lib/Qwen2-0.5B-Instruct-q4f16_1_cs1k-webgpu.wasm",
  ".claude/worktrees/agent-aa563f9b7aa0ce719/models/lib/Qwen2-1.5B-Instruct-q4f16_1_cs1k-webgpu.wasm",
  ".claude/worktrees/agent-aa563f9b7aa0ce719/models/lib/Qwen3-0.6B-q4f16_1_cs1k-webgpu.wasm",
  ".claude/worktrees/agent-aa563f9b7aa0ce719/shortcuts/manifest.json",
  ".claude/worktrees/agent-aa563f9b7aa0ce719/styles.css",
  ".claude/worktrees/agent-aa563f9b7aa0ce719/sw.js",
  ".claude/worktrees/agent-aa563f9b7aa0ce719/tests/index.html",
  ".claude/worktrees/agent-aa563f9b7aa0ce719/tests/prune.test.mjs",
  ".claude/worktrees/agent-aa563f9b7aa0ce719/tests/screen.test.mjs",
  ".claude/worktrees/agent-aa563f9b7aa0ce719/tests/tasks.js",
  ".claude/worktrees/agent-aa563f9b7aa0ce719/tools/build.py",
  ".claude/worktrees/agent-aa563f9b7aa0ce719/tools/make_shortcuts.py",
  ".claude/worktrees/agent-aa563f9b7aa0ce719/tools/serve.py",
  ".claude/worktrees/agent-aa563f9b7aa0ce719/tools/sw.template.js",
  ".claude/worktrees/agent-aa563f9b7aa0ce719/tools/train/build_data.py",
  ".claude/worktrees/agent-aa563f9b7aa0ce719/tools/train/eval_reading.py",
  ".claude/worktrees/agent-aa563f9b7aa0ce719/tools/train/eval_set.py",
  ".claude/worktrees/agent-aa563f9b7aa0ce719/tools/train/gen_math.py",
  ".claude/worktrees/agent-aa563f9b7aa0ce719/tools/train/gen_teacher.py",
  ".claude/worktrees/agent-aa563f9b7aa0ce719/tools/train/lora.yaml",
  ".claude/worktrees/agent-aa563f9b7aa0ce719/tools/train/pipeline.sh",
  ".claude/worktrees/agent-aa563f9b7aa0ce719/tools/train/run_eval.py",
  ".claude/worktrees/agent-aa563f9b7aa0ce719/tools/train/to_mlc.py",
  ".claude/worktrees/agent-aa563f9b7aa0ce719/tools/train/verify.py",
  ".claude/worktrees/agent-aa563f9b7aa0ce719/vendor/pyodide/pyodide-lock.json",
  ".claude/worktrees/agent-aa563f9b7aa0ce719/vendor/pyodide/pyodide.asm.mjs",
  ".claude/worktrees/agent-aa563f9b7aa0ce719/vendor/pyodide/pyodide.asm.wasm",
  ".claude/worktrees/agent-aa563f9b7aa0ce719/vendor/pyodide/pyodide.mjs",
  ".claude/worktrees/agent-aa563f9b7aa0ce719/vendor/pyodide/python_stdlib.zip",
  ".claude/worktrees/agent-aa563f9b7aa0ce719/vendor/tesseract/core/tesseract-core-lstm.wasm.js",
  ".claude/worktrees/agent-aa563f9b7aa0ce719/vendor/tesseract/core/tesseract-core-relaxedsimd-lstm.wasm.js",
  ".claude/worktrees/agent-aa563f9b7aa0ce719/vendor/tesseract/core/tesseract-core-simd-lstm.wasm.js",
  ".claude/worktrees/agent-aa563f9b7aa0ce719/vendor/tesseract/lang/eng.traineddata.gz",
  ".claude/worktrees/agent-aa563f9b7aa0ce719/vendor/tesseract/tesseract.min.js",
  ".claude/worktrees/agent-aa563f9b7aa0ce719/vendor/tesseract/worker.min.js",
  ".claude/worktrees/agent-aa563f9b7aa0ce719/vendor/web-llm/index.js",
  ".claude/worktrees/agent-ade9a5ca2778a278a/README.md",
  ".claude/worktrees/agent-ade9a5ca2778a278a/callback.html",
  ".claude/worktrees/agent-ade9a5ca2778a278a/icons/icon-180.png",
  ".claude/worktrees/agent-ade9a5ca2778a278a/icons/icon-192.png",
  ".claude/worktrees/agent-ade9a5ca2778a278a/icons/icon-512.png",
  ".claude/worktrees/agent-ade9a5ca2778a278a/index.html",
  ".claude/worktrees/agent-ade9a5ca2778a278a/js/actions.js",
  ".claude/worktrees/agent-ade9a5ca2778a278a/js/agent.js",
  ".claude/worktrees/agent-ade9a5ca2778a278a/js/app.js",
  ".claude/worktrees/agent-ade9a5ca2778a278a/js/calc.js",
  ".claude/worktrees/agent-ade9a5ca2778a278a/js/device.js",
  ".claude/worktrees/agent-ade9a5ca2778a278a/js/llm-worker.js",
  ".claude/worktrees/agent-ade9a5ca2778a278a/js/llm.js",
  ".claude/worktrees/agent-ade9a5ca2778a278a/js/net.js",
  ".claude/worktrees/agent-ade9a5ca2778a278a/js/ocr.js",
  ".claude/worktrees/agent-ade9a5ca2778a278a/js/sandbox-js-worker.js",
  ".claude/worktrees/agent-ade9a5ca2778a278a/js/sandbox-py-worker.js",
  ".claude/worktrees/agent-ade9a5ca2778a278a/js/sandbox.js",
  ".claude/worktrees/agent-ade9a5ca2778a278a/js/store.js",
  ".claude/worktrees/agent-ade9a5ca2778a278a/js/web.js",
  ".claude/worktrees/agent-ade9a5ca2778a278a/manifest.webmanifest",
  ".claude/worktrees/agent-ade9a5ca2778a278a/models/NOTICE.md",
  ".claude/worktrees/agent-ade9a5ca2778a278a/models/Pocket-Agent-0.5B-q4f16_1-MLC/resolve/main/merges.txt",
  ".claude/worktrees/agent-ade9a5ca2778a278a/models/Pocket-Agent-0.5B-q4f16_1-MLC/resolve/main/mlc-chat-config.json",
  ".claude/worktrees/agent-ade9a5ca2778a278a/models/Pocket-Agent-0.5B-q4f16_1-MLC/resolve/main/ndarray-cache.json",
  ".claude/worktrees/agent-ade9a5ca2778a278a/models/Pocket-Agent-0.5B-q4f16_1-MLC/resolve/main/params_shard_0.bin",
  ".claude/worktrees/agent-ade9a5ca2778a278a/models/Pocket-Agent-0.5B-q4f16_1-MLC/resolve/main/params_shard_1.bin",
  ".claude/worktrees/agent-ade9a5ca2778a278a/models/Pocket-Agent-0.5B-q4f16_1-MLC/resolve/main/params_shard_2.bin",
  ".claude/worktrees/agent-ade9a5ca2778a278a/models/Pocket-Agent-0.5B-q4f16_1-MLC/resolve/main/params_shard_3.bin",
  ".claude/worktrees/agent-ade9a5ca2778a278a/models/Pocket-Agent-0.5B-q4f16_1-MLC/resolve/main/params_shard_4.bin",
  ".claude/worktrees/agent-ade9a5ca2778a278a/models/Pocket-Agent-0.5B-q4f16_1-MLC/resolve/main/params_shard_5.bin",
  ".claude/worktrees/agent-ade9a5ca2778a278a/models/Pocket-Agent-0.5B-q4f16_1-MLC/resolve/main/params_shard_6.bin",
  ".claude/worktrees/agent-ade9a5ca2778a278a/models/Pocket-Agent-0.5B-q4f16_1-MLC/resolve/main/params_shard_7.bin",
  ".claude/worktrees/agent-ade9a5ca2778a278a/models/Pocket-Agent-0.5B-q4f16_1-MLC/resolve/main/tensor-cache.json",
  ".claude/worktrees/agent-ade9a5ca2778a278a/models/Pocket-Agent-0.5B-q4f16_1-MLC/resolve/main/tokenizer.json",
  ".claude/worktrees/agent-ade9a5ca2778a278a/models/Pocket-Agent-0.5B-q4f16_1-MLC/resolve/main/tokenizer_config.json",
  ".claude/worktrees/agent-ade9a5ca2778a278a/models/Pocket-Agent-0.5B-q4f16_1-MLC/resolve/main/vocab.json",
  ".claude/worktrees/agent-ade9a5ca2778a278a/models/Qwen3-0.6B-q4f16_1-MLC/resolve/main/README.md",
  ".claude/worktrees/agent-ade9a5ca2778a278a/models/Qwen3-0.6B-q4f16_1-MLC/resolve/main/merges.txt",
  ".claude/worktrees/agent-ade9a5ca2778a278a/models/Qwen3-0.6B-q4f16_1-MLC/resolve/main/mlc-chat-config.json",
  ".claude/worktrees/agent-ade9a5ca2778a278a/models/Qwen3-0.6B-q4f16_1-MLC/resolve/main/ndarray-cache.json",
  ".claude/worktrees/agent-ade9a5ca2778a278a/models/Qwen3-0.6B-q4f16_1-MLC/resolve/main/params_shard_0.bin",
  ".claude/worktrees/agent-ade9a5ca2778a278a/models/Qwen3-0.6B-q4f16_1-MLC/resolve/main/params_shard_1.bin",
  ".claude/worktrees/agent-ade9a5ca2778a278a/models/Qwen3-0.6B-q4f16_1-MLC/resolve/main/params_shard_2.bin",
  ".claude/worktrees/agent-ade9a5ca2778a278a/models/Qwen3-0.6B-q4f16_1-MLC/resolve/main/params_shard_3.bin",
  ".claude/worktrees/agent-ade9a5ca2778a278a/models/Qwen3-0.6B-q4f16_1-MLC/resolve/main/params_shard_4.bin",
  ".claude/worktrees/agent-ade9a5ca2778a278a/models/Qwen3-0.6B-q4f16_1-MLC/resolve/main/params_shard_5.bin",
  ".claude/worktrees/agent-ade9a5ca2778a278a/models/Qwen3-0.6B-q4f16_1-MLC/resolve/main/params_shard_6.bin",
  ".claude/worktrees/agent-ade9a5ca2778a278a/models/Qwen3-0.6B-q4f16_1-MLC/resolve/main/params_shard_7.bin",
  ".claude/worktrees/agent-ade9a5ca2778a278a/models/Qwen3-0.6B-q4f16_1-MLC/resolve/main/params_shard_8.bin",
  ".claude/worktrees/agent-ade9a5ca2778a278a/models/Qwen3-0.6B-q4f16_1-MLC/resolve/main/tensor-cache.json",
  ".claude/worktrees/agent-ade9a5ca2778a278a/models/Qwen3-0.6B-q4f16_1-MLC/resolve/main/tokenizer.json",
  ".claude/worktrees/agent-ade9a5ca2778a278a/models/Qwen3-0.6B-q4f16_1-MLC/resolve/main/tokenizer_config.json",
  ".claude/worktrees/agent-ade9a5ca2778a278a/models/Qwen3-0.6B-q4f16_1-MLC/resolve/main/vocab.json",
  ".claude/worktrees/agent-ade9a5ca2778a278a/models/lib/Qwen2-0.5B-Instruct-q4f16_1_cs1k-webgpu.wasm",
  ".claude/worktrees/agent-ade9a5ca2778a278a/models/lib/Qwen2-1.5B-Instruct-q4f16_1_cs1k-webgpu.wasm",
  ".claude/worktrees/agent-ade9a5ca2778a278a/models/lib/Qwen3-0.6B-q4f16_1_cs1k-webgpu.wasm",
  ".claude/worktrees/agent-ade9a5ca2778a278a/shortcuts/manifest.json",
  ".claude/worktrees/agent-ade9a5ca2778a278a/styles.css",
  ".claude/worktrees/agent-ade9a5ca2778a278a/sw.js",
  ".claude/worktrees/agent-ade9a5ca2778a278a/tests/index.html",
  ".claude/worktrees/agent-ade9a5ca2778a278a/tests/screen.test.mjs",
  ".claude/worktrees/agent-ade9a5ca2778a278a/tests/tasks.js",
  ".claude/worktrees/agent-ade9a5ca2778a278a/tools/build.py",
  ".claude/worktrees/agent-ade9a5ca2778a278a/tools/make_shortcuts.py",
  ".claude/worktrees/agent-ade9a5ca2778a278a/tools/serve.py",
  ".claude/worktrees/agent-ade9a5ca2778a278a/tools/sw.template.js",
  ".claude/worktrees/agent-ade9a5ca2778a278a/tools/train/build_data.py",
  ".claude/worktrees/agent-ade9a5ca2778a278a/tools/train/eval_reading.py",
  ".claude/worktrees/agent-ade9a5ca2778a278a/tools/train/eval_set.py",
  ".claude/worktrees/agent-ade9a5ca2778a278a/tools/train/gen_math.py",
  ".claude/worktrees/agent-ade9a5ca2778a278a/tools/train/gen_teacher.py",
  ".claude/worktrees/agent-ade9a5ca2778a278a/tools/train/lora.yaml",
  ".claude/worktrees/agent-ade9a5ca2778a278a/tools/train/pipeline.sh",
  ".claude/worktrees/agent-ade9a5ca2778a278a/tools/train/run_eval.py",
  ".claude/worktrees/agent-ade9a5ca2778a278a/tools/train/to_mlc.py",
  ".claude/worktrees/agent-ade9a5ca2778a278a/tools/train/verify.py",
  ".claude/worktrees/agent-ade9a5ca2778a278a/vendor/pyodide/pyodide-lock.json",
  ".claude/worktrees/agent-ade9a5ca2778a278a/vendor/pyodide/pyodide.asm.mjs",
  ".claude/worktrees/agent-ade9a5ca2778a278a/vendor/pyodide/pyodide.asm.wasm",
  ".claude/worktrees/agent-ade9a5ca2778a278a/vendor/pyodide/pyodide.mjs",
  ".claude/worktrees/agent-ade9a5ca2778a278a/vendor/pyodide/python_stdlib.zip",
  ".claude/worktrees/agent-ade9a5ca2778a278a/vendor/tesseract/core/tesseract-core-lstm.wasm.js",
  ".claude/worktrees/agent-ade9a5ca2778a278a/vendor/tesseract/core/tesseract-core-relaxedsimd-lstm.wasm.js",
  ".claude/worktrees/agent-ade9a5ca2778a278a/vendor/tesseract/core/tesseract-core-simd-lstm.wasm.js",
  ".claude/worktrees/agent-ade9a5ca2778a278a/vendor/tesseract/lang/eng.traineddata.gz",
  ".claude/worktrees/agent-ade9a5ca2778a278a/vendor/tesseract/tesseract.min.js",
  ".claude/worktrees/agent-ade9a5ca2778a278a/vendor/tesseract/worker.min.js",
  ".claude/worktrees/agent-ade9a5ca2778a278a/vendor/web-llm/index.js",
  "callback.html",
  "icons/icon-180.png",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "index.html",
  "js/actions.js",
  "js/agent.js",
  "js/app.js",
  "js/calc.js",
  "js/device.js",
  "js/llm-worker.js",
  "js/llm.js",
  "js/net.js",
  "js/ocr.js",
  "js/prune.js",
  "js/sandbox-js-worker.js",
  "js/sandbox-py-worker.js",
  "js/sandbox.js",
  "js/store.js",
  "js/web.js",
  "manifest.webmanifest",
  "shortcuts/manifest.json",
  "styles.css",
  "vendor/pyodide/pyodide-lock.json",
  "vendor/pyodide/pyodide.asm.mjs",
  "vendor/pyodide/pyodide.asm.wasm",
  "vendor/pyodide/pyodide.mjs",
  "vendor/pyodide/python_stdlib.zip",
  "vendor/tesseract/core/tesseract-core-lstm.wasm.js",
  "vendor/tesseract/core/tesseract-core-relaxedsimd-lstm.wasm.js",
  "vendor/tesseract/core/tesseract-core-simd-lstm.wasm.js",
  "vendor/tesseract/lang/eng.traineddata.gz",
  "vendor/tesseract/tesseract.min.js",
  "vendor/tesseract/worker.min.js",
  "vendor/web-llm/index.js"
];

self.addEventListener('install', (e) => {
  // cache: 'reload' bypasses the HTTP cache, so a new version never stores stale files.
  // Each file is fetched as f?v=VERSION: a URL GitHub's CDN has never seen, so a new version can't be filled with the
  // old files the CDN still holds for a few minutes after a deploy (seen on the iPad). Stored under the plain URL.
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all(FILES.map(async (f) => {
    const r = await fetch(new Request(`${f}${f.includes('?') ? '&' : '?'}v=${VERSION}`, { cache: 'reload' }));
    if (!r.ok) throw new Error(`${f}: ${r.status}`);
    await c.put(f, r);
  }))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith('pocket-agent-') && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Big models live on a GitHub branch (served by raw.githubusercontent.com, which school networks allow).
// The page asks for ./models/remote/<model>/resolve/main/<file>; this worker fetches it from there and
// joins files that were split in two to fit GitHub's 100 MB limit.
const REMOTE = {
  'Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC': {
    base: 'https://raw.githubusercontent.com/proteinleogenisis/pocket-agent/models-1.5b/',
    split: { 'params_shard_0.bin': ['params_shard_0.bin.partaa', 'params_shard_0.bin.partab'] },
  },
  'Pocket-Agent-1.5B-q4f16_1-MLC': {
    base: 'https://raw.githubusercontent.com/proteinleogenisis/pocket-agent/models-pa-1.5b/',
    split: { 'params_shard_0.bin': ['params_shard_0.bin.partaa', 'params_shard_0.bin.partab'] },
  },
};
async function remoteFile(id, file) {
  const m = REMOTE[id]; if (!m) return new Response('unknown model', { status: 404 });
  const parts = m.split[file];
  if (!parts) {
    const r = await fetch(m.base + file, { cache: 'no-store' });
    return new Response(r.body, { status: r.status, headers: { 'Content-Type': file.endsWith('.json') ? 'application/json' : 'application/octet-stream', ...(r.headers.get('content-length') && { 'Content-Length': r.headers.get('content-length') }) } });
  }
  const rs = await Promise.all(parts.map((p) => fetch(m.base + p, { cache: 'no-store' })));
  if (rs.some((r) => !r.ok)) return new Response('part missing', { status: 502 });
  const total = rs.reduce((n, r) => n + Number(r.headers.get('content-length') || 0), 0);
  let i = 0, got = 0, reader = rs[0].body.getReader();
  const body = new ReadableStream({
    async pull(ctl) {
      for (;;) {
        const { done, value } = await reader.read();
        if (!done) { got += value.byteLength; ctl.enqueue(value); return; }
        if (++i >= rs.length) {
          // A part that stopped early must fail the download, never be saved as a cut-off model file.
          if (total && got !== total) ctl.error(new Error(`model file cut off (${got} of ${total} bytes)`)); else ctl.close();
          return;
        }
        reader = rs[i].body.getReader();
      }
    },
  });
  return new Response(body, { status: 200, headers: { 'Content-Type': 'application/octet-stream', ...(total && { 'Content-Length': String(total) }) } });
}

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  const rm = url.origin === location.origin && /\/models\/remote\/([^/]+)\/resolve\/main\/(.+)$/.exec(url.pathname);
  if (rm && e.request.method === 'GET') { e.respondWith(remoteFile(decodeURIComponent(rm[1]), decodeURIComponent(rm[2]))); return; }
  if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) return; // dev server: always fresh files
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.includes('/models/')) return; // model files: WebLLM caches them itself
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(e.request, { ignoreSearch: e.request.mode === 'navigate' });
    if (hit) return hit;
    try { return await fetch(e.request); }
    catch { return (e.request.mode === 'navigate' && await cache.match('./')) || Response.error(); }
  })());
});
