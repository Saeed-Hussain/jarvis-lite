/**
 * Node side of the Pilot host.
 *
 * Owns one long-lived powershell.exe running host.ps1 and speaks a
 * newline-delimited JSON protocol to it. Requests are correlated by id, so
 * several in-flight calls cannot be confused for one another, and every call
 * has a deadline - a wedged UI Automation read must not hang the agent loop.
 *
 * The host is started lazily on the first Pilot action and reused after that.
 * If it dies (a crash, a user killing it) the next call transparently starts a
 * new one; a request that was in flight at that moment fails with a real
 * message instead of hanging forever.
 */

const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

/** Calls that read the screen get longer than calls that press a key. */
const DEFAULT_TIMEOUT_MS = 8000;
const TREE_TIMEOUT_MS = 15000;
const START_TIMEOUT_MS = 20000;

let host = null;
let nextId = 1;

/**
 * Locate host.ps1 both in development and inside a packaged build.
 * PowerShell cannot read a file out of app.asar, so the packaged copy lives in
 * app.asar.unpacked (see the asarUnpack entry in package.json).
 */
function scriptPath() {
  const direct = path.join(__dirname, 'host.ps1');
  if (fs.existsSync(direct)) return direct;
  const unpacked = direct.replace(`app.asar${path.sep}`, `app.asar.unpacked${path.sep}`);
  if (fs.existsSync(unpacked)) return unpacked;
  return direct;
}

function unsupported() {
  return {
    ok: false,
    error:
      process.platform === 'win32'
        ? 'The Pilot host could not start.'
        : `Pilot's screen control is Windows-only for now (this is ${process.platform}).`,
  };
}

/** Reject everything still waiting on a host, with a reason. */
function drain(state, reason) {
  const waiting = state.pending;
  state.pending = new Map();
  for (const entry of waiting.values()) {
    clearTimeout(entry.timer);
    entry.resolve({ ok: false, error: reason });
  }
}

function killHost(reason) {
  if (!host) return;
  const dying = host;
  host = null;
  drain(dying, reason);
  try {
    dying.child.kill();
  } catch {
    /* already gone */
  }
}

function startHost() {
  const child = spawn(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', scriptPath()],
    { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'], shell: false },
  );

  const state = {
    child,
    pending: new Map(),
    buffer: '',
    stderr: '',
    ready: null,
    resolveReady: null,
  };
  state.ready = new Promise((resolve) => {
    state.resolveReady = resolve;
  });

  child.stdout.setEncoding('utf-8');
  child.stdout.on('data', (chunk) => {
    state.buffer += chunk;
    let index;
    while ((index = state.buffer.indexOf('\n')) >= 0) {
      const line = state.buffer.slice(0, index).trim();
      state.buffer = state.buffer.slice(index + 1);
      if (!line) continue;

      let message;
      try {
        message = JSON.parse(line);
      } catch {
        // Anything the host printed that is not a response - a warning, a
        // stray banner - is noise, not a protocol error.
        continue;
      }

      // id 0 is the one-shot "I am up" line sent before the request loop.
      if (message.id === 0) {
        state.resolveReady?.(true);
        continue;
      }

      const entry = state.pending.get(message.id);
      if (!entry) continue;
      state.pending.delete(message.id);
      clearTimeout(entry.timer);
      entry.resolve(
        message.ok ? { ok: true, data: message.data } : { ok: false, error: message.error || 'failed' },
      );
    }
  });

  child.stderr.setEncoding('utf-8');
  child.stderr.on('data', (chunk) => {
    // Keep only the tail: a PowerShell type-load failure prints a wall of text
    // and only the first line of it tells the user anything.
    state.stderr = `${state.stderr}${chunk}`.slice(-2000);
  });

  const die = (reason) => {
    if (host === state) host = null;
    drain(state, reason);
    state.resolveReady?.(false);
  };

  child.on('error', (err) => die(`Pilot host failed to start: ${err.message}`));
  child.on('exit', (code) => {
    const detail = state.stderr.trim().split('\n')[0] || `exit code ${code}`;
    die(`Pilot host stopped (${detail}).`);
  });

  host = state;
  return state;
}

async function ensureHost() {
  if (process.platform !== 'win32') return null;
  if (host && !host.child.killed) return host;

  const state = startHost();
  const ready = await Promise.race([
    state.ready,
    new Promise((resolve) => setTimeout(() => resolve(false), START_TIMEOUT_MS)),
  ]);
  if (!ready) {
    killHost('Pilot host did not report ready.');
    return null;
  }
  return state;
}

/**
 * Send one request and wait for its reply.
 * Always resolves - never rejects - so callers can treat a Pilot failure like
 * any other ActionResult instead of wrapping every step in try/catch.
 */
async function call(op, params = {}, timeoutMs) {
  const state = await ensureHost();
  if (!state) return unsupported();

  const id = nextId++;
  const budget = timeoutMs ?? (op === 'tree' ? TREE_TIMEOUT_MS : DEFAULT_TIMEOUT_MS);

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      state.pending.delete(id);
      // A timed-out host is in an unknown state - a half-read UI tree, a
      // pending SendKeys - so it is replaced rather than reused. The identity
      // check matters: a late timeout must not kill a host that has already
      // been restarted since.
      if (host === state) killHost(`Pilot host timed out after ${budget}ms on "${op}".`);
      resolve({ ok: false, error: `"${op}" took longer than ${budget}ms and was abandoned.` });
    }, budget);

    state.pending.set(id, { resolve, timer });

    try {
      state.child.stdin.write(`${JSON.stringify({ id, op, ...params })}\n`);
    } catch (err) {
      state.pending.delete(id);
      clearTimeout(timer);
      resolve({ ok: false, error: `Could not reach the Pilot host: ${err.message}` });
    }
  });
}

