// Cache pruning tests. Run: node tests/prune.test.mjs
import assert from 'node:assert/strict';
import { pruneCaches } from '../js/prune.js';

let pass = 0; const fails = [];
const test = async (name, fn) => { try { await fn(); pass++; } catch (e) { fails.push(`${name}\n    ${e.message}`); } };

const BASE = 'https://proteinleogenisis.github.io/pocket-agent/';
const own = `${BASE}models/Pocket-Agent-0.5B-q4f16_1-MLC/resolve/main/`;
const remote = `${BASE}models/remote/Pocket-Agent-1.5B-q4f16_1-MLC/resolve/main/`;
const hf = 'https://huggingface.co/mlc-ai/Llama-3.2-1B-Instruct-q4f16_1-MLC/resolve/main/';
const oldRemote = `${BASE}models/remote/Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC/resolve/main/`;
const oldGone = `${BASE}models/remote/Qwen2.5-Coder-0.5B-Instruct-q4f16_1-MLC/resolve/main/`;
const list = [
  { model_id: 'Pocket-Agent-0.5B-q4f16_1-MLC', model: own, model_lib: `${BASE}models/lib/a.wasm` },
  { model_id: 'Pocket-Agent-1.5B-q4f16_1-MLC', model: remote, model_lib: `${BASE}models/lib/b.wasm` },
  { model_id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC', model: hf, model_lib: 'https://raw.githubusercontent.com/x/y/lib/c.wasm' },
  { model_id: 'Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC', model: oldRemote, model_lib: `${BASE}models/lib/d.wasm` },
];
const keep = ['Pocket-Agent-0.5B-q4f16_1-MLC', 'Pocket-Agent-1.5B-q4f16_1-MLC', 'Llama-3.2-1B-Instruct-q4f16_1-MLC'];

function fakeCaches(data) {
  const m = new Map(Object.entries(data).map(([k, urls]) => [k, new Set(urls)]));
  return {
    m,
    async open(name) {
      if (!m.has(name)) m.set(name, new Set());
      const set = m.get(name);
      return { async keys() { return [...set].map((url) => ({ url })); }, async delete(r) { return set.delete(r.url); } };
    },
  };
}
const unknown = 'https://example.com/something/else.bin';
const c = fakeCaches({
  'webllm/model': [own + 'a.bin', remote + 'b.bin', hf + 'c.bin', oldRemote + 'd.bin', oldGone + 'e.bin', unknown],
  'webllm/config': [own + 'mlc-chat-config.json', oldGone + 'mlc-chat-config.json', oldRemote + 'tokenizer.json'],
  'webllm/wasm': [`${BASE}models/lib/a.wasm`, `${BASE}models/lib/b.wasm`, 'https://raw.githubusercontent.com/x/y/lib/c.wasm', `${BASE}models/lib/d.wasm`, `${BASE}models/lib/zzz.wasm`],
});

const res = await pruneCaches(c, list, keep, BASE);
const model = c.m.get('webllm/model'), config = c.m.get('webllm/config'), wasm = c.m.get('webllm/wasm');

await test('keeps own, remote and huggingface files', () => {
  for (const u of [own + 'a.bin', remote + 'b.bin', hf + 'c.bin']) assert.ok(model.has(u), u);
  assert.ok(config.has(own + 'mlc-chat-config.json'));
});
await test('deletes old model still in list', () => {
  assert.ok(!model.has(oldRemote + 'd.bin'));
  assert.ok(!config.has(oldRemote + 'tokenizer.json'));
});
await test('deletes old model absent from list via path pattern', () => {
  assert.ok(!model.has(oldGone + 'e.bin'));
  assert.ok(!config.has(oldGone + 'mlc-chat-config.json'));
});
await test('never deletes unrecognized URL', () => assert.ok(model.has(unknown)));
await test('wasm pruning keeps kept libs, deletes others', () => {
  assert.deepEqual([...wasm].sort(), [`${BASE}models/lib/a.wasm`, `${BASE}models/lib/b.wasm`, 'https://raw.githubusercontent.com/x/y/lib/c.wasm'].sort());
});
await test('returns deleted count', () => assert.equal(res.deleted, 2 + 2 + 2));
await test('no caches or throwing caches -> deleted 0', async () => {
  assert.deepEqual(await pruneCaches(undefined, list, keep, BASE), { deleted: 0 });
  assert.deepEqual(await pruneCaches({ open() { throw new Error('x'); } }, list, keep, BASE), { deleted: 0 });
});

if (fails.length) { console.error(`FAIL ${fails.length}\n` + fails.join('\n')); process.exit(1); }
console.log(`prune tests: ${pass} passed`);
