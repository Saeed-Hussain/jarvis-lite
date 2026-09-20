/**
 * Runtime setup shared by both model workers.
 *
 * Two things have to be told to transformers.js before it loads anything, and
 * getting either wrong turns "works offline" into "silently needs a CDN":
 *
 *   1. Where the ONNX wasm files are. They ship in public/ort (see
 *      scripts/copy-ort.js) rather than being fetched from jsdelivr.
 *   2. That there are no local *models* to look for — those do come from the
 *      Hugging Face CDN, once, and are then cached by the browser engine.
 */

import { env } from '@huggingface/transformers';

/**
 * Work out where the app's files live, from inside a worker.
 *
 * The worker is served from <root>/workers/<name>.js, so its own URL minus two
 * path segments is the root. Derived at runtime rather than hardcoded because
 * it has to be right under both the dev server (http://localhost:3000) and the
 * packaged app, which loads from a file:// URL.
 */
function appRoot(): string {
  const here = self.location.href;
  const dir = here.slice(0, here.lastIndexOf('/'));
  return dir.slice(0, dir.lastIndexOf('/'));
}

let configured = false;

export function configureRuntime(): void {
  if (configured) return;
  configured = true;

  // Model weights come from the Hugging Face CDN on first use; there is no
  // local model directory to search, and letting it try adds a failed request
  // before every single load.
  env.allowLocalModels = false;

  // Optional all the way down: the runtime only populates `backends.onnx.wasm`
  // once a backend has been selected, and on a build where it is missing the
  // right move is to leave the default (a CDN fetch) rather than throw.
  const wasm = env.backends?.onnx?.wasm;
  if (wasm) wasm.wasmPaths = `${appRoot()}/ort/`;
}