// ---------------------------------------------------------------------------
// Typed wrappers
// ---------------------------------------------------------------------------

/**
 * Read the accessibility tree of a window (0 = whatever is in front).
 *
 * PowerShell's ConvertTo-Json collapses a one-element array into a bare
 * object, so a window with a single addressable control would otherwise come
 * back as something the renderer cannot map over.
 */
async function readTree(handle = 0, maxNodes = 400) {
  const started = Date.now();
  const res = await call('tree', { handle, maxNodes });
  if (!res.ok) return res;
  const data = res.data || {};
  const elements = Array.isArray(data.elements) ? data.elements : data.elements ? [data.elements] : [];
  return { ok: true, data: { ...data, elements, ms: Date.now() - started } };
}

/** Top-level windows with a title, for "focus the Notepad window". */
async function listWindows() {
  const res = await call('windows');
  if (!res.ok) return res;
  const windows = Array.isArray(res.data?.windows)
    ? res.data.windows
    : res.data?.windows
      ? [res.data.windows]
      : [];
  return { ok: true, data: { windows } };
}

/**
 * Drain the clicks the user has made since the last poll.
 * Same single-element-array caveat as readTree.
 */
async function pollInput() {
  const res = await call('poll', {}, 4000);
  if (!res.ok) return res;
  const events = Array.isArray(res.data?.events) ? res.data.events : res.data?.events ? [res.data.events] : [];
  return { ok: true, data: { events } };
}

const elementAt = (x, y) => call('at', { x, y });
const foreground = () => call('foreground');
const windowInfo = (handle) => call('window', { handle });
const focusWindow = (handle) => call('focus', { handle });
const click = (x, y, button = 'left', double = false) => call('click', { x, y, button, double });
const typeText = (text, chunkDelayMs = 0) => call('type', { text, chunkDelayMs }, 30000);
const pressKeys = (keys) => call('key', { keys });
const scroll = (amount) => call('scroll', { amount });
const cursor = () => call('cursor');
const ping = () => call('ping', {}, 4000);

function shutdown() {
  killHost('Pilot host shut down.');
}

module.exports = {
  available: process.platform === 'win32',
  readTree,
  listWindows,
  pollInput,
  elementAt,
  foreground,
  windowInfo,
  focusWindow,
  click,
  typeText,
  pressKeys,
  scroll,
  cursor,
  ping,
  shutdown,
};
