/**
 * Copy the ONNX runtime's wasm files into public/ort.
 *
 * transformers.js fetches these at runtime. Left to itself it pulls them from
 * a CDN, which would mean Jarvis needs the internet every time it thinks —
 * exactly the thing this app is built not to need. Serving them from the app's
 * own files keeps the promise: one download for the model weights, and after
 * that the whole thing works with the network unplugged.
 *
 * Runs before dev and before build, and is cheap enough to do every time.
 */

const fs = require('fs');
const path = require('path');

const source = path.join(__dirname, '..', 'node_modules', 'onnxruntime-web', 'dist');
const target = path.join(__dirname, '..', 'public', 'ort');

/**
 * Only the wasm binaries and their sibling loaders.
 *
 * The `ort.*.mjs` entry points in dist/ are the library itself, and esbuild
 * has already bundled that into the worker. These four files are the only
 * things fetched at runtime — copying the rest adds ~17MB to the installer
 * for files nothing ever asks for.
 */
const WANTED = /^ort-wasm-.*\.(?:wasm|mjs)$/;

function main() {
  if (!fs.existsSync(source)) {
    console.warn('[copy-ort] onnxruntime-web is not installed — skipping.');
    return;
  }

  fs.mkdirSync(target, { recursive: true });

  // Drop anything a previous run left behind that is no longer wanted -
  // otherwise tightening the filter above never actually reclaims the space.
  for (const name of fs.readdirSync(target)) {
    if (!WANTED.test(name)) fs.rmSync(path.join(target, name), { force: true });
  }

  let copied = 0;
  let skipped = 0;
  for (const name of fs.readdirSync(source)) {
    if (!WANTED.test(name)) continue;

    const from = path.join(source, name);
    const to = path.join(target, name);

    // Skip files that are already identical in size: these are tens of
    // megabytes in total and re-copying them on every dev restart is a
    // noticeable pause for no benefit.
    try {
      if (fs.existsSync(to) && fs.statSync(to).size === fs.statSync(from).size) {
        skipped++;
        continue;
      }
    } catch {
      /* fall through and copy it */
    }

    fs.copyFileSync(from, to);
    copied++;
  }

  console.log(`[copy-ort] ${copied} copied, ${skipped} already current -> public/ort`);
}

main();
