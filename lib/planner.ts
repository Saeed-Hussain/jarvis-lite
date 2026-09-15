/**
 * Turns an utterance into an ordered, executable plan.
 *
 * This is the "decide" half of the agent loop. It is pure and synchronous:
 * given text + memory it returns Task[] and never touches the OS. The
 * executor owns all side effects, which keeps planning fully unit-testable.
 */

import { normalize, splitSteps, stripWakeWord, extractSlots, Slots } from './nlu';
import { KNOWN_APPS, KNOWN_SITES, looksLikeDomain } from './commands';
import type { JarvisMemory, Task, TaskKind, Plan } from './types';
import { uid } from './utils';

/** Longest matching alias, so "whatsapp web" beats the bare "whatsapp". */
function matchAlias<T extends { aliases: string[] }>(text: string, entries: T[]) {
  let best: { entry: T; len: number } | null = null;
  for (const entry of entries) {
    for (const alias of entry.aliases) {
      if (new RegExp(`\\b${escapeRegex(alias)}\\b`, 'i').test(text)) {
        if (!best || alias.length > best.len) best = { entry, len: alias.length };
      }
    }
  }
  return best;
}

function findApp(text: string) {
  return matchAlias(text, KNOWN_APPS)?.entry ?? null;
}

function findSite(text: string) {
  return matchAlias(text, KNOWN_SITES)?.entry ?? null;
}

/**
 * Resolve text to an app OR a site, whichever matched on the longer alias.
 * Without this, "go to whatsapp web" resolves to the WhatsApp desktop app
 * because the app list is consulted first.
 */
