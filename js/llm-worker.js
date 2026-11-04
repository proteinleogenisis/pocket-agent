// Runs the model off the main thread so the UI stays responsive during inference.
import { WebWorkerMLCEngineHandler } from '../vendor/web-llm/index.js';

const handler = new WebWorkerMLCEngineHandler();
self.onmessage = (msg) => handler.onmessage(msg);
