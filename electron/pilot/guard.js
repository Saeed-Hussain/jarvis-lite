/**
 * The hard safety gate.
 *
 * Every Pilot action passes through `judge` before any input is synthesised.
 * This is deliberately not a prompt or a policy the model is asked to follow -
 * it is code the action cannot get past, so a workflow that was recorded
 * innocently and later replays over a banking tab still stops.
 *
 * Three verdicts:
 *   allow    - go ahead
 *   confirm  - reversible but consequential; the user must say yes this run
 *   block    - irreversible or destructive; never performed, no override here
 *
 * Blocked is blocked. The user can still do the thing themselves; Pilot will
 * not do it for them.
 */

/**
 * Text that, typed anywhere, destroys data or hands over control.
 * Matched against what would be typed, not against the user's request, so a
 * workflow that pastes it from a recorded step is caught too.
 */
const DESTRUCTIVE_TEXT = [
  { pattern: /\brm\s+-[a-z]*[rf]/i, why: 'a recursive delete' },
  { pattern: /\bdel\s+\/[sq]/i, why: 'a recursive delete' },
  { pattern: /\brmdir\s+\/s/i, why: 'a recursive directory delete' },
  { pattern: /\bRemove-Item\b[^\n]*-Recurse/i, why: 'a recursive delete' },
  { pattern: /\bformat\s+[a-z]:/i, why: 'formatting a drive' },
  { pattern: /\bdiskpart\b/i, why: 'partition editing' },
  { pattern: /\bmkfs\b/i, why: 'formatting a filesystem' },
  { pattern: /\bDROP\s+(?:TABLE|DATABASE|SCHEMA)\b/i, why: 'dropping a database object' },
  { pattern: /\bTRUNCATE\s+TABLE\b/i, why: 'emptying a table' },
  { pattern: /\bDELETE\s+FROM\b(?![\s\S]*\bWHERE\b)/i, why: 'an unfiltered SQL delete' },
  { pattern: /\bgit\s+push\b[^\n]*--force/i, why: 'a force push' },
  { pattern: /\bgit\s+reset\s+--hard/i, why: 'discarding local work' },
  { pattern: /\bshutdown\b|\bReboot-Computer\b|\bStop-Computer\b/i, why: 'powering the machine off' },
  { pattern: /\bcipher\s+\/w/i, why: 'wiping free space' },
  { pattern: /\b(?:curl|wget|iwr|Invoke-WebRequest)\b[^\n]*\|\s*(?:bash|sh|iex)/i, why: 'piping a download into a shell' },
];

/** Key chords that throw work away or cannot be taken back. */
const DESTRUCTIVE_KEYS = [
  { pattern: /\{DEL(?:ETE)?\}/i, modifiers: /[+]/, why: 'shift-delete bypasses the recycle bin' },
  { pattern: /\^\+\{DEL(?:ETE)?\}/i, why: 'clearing browsing data' },
  { pattern: /%\{F4\}/i, why: 'closing a window that may hold unsaved work' },
  { pattern: /\^\{F4\}/i, why: 'closing a document that may hold unsaved work' },
];

/**
 * Control labels that commit something irreversible.
 * Matched whole-word against the accessibility name of the click target, so
 * "Delete" stops and "Deleted items" does not.
 */
const IRREVERSIBLE_LABELS = [
  { pattern: /^(?:delete|delete permanently|permanently delete|erase|wipe)$/i, why: 'a permanent delete' },
  { pattern: /^(?:empty (?:the )?(?:recycle bin|trash|bin))$/i, why: 'emptying the recycle bin' },
  { pattern: /^(?:format|format disk|format drive)$/i, why: 'formatting a drive' },
  { pattern: /^(?:uninstall|remove program)$/i, why: 'uninstalling software' },
  { pattern: /^(?:factory reset|reset (?:this )?pc)$/i, why: 'resetting the machine' },
];

/** Control labels that move money or say something to other people. */
const CONSEQUENTIAL_LABELS = [
  { pattern: /^(?:pay|pay now|send payment|transfer|transfer now|confirm payment|buy|buy now|place order|purchase|checkout|subscribe)$/i, why: 'it spends money' },
  { pattern: /^(?:send|send all|post|publish|submit|tweet|reply all)$/i, why: 'it sends something to other people' },
  { pattern: /^(?:sign out|log out|disconnect)$/i, why: 'it ends the session' },
  { pattern: /^(?:allow|grant access|accept|install|trust)$/i, why: 'it grants a permission' },
];

/**
 * Applications where a synthetic keystroke is a command, not a character.
 * Typing into a terminal is how an accidental step becomes an executed one,
 * so it always needs a yes even when the text looks harmless.
 */
