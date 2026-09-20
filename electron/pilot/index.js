/**
 * Pilot's privileged surface.
 *
 * The renderer decides *what* to do (lib/pilot/runner.ts); this file is the
 * only place that can actually do it. Every action goes through the same
 * three gates, in this order:
 *
 *   1. the stop flag        - a hard stop wins over anything in flight
 *   2. the guard            - judged against the REAL foreground window,
 *                             read here rather than trusted from the renderer
 *   3. the action itself
 *
 * Reading the window for the guard costs one host round trip per action. That
 * is the price of a safety check the renderer cannot talk its way past, and it
 * is worth paying.
 */

const { ipcMain, globalShortcut } = require('electron');

const bridge = require('./bridge');
const capture = require('./capture');
const guard = require('./guard');
const journal = require('./journal');
const workflows = require('./workflows');

/**
 * A hard stop, deliberately held in the main process.
 *
 * Pilot owns the mouse while it runs, so the user may not be able to reach the
 * on-screen stop button - which is exactly why there is a global shortcut, and
 * why the flag lives here rather than in renderer state that a wedged window
 * could fail to update.
 */
const stopState = { stopped: false, at: 0, source: null };
let notify = null;
let stopShortcut = null;

function stop(source = 'user') {
  stopState.stopped = true;
  stopState.at = Date.now();
  stopState.source = source;
  notify?.('pilot:stopped', { source, at: stopState.at });
  return { success: true, message: 'Stopped.' };
}

function clearStop() {
  stopState.stopped = false;
  stopState.at = 0;
  stopState.source = null;
  return { success: true, message: 'Ready.' };
}

const stopped = () => ({
  success: false,
  message: `Stopped${stopState.source === 'shortcut' ? ' by the stop shortcut' : ''}. Nothing further was done.`,
  halted: true,
});

/**
 * Current foreground window, as plain values the guard can read.
 * The rectangle rides along because the grounder scores candidates relative to
 * the window, and asking for it separately would double the round trips.
 */
async function context() {
  const info = await bridge.foreground();
  if (!info.ok) return { windowTitle: '', processName: '', handle: 0, x: 0, y: 0, w: 0, h: 0 };
  return {
    windowTitle: info.data.title || '',
    processName: info.data.process || '',
    handle: info.data.handle || 0,
    x: info.data.x ?? 0,
    y: info.data.y ?? 0,
    w: info.data.w ?? 0,
    h: info.data.h ?? 0,
  };
}

// ---------------------------------------------------------------------------
// The one guarded entry point for doing something
// ---------------------------------------------------------------------------

/**
 * @param action { type, x?, y?, button?, double?, text?, keys?, amount?,
 *                 targetName?, path?, to?, content?, runId? }
 * @param opts   { approved?: boolean }  - a 'confirm' verdict the user accepted
 */
async function act(action = {}, opts = {}) {
  if (stopState.stopped) return stopped();

  const where = await context();
  const verdict = guard.judge(action, where);

  if (verdict.verdict === 'block') {
    return { success: false, message: verdict.reason, blocked: true, verdict: 'block' };
  }
  if (verdict.verdict === 'confirm' && !opts.approved) {
    return {
      success: false,
      message: verdict.reason,
      needsApproval: true,
      verdict: 'confirm',
      question: `${verdict.reason} Go ahead?`,
    };
  }

  // The stop flag is re-read after the guard: reading the window is a round
  // trip, and a stop pressed during it must still take effect.
  if (stopState.stopped) return stopped();

  const started = Date.now();
  let res;

  switch (action.type) {
    case 'click':
      res = await bridge.click(action.x, action.y, action.button || 'left', !!action.double);
      break;
    case 'type':
      res = await bridge.typeText(String(action.text ?? ''), action.chunkDelayMs || 0);
      break;
    case 'key':
      res = await bridge.pressKeys(String(action.keys ?? ''));
      break;
    case 'scroll':
      res = await bridge.scroll(typeof action.amount === 'number' ? action.amount : -3);
      break;
    case 'focus':
      res = await bridge.focusWindow(action.handle);
      break;
    case 'write_file':
      res = { ok: true, data: journal.writeFile(action.path, action.content ?? '', action.runId) };
      break;
    case 'move_file':
      res = { ok: true, data: journal.moveFile(action.path, action.to, action.runId) };
      break;
    case 'delete_file':
      res = { ok: true, data: journal.deleteFile(action.path, action.runId) };
      break;
    default:
      return { success: false, message: `Pilot has no "${action.type}" action.` };
  }

  const ms = Date.now() - started;

  // File operations come back as an ActionResult already; host calls do not.
  if (res.ok && res.data && typeof res.data.success === 'boolean') {
    return { ...res.data, ms, verdict: verdict.verdict, window: where.windowTitle };
  }
  return res.ok
    ? { success: true, message: 'done', ms, data: res.data, verdict: verdict.verdict, window: where.windowTitle }
    : { success: false, message: res.error, ms };
}

