/**
 * The undo journal.
 *
 * Any file a workflow touches is backed up first and the operation is written
 * down, so "undo the last run" is a real operation rather than an apology.
 *
 * A delete never deletes: the file is moved into the journal's backup store
 * and the entry remembers where it came from. Undo puts it back.
 *
 * The journal is append-only and survives restarts. Entries are pruned by
 * count, oldest first, and pruning removes the backing files with them.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { app } = require('electron');

const MAX_ENTRIES = 200;

function root() {
  return path.join(app.getPath('userData'), 'pilot');
}
const journalPath = () => path.join(root(), 'journal.json');
const backupDir = () => path.join(root(), 'backups');

function ensureDirs() {
  fs.mkdirSync(backupDir(), { recursive: true });
}

function read() {
  try {
    return JSON.parse(fs.readFileSync(journalPath(), 'utf-8'));
  } catch {
    return [];
  }
}

function write(entries) {
  ensureDirs();
  // Temp-then-rename, so a crash mid-write cannot leave the journal
  // unparseable and take the undo history with it.
  const tmp = `${journalPath()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(entries, null, 2));
  fs.renameSync(tmp, journalPath());
}

function prune(entries) {
  if (entries.length <= MAX_ENTRIES) return entries;
  const dropped = entries.slice(0, entries.length - MAX_ENTRIES);
  for (const entry of dropped) {
    if (!entry.backup) continue;
    try {
      fs.rmSync(entry.backup, { force: true });
    } catch {
      /* the backup is already gone - nothing to reclaim */
    }
  }
  return entries.slice(-MAX_ENTRIES);
}

function append(entry) {
  const entries = read();
  entries.push(entry);
  write(prune(entries));
  return entry;
}

function newId() {
  return crypto.randomBytes(8).toString('hex');
}

/** Copy a file into the backup store and return the stored path. */
function backup(id, filePath) {
  ensureDirs();
  const stored = path.join(backupDir(), `${id}${path.extname(filePath) || '.bak'}`);
  fs.copyFileSync(filePath, stored);
  return stored;
}

// ---------------------------------------------------------------------------
// Journalled operations
// ---------------------------------------------------------------------------

function writeFile(filePath, content, runId) {
  const id = newId();
  try {
    const existed = fs.existsSync(filePath);
    const stored = existed ? backup(id, filePath) : null;
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content);

    append({
      id,
      runId,
      at: Date.now(),
      op: existed ? 'overwrite' : 'create',
      target: filePath,
      backup: stored,
      undone: false,
    });
    return { success: true, message: `${existed ? 'Overwrote' : 'Created'} ${filePath}`, entryId: id };
  } catch (err) {
    return { success: false, message: `Could not write ${filePath}: ${err.message}` };
  }
}

function moveFile(from, to, runId) {
  const id = newId();
  try {
    if (!fs.existsSync(from)) return { success: false, message: `${from} does not exist.` };
    // An overwriting move loses the destination, so that copy is kept too.
    const clobbered = fs.existsSync(to) ? backup(`${id}-dest`, to) : null;
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.renameSync(from, to);

    append({ id, runId, at: Date.now(), op: 'move', target: to, from, backup: clobbered, undone: false });
    return { success: true, message: `Moved ${from} to ${to}`, entryId: id };
  } catch (err) {
    return { success: false, message: `Could not move ${from}: ${err.message}` };
  }
}

/** Not a delete: the file goes into the backup store and can come back. */
function deleteFile(filePath, runId) {
  const id = newId();
  try {
    if (!fs.existsSync(filePath)) return { success: false, message: `${filePath} does not exist.` };
    const stored = backup(id, filePath);
    fs.rmSync(filePath, { force: true });

    append({ id, runId, at: Date.now(), op: 'delete', target: filePath, backup: stored, undone: false });
    return { success: true, message: `Removed ${filePath} (recoverable from the journal)`, entryId: id };
  } catch (err) {
    return { success: false, message: `Could not remove ${filePath}: ${err.message}` };
  }
}

// ---------------------------------------------------------------------------
// Undo
// ---------------------------------------------------------------------------

function undoEntry(entry) {
  switch (entry.op) {
    case 'create':
      fs.rmSync(entry.target, { force: true });
      return `Removed the file Pilot created at ${entry.target}`;

    case 'overwrite':
      if (!entry.backup || !fs.existsSync(entry.backup)) throw new Error('its backup is gone');
      fs.copyFileSync(entry.backup, entry.target);
      return `Restored the previous contents of ${entry.target}`;

    case 'delete':
      if (!entry.backup || !fs.existsSync(entry.backup)) throw new Error('its backup is gone');
      fs.mkdirSync(path.dirname(entry.target), { recursive: true });
      fs.copyFileSync(entry.backup, entry.target);
      return `Put ${entry.target} back`;

    case 'move': {
      if (!fs.existsSync(entry.target)) throw new Error('the moved file is no longer where Pilot left it');
      fs.mkdirSync(path.dirname(entry.from), { recursive: true });
      fs.renameSync(entry.target, entry.from);
      // Whatever the move overwrote goes back to where it was.
      if (entry.backup && fs.existsSync(entry.backup)) fs.copyFileSync(entry.backup, entry.target);
      return `Moved ${entry.target} back to ${entry.from}`;
    }

    default:
      throw new Error(`nothing is known about a "${entry.op}" operation`);
  }
}

function undo(entryId) {
  const entries = read();
  const entry = entries.find((e) => e.id === entryId);
  if (!entry) return { success: false, message: 'No journal entry with that id.' };
  if (entry.undone) return { success: false, message: 'That entry has already been undone.' };

  try {
    const message = undoEntry(entry);
    entry.undone = true;
    entry.undoneAt = Date.now();
    write(entries);
    return { success: true, message };
  } catch (err) {
    return { success: false, message: `Could not undo that: ${err.message}.` };
  }
}

/**
 * Undo a whole run, newest operation first.
 * Reverse order matters: a run that created a file and then moved it has to be
 * unwound the same way round, or the move's undo looks for a file that the
 * create's undo already removed.
 */
function undoRun(runId) {
  const entries = read();
  const mine = entries.filter((e) => e.runId === runId && !e.undone).reverse();
  if (mine.length === 0) return { success: false, message: 'That run changed no files.' };

  const done = [];
  const failed = [];
  for (const entry of mine) {
    try {
      done.push(undoEntry(entry));
      entry.undone = true;
      entry.undoneAt = Date.now();
    } catch (err) {
      failed.push(`${entry.target}: ${err.message}`);
    }
  }
  write(entries);

  if (failed.length === 0) {
    return { success: true, message: `Undid ${done.length} file change${done.length === 1 ? '' : 's'}.` };
  }
  return {
    success: done.length > 0,
    message: `Undid ${done.length} of ${mine.length} changes. Couldn't undo: ${failed.join('; ')}.`,
  };
}

/** Newest first, for the Pilot panel. */
function list(limit = 50) {
  return read().slice(-limit).reverse();
}

module.exports = { writeFile, moveFile, deleteFile, undo, undoRun, list };
