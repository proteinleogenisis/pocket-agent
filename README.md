# Pocket Agent

A private coding assistant that runs entirely in Safari on an iPad. No account, no API key, no subscription.

- **Model:** open-weight Qwen2.5-Coder (0.5B / 1.5B), Llama 3.2 1B or Qwen3 0.6B, run on the iPad's GPU through [WebLLM](https://github.com/mlc-ai/web-llm) (WebGPU). It downloads once from Hugging Face, then runs offline.
- **Screen awareness:** paste or attach a screenshot. Text is read on-device with Tesseract OCR. The image is discarded right after reading, and the text stays in memory only.
- **Tools:** calculator (safe parser, no `eval`), JavaScript and Python (Pyodide) sandboxes with no network access, text transforms, notes, macros, and Apple Shortcuts via `shortcuts://`.
- **Safety:** slash commands are parsed deterministically. Tool calls the model picks use grammar-constrained JSON and are validated in code. Running code, Shortcuts and deletions ask for confirmation. Screen text is fenced as untrusted data.

## Privacy
Hosting serves the static files only. Prompts, screenshots, OCR text, notes and chats never leave the device. The only network requests are the one-time download of the app and the model weights (huggingface.co / raw.githubusercontent.com).

## Development
```
python3 -m http.server 8765        # then open http://localhost:8765
open http://localhost:8765/tests/  # 30 in-browser tests
python3 tools/build.py             # regenerate sw.js after changing files
```
`?bench=<model-id>&ctx=2048` loads a model and runs the benchmark.
