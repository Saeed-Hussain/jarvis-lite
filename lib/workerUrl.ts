/**
 * Where the prebuilt model workers live.
 *
 * They are plain files in public/workers (built by scripts/build-workers.js),
 * not webpack chunks — see that script for why. That means resolving their URL
 * by hand, and doing it in a way that works both under the dev server and
 * under the file:// URL the packaged app loads from.
 */

/** Directory the app's own page is in, with a trailing slash. */
function appBase(): string {
  const href = window.location.href.split('#')[0].split('?')[0];
  return href.slice(0, href.lastIndexOf('/') + 1);
}

/**
 * A module worker, loaded from the app's own files.
 * `type: 'module'` is required: these bundles are ES modules, which is the
 * whole reason they are built separately.
 */
export function createWorker(name: 'brain.js' | 'voice.js'): Worker {
  return new Worker(new URL(`workers/${name}`, appBase()), { type: 'module' });
}