function resolveTarget(text: string) {
  const app = matchAlias(text, KNOWN_APPS);
  const site = matchAlias(text, KNOWN_SITES);
  if (app && site) return site.len > app.len ? { site: site.entry } : { app: app.entry };
  if (app) return { app: app.entry };
  if (site) return { site: site.entry };
  return {};
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function task(kind: TaskKind, label: string, extra: Partial<Task> = {}): Task {
  return {
    id: uid(),
    kind,
    label,
    status: 'pending',
    ...extra,
  };
}

// ---------------------------------------------------------------------------
// Per-step planning
// ---------------------------------------------------------------------------

/**
 * Plan a single step fragment. Returns one or more tasks, because a single
 * phrase can legitimately expand into several ("text sara hi on whatsapp"
 * becomes open-whatsapp + compose + send).
 */
function planStep(step: string, slots: Slots, memory: JarvisMemory): Task[] {
  const text = normalize(step);

  // --- explicit wait -------------------------------------------------------
  if (slots.seconds !== undefined && /\b(?:wait|pause|hold)\b/i.test(text)) {
    return [
      task('wait', `Wait ${slots.seconds}s`, { seconds: slots.seconds }),
    ];
  }

  // --- messaging (whatsapp / text someone) ---------------------------------
  // Checked early: "text sara on whatsapp" also mentions an app, and the
  // messaging intent is the more specific reading.
  // The step must LEAD with a messaging verb. Matching the word "whatsapp"
  // anywhere would swallow "search whatsapp web", which is an open, not a send.
  const looksLikeMessaging = /^(?:text|message|msg|whatsapp|send|write|tell)\b/i.test(
    step.trim(),
  );

  if (looksLikeMessaging && (slots.recipient || slots.message)) {
    // Missing half of a message is a question, not a failure - the executor
    // pauses the plan and asks, then resumes with the answer filled in.
    const missing: Array<'recipient' | 'message'> = [];
    if (!slots.recipient) missing.push('recipient');
    if (!slots.message) missing.push('message');

    return [
      task('send_message', buildMessageLabel(slots), {
        recipient: slots.recipient,
        phone: slots.phone,
        message: slots.message,
        channel: 'whatsapp',
        status: missing.length ? 'blocked' : 'pending',
        missing: missing.length ? missing : undefined,
      }),
    ];
  }

  // "text someone a message" - the intent is clear but nothing is specified.
  if (looksLikeMessaging) {
    return [
      task('send_message', 'Send a WhatsApp message', {
        channel: 'whatsapp',
        status: 'blocked',
        missing: ['recipient', 'message'],
      }),
    ];
  }

  // --- system actions ------------------------------------------------------
  // Anchored so "blockchain" no longer triggers a screen lock.
  if (/\b(?:shutdown|shut down|power off)\b/.test(text)) {
    return [task('system', 'Shut down the PC', { action: 'shutdown', dangerous: true })];
  }
  if (/\b(?:restart|reboot)\b/.test(text)) {
    return [task('system', 'Restart the PC', { action: 'restart', dangerous: true })];
  }
  if (/\block\b(?:\s+(?:the\s+)?(?:pc|screen|computer|workstation))?/.test(text)) {
    return [task('system', 'Lock the screen', { action: 'lock', dangerous: true })];
  }
  if (/\b(?:sleep|suspend)\b/.test(text)) {
    return [task('system', 'Sleep the PC', { action: 'sleep', dangerous: true })];
  }

  // --- time / date ---------------------------------------------------------
  if (/\b(?:what(?:'s| is)? the )?time\b/.test(text) && !/\bsearch\b/.test(text)) {
    return [task('query_time', 'Check the time')];
  }
  if (/\b(?:what(?:'s| is)? (?:the |today'?s? )?date|what day (?:is|it))\b/.test(text)) {
    return [task('query_date', 'Check the date')];
  }

  // --- web search ----------------------------------------------------------
  // Must come before the site lookup: "search" and "google" are also aliases
  // of the Google *site*, and the search reading wins when a query follows.
  if (slots.query) {
    const query = normalize(slots.query);
    // "search whatsapp web" means open the site, not web-search that phrase.
    // Only when the query IS the site name - "search github for foo" still searches.
    const site = findSite(query);
    if (site && site.aliases.some((alias) => normalize(alias) === query)) {
      return [task('open_site', `Open ${site.label}`, { target: site.key, url: site.url })];
    }
    const namedApp = findApp(query);
    if (namedApp && namedApp.aliases.some((alias) => normalize(alias) === query)) {
      return [task('open_app', `Open ${namedApp.label}`, { target: namedApp.key, profile: slots.profile })];
    }
    if (looksLikeDomain(slots.query)) {
      return [task('open_site', `Open ${slots.query}`, { url: toUrl(slots.query), target: slots.query })];
    }
    return [task('search', `Search for "${slots.query}"`, { query: slots.query })];
  }

  // --- repeat the previous action -----------------------------------------
  if (/\b(?:open it|do it again|again|repeat that|same again)\b/.test(text)) {
    const previous = memory.last_app || memory.last_command;
    if (!previous) {
      return [task('noop', 'Nothing to repeat', { note: 'no previous command' })];
    }
    return planUtterance(previous, memory).tasks;
  }

  // --- learned commands ----------------------------------------------------
  // Checked before the generic "open X" fallback so a taught phrase that
  // happens to start with "open" still resolves to what the user taught.
  const learnedKey = Object.keys(memory.custom_commands).find(
    (key) => normalize(key) === text,
  );
  if (learnedKey) {
    return [
      task('learned', `Run learned command "${learnedKey}"`, {
        target: learnedKey,
        command: memory.custom_commands[learnedKey],
      }),
    ];
  }

  // --- known application or website (longest alias wins) -------------------
  const resolved = resolveTarget(text);
  if (resolved.app) {
    const app = resolved.app;
    return [
      task('open_app', slots.profile ? `Open ${app.label} (profile: ${slots.profile})` : `Open ${app.label}`, {
        target: app.key,
        profile: slots.profile,
      }),
    ];
  }
  if (resolved.site) {
    const site = resolved.site;
    return [task('open_site', `Open ${site.label}`, { target: site.key, url: site.url })];
  }

  // --- generic "open X" ----------------------------------------------------
  const target = slots.target;
  if (target && /^(?:open|launch|start|run|go to|visit)\b/i.test(step.trim())) {
    if (looksLikeDomain(target)) {
      return [task('open_site', `Open ${target}`, { url: toUrl(target), target })];
    }
    return [task('open_app', `Open ${capitalize(target)}`, { target, profile: slots.profile })];
  }

  return [task('unknown', step, { target: step })];
}

function buildMessageLabel(slots: Slots): string {
  const who = slots.recipient ? ` to ${slots.recipient}` : '';
  const what = slots.message ? `: "${truncate(slots.message, 40)}"` : '';
  return `Send WhatsApp message${who}${what}`;
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

function toUrl(raw: string): string {
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ---------------------------------------------------------------------------
// Whole-utterance planning
// ---------------------------------------------------------------------------

/**
 * Build a full plan from raw user input.
 *
 * Steps are resolved left to right so later steps can depend on earlier ones
 * (a message step inherits the recipient named in an earlier step, for
 * example). Unresolvable steps become `unknown` tasks rather than aborting
 * the plan - the executor decides whether to ask or skip.
 */
export function planUtterance(rawInput: string, memory: JarvisMemory): Plan {
  const { text: dewaked, hadWakeWord } = stripWakeWord(rawInput);

  const fragments = splitSteps(dewaked);
  const tasks: Task[] = [];

  // Slots carry forward: "open chrome with profile saeed then search x" keeps
  // the profile available to later steps that need a browser.
  const carried: Slots = {};

  for (const fragment of fragments) {
    const slots = extractSlots(fragment);
    if (slots.profile) carried.profile = slots.profile;
    if (slots.recipient) carried.recipient = slots.recipient;
    if (slots.phone) carried.phone = slots.phone;

    const merged: Slots = {
      ...slots,
      profile: slots.profile ?? carried.profile,
      recipient: slots.recipient ?? carried.recipient,
      phone: slots.phone ?? carried.phone,
    };

    tasks.push(...planStep(fragment, merged, memory));
  }

  if (tasks.length === 0) {
    tasks.push(task('unknown', rawInput, { target: rawInput }));
  }

  return {
    id: uid(),
    input: rawInput,
    hadWakeWord,
    tasks,
    createdAt: Date.now(),
  };
}

export { findApp, findSite };
