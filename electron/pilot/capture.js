/**
 * Cheap screen capture.
 *
 * Pilot does not need to look at pixels to decide what to click - that comes
 * from the accessibility tree. What it needs pixels for is much smaller:
 *   1. "did the screen change after I clicked?"  (recovery)
 *   2. "has it stopped changing yet?"            (waiting)
 *   3. a small visual fingerprint of a target    (recording)
 *
 * All three are answered by a perceptual hash of a heavily downscaled frame,
 * so the default capture path never encodes a full-resolution image. A full
 * frame is taken only when explicitly asked for, which happens once per
 * recorded step rather than once per tick.
 */

const { desktopCapturer, screen } = require('electron');

/** Downscale used for change detection. Small on purpose - see above. */
const PROBE_WIDTH = 320;

/** Two frames within this Hamming distance are "the same screen". */
const SAME_SCREEN_THRESHOLD = 3;

/**
 * 64-bit average hash: shrink to 8x8, grey it, and set one bit per pixel for
 * "brighter than the mean". Robust to compression and a cursor moving, which
 * is exactly what a raw byte comparison is not.
 */
function averageHash(image) {
  const small = image.resize({ width: 8, height: 8, quality: 'good' });
  const bitmap = small.toBitmap(); // BGRA, 8 * 8 * 4 bytes
  if (bitmap.length < 256) return '0000000000000000';

  const grey = new Array(64);
  let total = 0;
  for (let i = 0; i < 64; i++) {
    const o = i * 4;
    // Rec. 601 luma. The buffer is BGRA, not RGBA.
    const value = (bitmap[o + 2] * 299 + bitmap[o + 1] * 587 + bitmap[o] * 114) / 1000;
    grey[i] = value;
    total += value;
  }
  const mean = total / 64;

  let hex = '';
  for (let nibble = 0; nibble < 16; nibble++) {
    let bits = 0;
    for (let bit = 0; bit < 4; bit++) {
      if (grey[nibble * 4 + bit] > mean) bits |= 1 << (3 - bit);
    }
    hex += bits.toString(16);
  }
  return hex;
}

/** Bit difference between two average hashes; 0 means identical. */
function distance(a, b) {
  if (!a || !b || a.length !== b.length) return 64;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    let x = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    while (x) {
      diff += x & 1;
      x >>= 1;
    }
  }
  return diff;
}

const changed = (a, b) => distance(a, b) > SAME_SCREEN_THRESHOLD;

/**
 * Grab the primary screen.
 *
 * `full: true` also returns a PNG data URL at capture resolution - used when
 * recording a step, so the workflow carries a picture of what the user
 * actually clicked. Everything else takes the thumbnail-only path.
 */
async function grab({ full = false } = {}) {
  const started = Date.now();
  const display = screen.getPrimaryDisplay();
  const { width, height } = display.size;
  const scale = display.scaleFactor || 1;

  const thumbnailSize = full
    ? { width: Math.round(width * scale), height: Math.round(height * scale) }
    : { width: PROBE_WIDTH, height: Math.max(1, Math.round((height / width) * PROBE_WIDTH)) };

  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize,
    fetchWindowIcons: false,
  });

  const source = sources.find((s) => String(s.display_id) === String(display.id)) || sources[0];
  if (!source || source.thumbnail.isEmpty()) {
    return { ok: false, error: 'Screen capture returned nothing. Check the screen-recording permission.' };
  }

  return {
    ok: true,
    data: {
      hash: averageHash(source.thumbnail),
      width,
      height,
      scale,
      ms: Date.now() - started,
      image: full ? source.thumbnail.toDataURL() : undefined,
    },
  };
}

/**
 * Wait until the screen stops changing.
 *
 * Returns as soon as two consecutive probes match, so a UI that settles in
 * 150ms costs 150ms rather than a fixed sleep. `changedFrom` reports whether
 * the settled screen differs from where it started, which is how the runner
 * tells "the click did something" from "the click did nothing at all".
 */
async function settle({ baseline, timeoutMs = 4000, intervalMs = 120 } = {}) {
  const started = Date.now();
  let previous = null;

  while (Date.now() - started < timeoutMs) {
    const frame = await grab();
    if (!frame.ok) return frame;
    const hash = frame.data.hash;

    if (previous && !changed(previous, hash)) {
      return {
        ok: true,
        data: {
          hash,
          ms: Date.now() - started,
          changedFrom: baseline ? changed(baseline, hash) : true,
          settled: true,
        },
      };
    }
    previous = hash;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  return {
    ok: true,
    data: {
      hash: previous,
      ms: Date.now() - started,
      changedFrom: baseline ? changed(baseline, previous) : true,
      // Still moving when the budget ran out - an animation, a video, a
      // spinner. The caller decides whether that is a problem.
      settled: false,
    },
  };
}

module.exports = { grab, settle, averageHash, distance, changed, SAME_SCREEN_THRESHOLD };
