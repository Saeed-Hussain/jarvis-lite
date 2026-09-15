/**
 * The "act" half of the agent loop.
 *
 * Runs a plan's tasks in order, carrying context forward between them, and
 * stops at the first task that needs something from the user (a confirmation
 * for a destructive action, or a missing slot). The caller resumes by calling
 * runPlan again once the answer has been merged into the task.
 */

import type { ActionResult, JarvisMemory, LogEntry, Plan, Task } from './types';
import { KNOWN_APPS, KNOWN_SITES, PROFILE_CAPABLE_BROWSERS } from './commands';
import { uid, formatTime } from './utils';

/** Why a run stopped, so the store knows what to ask. */
export type PauseReason =
  | { type: 'confirm'; task: Task; question: string }
  | { type: 'missing'; task: Task; slot: 'recipient' | 'message' | 'phone'; question: string };

export interface RunOutcome {
  plan: Plan;
  memory: JarvisMemory;
  logs: LogEntry[];
  /** Set when the run stopped early and needs user input. */
  pause?: PauseReason;
  /** One line per finished task, for the chat transcript. */
  transcript: string[];
}

export interface RunOptions {
  /** Destructive tasks already approved this turn, by task id. */
  approved?: Set<string>;
  /** Enable the synthetic Enter keystroke after opening a WhatsApp chat. */
  autoSendWhatsApp?: boolean;
}

const bridge = () => (typeof window !== 'undefined' ? window.jarvis : undefined);

function simulated(message: string): ActionResult {
  return { success: true, message: `${message} (simulated — not running inside Electron)` };
}

function log(task: Task, response: string, status: LogEntry['status']): LogEntry {
  return {
    id: uid(),
    timestamp: Date.now(),
    input: task.label,
    decision: task.kind,
    action: response,
    status,
  };
}

