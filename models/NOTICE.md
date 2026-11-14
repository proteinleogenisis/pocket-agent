Mirrored model files, so the app can download its default model from the same site that serves it (some networks block huggingface.co).

- `Pocket-Agent-0.5B-q4f16_1-MLC/`: https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct (Apache-2.0, Qwen team), fine-tuned
  with LoRA for homework answers by this project (tools/train/) and converted to q4f16_1 by tools/train/to_mlc.py.
- `Qwen3-0.6B-q4f16_1-MLC/`: from https://huggingface.co/mlc-ai/Qwen3-0.6B-q4f16_1-MLC,
  converted from https://huggingface.co/Qwen/Qwen3-0.6B. Licensed Apache-2.0 by the Qwen team.
- `lib/Qwen3-0.6B-q4f16_1_cs1k-webgpu.wasm` and `lib/Qwen2-0.5B-Instruct-q4f16_1_cs1k-webgpu.wasm`: WebGPU model library from https://github.com/mlc-ai/binary-mlc-llm-libs (Apache-2.0).