const SHELL_PROCESSES = /^(?:cmd|powershell|pwsh|windowsterminal|wt|conhost|bash|ubuntu|wsl|putty|mintty)$/i;

/** Windows that should never be driven blind. */
const SENSITIVE_TITLES = [
  { pattern: /\b(?:bank|banking|paypal|stripe|wise|payoneer|wallet|coinbase|binance)\b/i, why: 'it looks like a banking or payments window' },
  { pattern: /\b(?:password|credential|keychain|vault|authenticator|2fa|one.?time code)\b/i, why: 'it looks like a credential prompt' },
  { pattern: /\buser account control\b/i, why: 'it is a Windows elevation prompt' },
];

function matchList(list, value) {
  if (!value) return null;
  for (const entry of list) {
    if (entry.pattern.test(value)) return entry;
  }
  return null;
}

/**
 * Judge one action.
 *
 * @param {object} action  { type, text?, keys?, targetName?, path? }
 * @param {object} context { windowTitle?, processName? }
 * @returns {{ verdict: 'allow'|'confirm'|'block', reason?: string }}
 */
function judge(action = {}, context = {}) {
  const { type } = action;
  const title = context.windowTitle || '';
  const process = (context.processName || '').replace(/\.exe$/i, '');

  // --- the window itself ---------------------------------------------------
  const sensitive = matchList(SENSITIVE_TITLES, title);
  if (sensitive) {
    return {
      verdict: 'block',
      reason: `I won't drive "${title.trim()}" — ${sensitive.why}. Do this one yourself.`,
    };
  }

  // --- typing --------------------------------------------------------------
  if (type === 'type') {
    const text = String(action.text || '');
    const destructive = matchList(DESTRUCTIVE_TEXT, text);
    if (destructive) {
      return { verdict: 'block', reason: `That text is ${destructive.why}. I won't type it.` };
    }
    if (SHELL_PROCESSES.test(process)) {
      return {
        verdict: 'confirm',
        reason: `${process} is a shell — anything I type there runs. Confirm the exact text first.`,
      };
    }
    return { verdict: 'allow' };
  }

  // --- key chords ----------------------------------------------------------
  if (type === 'key') {
    const keys = String(action.keys || '');
    for (const entry of DESTRUCTIVE_KEYS) {
      if (!entry.pattern.test(keys)) continue;
      if (entry.modifiers && !entry.modifiers.test(keys)) continue;
      return { verdict: 'block', reason: `"${keys}" is ${entry.why}. I won't send it.` };
    }
    if (SHELL_PROCESSES.test(process) && /\{ENTER\}/i.test(keys)) {
      return { verdict: 'confirm', reason: `Pressing Enter in ${process} runs whatever is on the line.` };
    }
    return { verdict: 'allow' };
  }

  // --- clicking ------------------------------------------------------------
  if (type === 'click') {
    const label = String(action.targetName || '').trim();
    const irreversible = matchList(IRREVERSIBLE_LABELS, label);
    if (irreversible) {
      return { verdict: 'block', reason: `"${label}" is ${irreversible.why}. I won't click it.` };
    }
    const consequential = matchList(CONSEQUENTIAL_LABELS, label);
    if (consequential) {
      return { verdict: 'confirm', reason: `"${label}" — ${consequential.why}.` };
    }
    return { verdict: 'allow' };
  }

  // --- file operations -----------------------------------------------------
  if (type === 'delete_file' || type === 'move_file' || type === 'write_file') {
    const target = String(action.path || '');
    // A move writes to `to`, so the destination is checked as well as the
    // source — otherwise a move into System32 passes on the source's clean
    // bill of health.
    for (const candidate of [target, String(action.to || '')].filter(Boolean)) {
      if (/^[a-z]:[\\/]?$/i.test(candidate) || /^[\\/]+$/.test(candidate)) {
        return { verdict: 'block', reason: `${candidate} is the root of a drive.` };
      }
      if (/\\(?:Windows|Program Files(?: \(x86\))?|System32)(?:\\|$)/i.test(candidate)) {
        return { verdict: 'block', reason: `${candidate} is inside a system directory.` };
      }
    }
    // Reversible: journalled with a backup, so it needs a yes and not a veto.
    return {
      verdict: 'confirm',
      reason: `${type.replace('_', ' ')} on ${target} — I'll journal it so it can be undone.`,
    };
  }

  return { verdict: 'allow' };
}

/**
 * Judge a whole workflow without running it - this is what the dry run shows.
 * Returns one verdict per step, in order.
 */
function review(steps = [], context = {}) {
  return steps.map((step, index) => ({
    index,
    step,
    ...judge(step, context),
  }));
}

module.exports = { judge, review, SHELL_PROCESSES };
