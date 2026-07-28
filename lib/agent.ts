import { normalize, closestMatch, uid } from './utils';
import { KNOWN_APPS, KNOWN_SITES, DANGEROUS_ACTIONS, ALL_KNOWN_PHRASES, AppDef, SiteDef, looksLikeDomain } from './commands';
import type { ActionResult, Intent, JarvisMemory, LogEntry } from './types';

// ---------- Helpers to resolve apps / sites by fuzzy alias matching ----------
function findApp(text: string): AppDef | null {
  for (const app of KNOWN_APPS) {
    if (app.aliases.some((alias) => text.includes(alias))) return app;
  }
  return null;
}

function findSite(text: string): SiteDef | null {
  for (const site of KNOWN_SITES) {
    if (site.aliases.some((alias) => text.includes(alias))) return site;
  }
  return null;
}

function isDangerous(text: string): boolean {
  return DANGEROUS_ACTIONS.some((danger) => text.includes(danger));
}

// Extract the target phrase after an "open / launch / start / go to" verb
function extractOpenTarget(text: string): string | null {
  const match = text.match(/^(?:open|launch|start|go to|run)\s+(.+)$/);
  return match ? match[1].trim() : null;
}

// ---------- OBSERVE + DECIDE ----------
// Determine what the user wants (intent) given normalized input + current memory/context
export function decide(rawInput: string, memory: JarvisMemory): Intent {
  const text = normalize(rawInput);

  // Confirmation replies (used when a previous message asked "are you sure?")
  if (/^(yes|yep|yeah|confirm|sure|do it)$/.test(text)) {
    return { type: 'confirm_yes', raw: rawInput };
  }
  if (/^(no|nope|cancel|don't|stop)$/.test(text)) {
    return { type: 'confirm_no', raw: rawInput };
  }

  // Context awareness: "open it" / "do it again" / "again"
  if (/(open it|do it again|^again$|repeat that|same again)/.test(text)) {
    return { type: 'context_repeat', raw: rawInput, target: memory.last_app || memory.last_command };
  }

  // Time / date queries
  if (/(what.*time|current time|time is it)/.test(text)) {
    return { type: 'query_time', raw: rawInput };
  }
  if (/(what.*date|today.*date|what day)/.test(text)) {
    return { type: 'query_date', raw: rawInput };
  }

  // System actions (shutdown / restart / lock)
  if (/shutdown|shut down/.test(text)) {
    return { type: 'system_action', target: 'shutdown', raw: rawInput, requiresConfirmation: true };
  }
  if (/restart/.test(text)) {
    return { type: 'system_action', target: 'restart', raw: rawInput, requiresConfirmation: true };
  }
  if (/lock( pc| screen)?/.test(text)) {
    return { type: 'system_action', target: 'lock', raw: rawInput, requiresConfirmation: isDangerous(text) };
  }

  // Open app
  const app = findApp(text);
  if (app && /open|launch|start/.test(text)) {
    return { type: 'open_app', target: app.key, raw: rawInput };
  }

  // Open site
  const site = findSite(text);
  if (site && /open|go to|launch/.test(text)) {
    return { type: 'open_url', target: site.key, raw: rawInput };
  }

  // Bare app/site mention without an explicit verb (still resolve it — user intent is clear)
  if (app) return { type: 'open_app', target: app.key, raw: rawInput };
  if (site) return { type: 'open_url', target: site.key, raw: rawInput };

  // Web search: "search for X" / "google X"
  const searchMatch = text.match(/^(?:search for|google|search)\s+(.+)$/);
  if (searchMatch) {
    return { type: 'web_search', target: searchMatch[1].trim(), raw: rawInput };
  }

  // Universal "open X" — anything not in the curated lists still resolves:
  // a bare domain opens directly, everything else is attempted as a real app launch.
  const openTarget = extractOpenTarget(text);
  if (openTarget) {
    if (looksLikeDomain(openTarget) || openTarget.includes('.')) {
      return { type: 'open_generic_site', target: openTarget, raw: rawInput };
    }
    return { type: 'open_generic_app', target: openTarget, raw: rawInput };
  }

  // Learned custom commands
  const learnedKey = Object.keys(memory.custom_commands).find((key) => text === normalize(key));
  if (learnedKey) {
    return { type: 'learned_command', target: learnedKey, raw: rawInput };
  }

  return { type: 'unknown', raw: rawInput };
}

// ---------- ACT ----------
// Execute the resolved intent using the Electron bridge (or a safe browser fallback)
export async function act(
  intent: Intent,
  memory: JarvisMemory
): Promise<{ result: ActionResult; response: string; updatedMemory: JarvisMemory; log: LogEntry }> {
  const bridge = typeof window !== 'undefined' ? window.jarvis : undefined;
  let result: ActionResult;
  let response: string;
  let decisionLabel: string = intent.type;
  const updatedMemory: JarvisMemory = { ...memory };

  switch (intent.type) {
    case 'open_app': {
      const app = KNOWN_APPS.find((a) => a.key === intent.target)!;
      result = bridge ? await bridge.openApp(app.key) : simulate(`Opening ${app.label} for you.`);
      response = result.success ? `Opening ${app.label} for you.` : result.message;
      result = { ...result, appLabel: app.label, appIcon: app.icon };
      updatedMemory.last_command = `open ${app.key}`;
      updatedMemory.last_app = app.key;
      decisionLabel = `open_app:${app.key}`;
      break;
    }
    case 'open_url': {
      const site = KNOWN_SITES.find((s) => s.key === intent.target)!;
      result = bridge ? await bridge.openUrl(site.url) : simulate(`Opening ${site.label} in your default browser.`);
      response = result.success ? `Opening ${site.label} in your default browser.` : result.message;
      result = { ...result, appLabel: site.label, appIcon: site.icon };
      updatedMemory.last_command = `open ${site.key}`;
      updatedMemory.last_app = site.key;
      decisionLabel = `open_url:${site.key}`;
      break;
    }
    case 'open_generic_app': {
      const name = intent.target!;
      result = bridge ? await bridge.openApp(name) : simulate(`Opening ${capitalize(name)} for you.`);
      response = result.success ? `Opening ${capitalize(name)} for you.` : result.message;
      if (result.success) {
        result = { ...result, appLabel: capitalize(name), appIcon: 'apps' };
        updatedMemory.last_command = `open ${name}`;
        updatedMemory.last_app = name;
      }
      decisionLabel = `open_generic_app:${name}`;
      break;
    }
    case 'open_generic_site': {
      const raw = intent.target!;
      const url = raw.startsWith('http') ? raw : `https://${raw}`;
      const label = raw.replace(/^www\./, '').split('/')[0];
      result = bridge ? await bridge.openUrl(url) : simulate(`Opening ${label} in your default browser.`);
      response = result.success ? `Opening ${label} in your default browser.` : result.message;
      result = { ...result, appLabel: label, appIcon: 'google' };
      updatedMemory.last_command = `open ${raw}`;
      updatedMemory.last_app = raw;
      decisionLabel = `open_generic_site:${raw}`;
      break;
    }
    case 'web_search': {
      const query = intent.target!;
      const url = `https://google.com/search?q=${encodeURIComponent(query)}`;
      result = bridge ? await bridge.openUrl(url) : simulate(`Searching for "${query}".`);
      response = result.success ? `Searching for "${query}".` : result.message;
      result = { ...result, appLabel: `"${query}"`, appIcon: 'google' };
      decisionLabel = `web_search:${query}`;
      break;
    }
    case 'system_action': {
      const action = intent.target!;
      result = bridge ? await bridge.systemAction(action) : simulate(`${capitalize(action)} initiated.`);
      response = result.message;
      updatedMemory.last_command = action;
      decisionLabel = `system_action:${action}`;
      break;
    }
    case 'query_time': {
      const dt = bridge ? await bridge.getDateTime() : { time: new Date().toLocaleTimeString(), date: '', iso: '' };
      response = `The current time is ${dt.time}.`;
      result = { success: true, message: response };
      break;
    }
    case 'query_date': {
      const dt = bridge
        ? await bridge.getDateTime()
        : { time: '', date: new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }), iso: '' };
      response = `Today is ${dt.date}.`;
      result = { success: true, message: response };
      break;
    }
    case 'context_repeat': {
      if (!intent.target) {
        response = "I don't have a previous command to repeat yet.";
        result = { success: false, message: response };
        break;
      }
      const repeated = decide(intent.target, memory);
      return act(repeated, memory);
    }
    case 'learned_command': {
      const mapped = memory.custom_commands[intent.target!];
      result = bridge ? await bridge.openCustom(mapped) : simulate(`Running your saved command: "${mapped}"`);
      response = result.success ? `Running your saved command: "${mapped}"` : result.message;
      updatedMemory.last_command = intent.target!;
      decisionLabel = `learned_command:${intent.target}`;
      break;
    }
    default: {
      const suggestion = closestMatch(normalize(intent.raw), ALL_KNOWN_PHRASES);
      response = suggestion
        ? `I didn't quite catch that. Did you mean "${suggestion}"?`
        : "I don't know that command yet. What should I do for this?";
      result = { success: false, message: response };
      decisionLabel = 'unknown';
    }
  }

  const log: LogEntry = {
    id: uid(),
    timestamp: Date.now(),
    input: intent.raw,
    decision: decisionLabel,
    action: response,
    status: result.success ? 'success' : intent.type === 'unknown' ? 'info' : 'error',
  };

  return { result, response, updatedMemory, log };
}

function simulate(message: string): ActionResult {
  // Browser-only fallback when not running inside Electron (e.g. `next dev` in a plain browser tab)
  return { success: true, message: `${message} (simulated — running outside Electron)` };
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export { isDangerous, findApp, findSite };