/** Look up a saved phone number for a contact name (case-insensitive). */
function lookupContact(memory: JarvisMemory, name: string): string | undefined {
  const contacts = memory.contacts ?? {};
  const target = name.trim().toLowerCase();
  for (const [key, value] of Object.entries(contacts)) {
    if (key.trim().toLowerCase() === target) return value;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Individual task execution
// ---------------------------------------------------------------------------

async function runTask(
  task: Task,
  memory: JarvisMemory,
  options: RunOptions,
): Promise<{ result: ActionResult; response: string; memory: JarvisMemory }> {
  const api = bridge();
  const next: JarvisMemory = { ...memory };

  switch (task.kind) {
    case 'open_app': {
      const app = KNOWN_APPS.find((a) => a.key === task.target);
      const label = app?.label ?? task.target ?? 'that app';
      const key = app?.key ?? task.target ?? '';

      // A profile only means something for browsers that support one.
      const profile = task.profile && PROFILE_CAPABLE_BROWSERS[key] ? task.profile : undefined;
      const unsupportedProfile = task.profile && !profile;

      const result = api
        ? await api.openApp(key, { profile })
        : simulated(`Opening ${label}${profile ? ` with profile "${profile}"` : ''}`);

      next.last_app = key;
      next.last_command = `open ${key}`;

      let response = result.success
        ? result.message || `Opened ${label}.`
        : result.message || `I couldn't open ${label}.`;
      if (unsupportedProfile) {
        response += ` (${label} doesn't support named profiles, so I ignored "${task.profile}".)`;
      }
      return { result: { ...result, appLabel: label, appIcon: app?.icon }, response, memory: next };
    }

    case 'open_site': {
      const site = KNOWN_SITES.find((s) => s.key === task.target);
      const url = task.url ?? site?.url ?? '';
      const label = site?.label ?? task.target ?? url;

      const result = api
        ? task.profile
          ? await api.openUrlInProfile(url, 'chrome', task.profile)
          : await api.openUrl(url)
        : simulated(`Opening ${label}`);

      next.last_app = task.target ?? label;
      next.last_command = `open ${label}`;
      return {
        result: { ...result, appLabel: label, appIcon: site?.icon ?? 'google' },
        response: result.success ? `Opened ${label}.` : result.message,
        memory: next,
      };
    }

    case 'search': {
      const query = task.query ?? '';
      const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
      const result = api
        ? task.profile
          ? await api.openUrlInProfile(url, 'chrome', task.profile)
          : await api.openUrl(url)
        : simulated(`Searching for "${query}"`);
      next.last_command = `search ${query}`;
      return {
        result: { ...result, appLabel: `"${query}"`, appIcon: 'google' },
        response: result.success ? `Searched for "${query}".` : result.message,
        memory: next,
      };
    }

    case 'send_message': {
      const phone = task.phone ?? (task.recipient ? lookupContact(memory, task.recipient) : undefined);
      const result = api
        ? await api.sendWhatsApp({
            phone,
            message: task.message ?? '',
            profile: task.profile,
            autoSend: options.autoSendWhatsApp ?? false,
          })
        : simulated(`Messaging ${task.recipient ?? phone} on WhatsApp`);

      // Remember the number so the name works unprompted next time. Only
      // worth storing when the recipient is an actual name - mapping a number
      // to itself just clutters the contact list.
      const isName = task.recipient && !/^\+?[\d\s()-]+$/.test(task.recipient);
      if (isName && phone && !lookupContact(memory, task.recipient!)) {
        next.contacts = { ...(memory.contacts ?? {}), [task.recipient!]: phone };
      }
      next.last_command = `message ${task.recipient ?? phone ?? ''}`.trim();
      return { result, response: result.message, memory: next };
    }

    case 'system': {
      const action = task.action ?? '';
      const result = api ? await api.systemAction(action) : simulated(`${action} initiated`);
      next.last_command = action;
      return { result, response: result.message, memory: next };
    }

    case 'query_time': {
      const dt = api ? await api.getDateTime() : { time: formatTime(), date: '', iso: '' };
      const response = `The time is ${dt.time}.`;
      return { result: { success: true, message: response }, response, memory: next };
    }

    case 'query_date': {
      const fallback = new Date().toLocaleDateString(undefined, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      const dt = api ? await api.getDateTime() : { time: '', date: fallback, iso: '' };
      const response = `Today is ${dt.date}.`;
      return { result: { success: true, message: response }, response, memory: next };
    }

    case 'learned': {
      const command = task.command ?? memory.custom_commands[task.target ?? ''] ?? '';
      const result = api ? await api.openCustom(command) : simulated(`Running "${command}"`);
      next.last_command = task.target ?? command;
      return {
        result,
        response: result.success ? `Ran your saved command "${task.target}".` : result.message,
        memory: next,
      };
    }

    case 'wait': {
      const seconds = task.seconds ?? 1;
      await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
      const response = `Waited ${seconds}s.`;
      return { result: { success: true, message: response }, response, memory: next };
    }

    case 'noop': {
      const response = task.note ? `Skipped: ${task.note}.` : 'Nothing to do.';
      return { result: { success: true, message: response }, response, memory: next };
    }

    default: {
      const response = `I don't know how to "${task.target ?? task.label}" yet. What should I do for that?`;
      return { result: { success: false, message: response }, response, memory: next };
    }
  }
}

// ---------------------------------------------------------------------------
// Plan execution
// ---------------------------------------------------------------------------

/**
 * Execute pending tasks in order.
 *
 * Stops and returns a `pause` when a task needs confirmation or is missing a
 * slot. Already-completed tasks are skipped, so resuming after an answer
 * continues from where it left off rather than re-running side effects.
 */
export async function runPlan(
  plan: Plan,
  memory: JarvisMemory,
  options: RunOptions = {},
): Promise<RunOutcome> {
  const tasks = plan.tasks.map((t) => ({ ...t }));
  const logs: LogEntry[] = [];
  const transcript: string[] = [];
  let workingMemory = memory;

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    if (task.status === 'done' || task.status === 'skipped' || task.status === 'failed') continue;

    // --- resolve a contact name to a number before anything else ---
    if (task.kind === 'send_message' && !task.phone && task.recipient) {
      const known = lookupContact(workingMemory, task.recipient);
      if (known) {
        task.phone = known;
        task.missing = task.missing?.filter((m) => m !== 'recipient');
        if (task.missing?.length === 0) task.missing = undefined;
      } else {
        task.status = 'blocked';
        return {
          plan: { ...plan, tasks },
          memory: workingMemory,
          logs,
          transcript,
          pause: {
            type: 'missing',
            task,
            slot: 'phone',
            question: `What's ${task.recipient}'s WhatsApp number? Include the country code, like +923001234567. I'll remember it.`,
          },
        };
      }
    }

    // --- missing slots ---
    if (task.missing?.length) {
      const slot = task.missing[0];
      task.status = 'blocked';
      return {
        plan: { ...plan, tasks },
        memory: workingMemory,
        logs,
        transcript,
        pause: {
          type: 'missing',
          task,
          slot,
          question:
            slot === 'recipient'
              ? 'Who should I send it to? Give me a name or a number with the country code.'
              : 'What should the message say?',
        },
      };
    }

    // --- confirmation for destructive actions ---
    if (task.dangerous && !options.approved?.has(task.id)) {
      task.status = 'blocked';
      return {
        plan: { ...plan, tasks },
        memory: workingMemory,
        logs,
        transcript,
        pause: {
          type: 'confirm',
          task,
          question: `${task.label}? That can't be undone — reply "yes" to go ahead or "no" to cancel.`,
        },
      };
    }

    // --- run it ---
    // Refresh the label so a task filled in through Q&A no longer reads
    // "Send a WhatsApp message" once we know who and what.
    if (task.kind === 'send_message') {
      const who = task.recipient ?? task.phone;
      const preview = task.message && task.message.length > 40
        ? `${task.message.slice(0, 39)}…`
        : task.message;
      task.label = `Send WhatsApp message${who ? ` to ${who}` : ''}${preview ? `: "${preview}"` : ''}`;
    }

    task.status = 'running';
    const { result, response, memory: updated } = await runTask(task, workingMemory, options);
    workingMemory = updated;
    task.result = result;
    task.status = result.success ? 'done' : 'failed';
    transcript.push(response);
    logs.push(log(task, response, result.success ? 'success' : task.kind === 'unknown' ? 'info' : 'error'));

    // A failed step stops the chain: later steps usually assume it worked.
    if (!result.success) {
      for (let j = i + 1; j < tasks.length; j++) {
        tasks[j].status = 'skipped';
        tasks[j].note = 'earlier step failed';
      }
      break;
    }
  }

  return { plan: { ...plan, tasks }, memory: workingMemory, logs, transcript };
}
