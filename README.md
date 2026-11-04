# Pocket Agent

A private coding assistant that runs entirely in Safari on an iPad. No account, no API key, no subscription.

- **Model:** open-weight Qwen2.5-Coder (0.5B / 1.5B), Llama 3.2 1B or Qwen3 0.6B, run on the iPad's GPU through [WebLLM](https://github.com/mlc-ai/web-llm) (WebGPU). It downloads once from Hugging Face, then runs offline.
- **Screen awareness:** paste or attach a screenshot. Text is read on-device with Tesseract OCR. The image is discarded right after reading, and the text stays in memory only.
- **Tools:** calculator (safe parser, no `eval`), JavaScript and Python (Pyodide) sandboxes with no network access, a write → run → auto-fix loop, text transforms, notes, macros, a file workspace (import, save, run, export to Files), clipboard, and other apps: open apps/websites, pre-filled email and messages, Maps, and Apple Shortcuts with text input.
- **Freedom levels:** Careful / Balanced / Free decide what runs without asking. Deleting always asks; emails and messages always open for you to send.
- **Safety:** slash commands are parsed deterministically. Tool calls the model picks use grammar-constrained JSON and are validated in code. Running code, Shortcuts and deletions ask for confirmation. Screen text is fenced as untrusted data.

## Device control (Settings → Device control)
iPadOS lets apps change settings or act in other apps only through Shortcuts. `tools/make_shortcuts.py` builds 13 tiny signed
“PA …” Shortcuts (brightness, volume, play/pause, next track, timer, reminder, calendar event, speak, battery, Wi-Fi and
Bluetooth on/off). Pocket Agent runs them with `shortcuts://run-shortcut?name=…&input=text&text=…`. Multi-step requests
(“set brightness to 30% and play music”) run one app switch at a time and continue when you return.

## Internet (optional, Settings → Internet)
Web search with cited answers (Wikipedia, DuckDuckGo Instant Answers, Hacker News, Stack Overflow — official APIs only, no scraping of search pages), reading a page you link (r.jina.ai), weather (Open-Meteo), exchange rates (Frankfurter), definitions (Wiktionary), npm/PyPI versions. Questions about current events go online automatically.

## Privacy
Hosting serves the static files only. Screenshots, OCR text, attached files, notes and chats never leave the device. When Internet is on, only the words of the request (query, place, word, or the URL you gave) are sent, with no cookies or referrer, and each answer lists the services it used.

## Development
```
python3 tools/serve.py 8765        # no-cache dev server → http://localhost:8765
open http://localhost:8765/tests/  # 61 in-browser unit tests (some call live APIs)
python3 tools/build.py             # syntax-check modules + regenerate sw.js (run before every deploy)
```
`?bench=<model-id>&ctx=2048` loads a model and runs the benchmark. Add `&tasks=1` to run the
end-to-end task suite (37 plain-English tasks whose results are verified; confirmations auto-accepted in this mode only).