// ---------------------------------------------------------------------------
// IPC
// ---------------------------------------------------------------------------

function registerPilotHandlers(sendToRenderer) {
  notify = sendToRenderer;

  ipcMain.handle('pilot:available', async () => {
    if (!bridge.available) {
      return {
        available: false,
        stopShortcut,
        reason: `Pilot drives the screen through Windows UI Automation; this is ${process.platform}.`,
      };
    }
    const res = await bridge.ping();
    return res.ok
      ? { available: true, stopShortcut, reason: '' }
      : { available: false, stopShortcut, reason: res.error };
  });

  ipcMain.handle('pilot:foreground', () => context());

  ipcMain.handle('pilot:tree', async (_e, { handle = 0, maxNodes = 400 } = {}) => {
    if (stopState.stopped) return { ok: false, error: 'Stopped.' };
    return bridge.readTree(handle, maxNodes);
  });

  ipcMain.handle('pilot:windows', () => bridge.listWindows());
  ipcMain.handle('pilot:element-at', (_e, { x, y } = {}) => bridge.elementAt(x, y));

  // Recording only ever drains mouse events. See the note in host.ps1 about
  // why the keyboard is left alone.
  //
  // Clicks on Jarvis's own window are dropped here rather than in the
  // renderer: pressing "stop recording" is not a step of the workflow, and
  // filtering by pid is the one test the user cannot accidentally defeat by
  // renaming a window.
  ipcMain.handle('pilot:poll-input', async () => {
    const res = await bridge.pollInput();
    if (!res.ok) return res;
    const events = res.data.events.filter((e) => !e.window || e.window.pid !== process.pid);
    return { ok: true, data: { events } };
  });

  ipcMain.handle('pilot:act', (_e, action, opts) => act(action || {}, opts || {}));

  ipcMain.handle('pilot:capture', (_e, opts) => capture.grab(opts || {}));
  ipcMain.handle('pilot:settle', (_e, opts) => capture.settle(opts || {}));

  ipcMain.handle('pilot:review', async (_e, steps) => {
    const where = await context();
    return { context: where, verdicts: guard.review(steps || [], where) };
  });

  ipcMain.handle('pilot:stop', () => stop('user'));
  ipcMain.handle('pilot:clear-stop', () => clearStop());
  ipcMain.handle('pilot:stop-state', () => ({ ...stopState }));

  ipcMain.handle('pilot:workflows', () => workflows.readAll());
  ipcMain.handle('pilot:save-workflow', (_e, workflow) => workflows.save(workflow));
  ipcMain.handle('pilot:delete-workflow', (_e, id) => workflows.remove(id));
  ipcMain.handle('pilot:find-workflow', (_e, nameOrId) => workflows.find(nameOrId));
  ipcMain.handle('pilot:record-run', (_e, id, summary) => {
    workflows.recordRun(id, summary || {});
    return true;
  });

  ipcMain.handle('pilot:journal', (_e, limit) => journal.list(limit || 50));
  ipcMain.handle('pilot:undo', (_e, entryId) => journal.undo(entryId));
  ipcMain.handle('pilot:undo-run', (_e, runId) => journal.undoRun(runId));

  // The only control the user is guaranteed to reach while Pilot holds the
  // mouse. Registration can fail if another app already owns the combination,
  // in which case the on-screen button is the fallback and we say so.
  const registered = globalShortcut.register('CommandOrControl+Alt+X', () => stop('shortcut'));
  stopShortcut = registered ? 'Ctrl+Alt+X' : null;
  if (!registered) {
    console.warn('Pilot: Ctrl+Alt+X is taken — the stop shortcut is unavailable.');
  }
  return { stopShortcut };
}

function shutdownPilot() {
  globalShortcut.unregister('CommandOrControl+Alt+X');
  bridge.shutdown();
}

module.exports = { registerPilotHandlers, shutdownPilot };
