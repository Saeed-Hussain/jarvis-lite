/**
 * Recorded workflows on disk.
 *
 * A workflow is the whole point of Pilot's first phase: do a task once while
 * Pilot watches, and from then on it replays without any model in the loop -
 * deterministic, fast, and free. They are stored separately from Jarvis's
 * memory.json because they are bigger (each step can carry a thumbnail) and
 * because losing a contact list and losing an afternoon of recorded work are
 * different sizes of accident.
 */

const fs = require('fs');
const path = require('path');
const { app } = require('electron');

function filePath() {
  return path.join(app.getPath('userData'), 'pilot', 'workflows.json');
}

function readAll() {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath(), 'utf-8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(workflows) {
  try {
    fs.mkdirSync(path.dirname(filePath()), { recursive: true });
    const tmp = `${filePath()}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(workflows, null, 2));
    fs.renameSync(tmp, filePath());
    return true;
  } catch (err) {
    console.error('Failed to save workflows:', err);
    return false;
  }
}

const slug = (name) =>
  String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'workflow';

/** Save a workflow, replacing any existing one with the same id. */
function save(workflow) {
  if (!workflow || !workflow.name) return { success: false, message: 'A workflow needs a name.' };

  const workflows = readAll();
  const id = workflow.id || slug(workflow.name);
  const record = {
    ...workflow,
    id,
    savedAt: Date.now(),
    runCount: workflow.runCount ?? 0,
  };

  const index = workflows.findIndex((w) => w.id === id);
  if (index >= 0) workflows[index] = record;
  else workflows.push(record);

  if (!writeAll(workflows)) return { success: false, message: 'Could not write the workflow to disk.' };
  return { success: true, message: `Saved "${record.name}" (${record.steps?.length ?? 0} steps).`, workflow: record };
}

function remove(id) {
  const workflows = readAll();
  const next = workflows.filter((w) => w.id !== id);
  if (next.length === workflows.length) return { success: false, message: 'No workflow with that id.' };
  if (!writeAll(next)) return { success: false, message: 'Could not update the workflow file.' };
  return { success: true, message: 'Deleted.' };
}

/** Find by id, then by exact name, then by a loose slug match. */
function find(nameOrId) {
  const needle = String(nameOrId || '').trim().toLowerCase();
  if (!needle) return null;
  const workflows = readAll();
  return (
    workflows.find((w) => w.id.toLowerCase() === needle) ||
    workflows.find((w) => String(w.name).toLowerCase() === needle) ||
    workflows.find((w) => w.id === slug(needle)) ||
    null
  );
}

/** Bump the run counter and record how the last run went. */
function recordRun(id, { success, ms, steps }) {
  const workflows = readAll();
  const workflow = workflows.find((w) => w.id === id);
  if (!workflow) return;
  workflow.runCount = (workflow.runCount ?? 0) + 1;
  workflow.lastRun = { at: Date.now(), success, ms, steps };
  writeAll(workflows);
}

module.exports = { readAll, save, remove, find, recordRun, slug };
