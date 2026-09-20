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
import { runWorkflow } from './pilot/runner';
import { uid, formatTime } from './utils';

/** Why a run stopped, so the store knows what to ask. */
export type PauseReason =
  | { type: 'confirm'; task: Task; question: string }
  | { type: 'missing'; task: Task; slot: 'recipient' | 'message' | 'phone' | 'workflow'; question: string }
  // A Pilot run that reached a step the guard wants a yes for. Unlike
  // `confirm`, the work is already half-done: resuming continues the same run
  // from the step that asked rather than starting over.
  | { type: 'pilot'; task: Task; question: string };

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

/** Parent directory of a path, without importing Node's path into the renderer. */
function parentOf(dir: string): string {
  const trimmed = dir.replace(/[\\/]+$/, '');
  const cut = Math.max(trimmed.lastIndexOf('\\'), trimmed.lastIndexOf('/'));
  if (cut <= 2) return trimmed.slice(0, 3); // already at "D:\"
  return trimmed.slice(0, cut);
}

/** Name the workflows on offer, so "pilot" on its own is a useful question. */
async function workflowQuestion(): Promise<string> {
  const saved = (await bridge()?.pilot?.workflows()) ?? [];
  if (saved.length === 0) {
    return "I haven't recorded any workflows yet. Open the Pilot panel, press Record, and do the task once — then I can replay it.";
  }
  return `Which one? I have ${saved.map((w) => `"${w.name}"`).join(', ')}.`;
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
): Promise<{ result: ActionResult; response: string; memory: JarvisMemory; pause?: PauseReason }> {
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

    case 'open_path': {
      const query = task.pathQuery ?? task.target ?? '';
      // ".." is only meaningful against where we already are, so it is
      // resolved here rather than asking the main process to guess.
      const base = memory.last_path;
      const resolved = query === '..' && base ? parentOf(base) : query;

      const result: ActionResult & { path?: string } = api
        ? await api.openPath(resolved, base)
        : simulated(`Opening ${resolved}`);

      if (result.success && result.path) {
        // The new location becomes the base for the next step, which is what
        // makes "open d drive then go to projects" work as a sequence.
        next.last_path = result.path;
        next.last_command = `open ${result.path}`;
      }
      return {
        result: { ...result, appLabel: result.path ?? resolved, appIcon: 'folder' },
        response: result.message,
        memory: next,
      };
    }

    case 'list_path': {
      const query = task.pathQuery ?? task.target ?? '';
      const result: ActionResult & { path?: string; folders?: string[]; files?: string[] } = api
        ? await api.listPath(query, memory.last_path)
        : simulated(`Listing ${query}`);

      if (!result.success) return { result, response: result.message, memory: next };

      next.last_path = result.path ?? next.last_path;
      const folders = result.folders ?? [];
      const files = result.files ?? [];
      // Reading 200 names aloud helps nobody; name the first handful and
      // count the rest.
      const preview = [...folders.slice(0, 8), ...files.slice(0, 4)].join(', ');
      const extra = folders.length + files.length - Math.min(8, folders.length) - Math.min(4, files.length);
      const response = `${result.path} has ${folders.length} folders and ${files.length} files${
        preview ? `: ${preview}${extra > 0 ? `, and ${extra} more` : ''}` : ''
      }.`;
      return { result: { ...result, appLabel: result.path, appIcon: 'folder' }, response, memory: next };
    }

    case 'pilot': {
      const pilot = api?.pilot;
      if (!pilot) {
        const response =
          'Pilot drives the screen, which only works in the desktop app — a browser tab can\'t see your other windows.';
        return { result: { success: false, message: response }, response, memory: next };
      }

      const status = await pilot.available();
      if (!status.available) {
        return { result: { success: false, message: status.reason }, response: status.reason, memory: next };
      }

      const workflow = await pilot.findWorkflow(task.workflow ?? '');
      if (!workflow) {
        const saved = await pilot.workflows();
        const response = saved.length
          ? `I have no workflow called "${task.workflow}". I know: ${saved.map((w) => w.name).join(', ')}.`
          : `I haven't recorded any workflows yet. Open the Pilot panel, press Record, and do the task once.`;
        return { result: { success: false, message: response }, response, memory: next };
      }

      // Resuming a run that paused on a guard verdict. The approval is
      // one-shot: a later guarded step in the same workflow asks again.
      const paused = task.pilotRun;
      const resuming = paused?.status === 'awaiting-approval' && paused.pendingApproval && task.pilotApprove;

      const report = resuming
        ? await runWorkflow(workflow, {
            runId: paused!.runId,
            approved: new Set([workflow.steps[paused!.pendingApproval!.stepIndex].id]),
            priorSteps: paused!.steps.filter((s) => s.index < paused!.pendingApproval!.stepIndex),
            startAt: paused!.pendingApproval!.stepIndex,
          })
        : await runWorkflow(workflow);

      task.pilotRun = report;
      task.pilotApprove = undefined;
      next.last_command = `pilot ${workflow.name}`;

      if (report.status === 'awaiting-approval' && report.pendingApproval) {
        const question = report.pendingApproval.question;
        return {
          result: { success: false, message: question },
          response: question,
          memory: next,
          pause: { type: 'pilot', task, question },
        };
      }

      const seconds = (report.ms / 1000).toFixed(1);
      const ran = report.steps.filter((s) => s.status === 'done').length;

      if (report.status === 'done') {
        // The numbers are the point: a workflow nobody can time is a workflow
        // nobody can trust to be faster than doing it by hand.
        const perStep = ran ? Math.round(report.ms / ran) : 0;
        const response = `Ran "${workflow.name}" — ${ran} steps in ${seconds}s (${perStep}ms a step).`;
        return { result: { success: true, message: response }, response, memory: next };
      }

      const why =
        report.status === 'stopped'
          ? `Stopped after ${ran} of ${workflow.steps.length} steps.`
          : report.status === 'blocked'
            ? `Blocked at "${report.haltedBy}": ${report.message}`
            : `Failed at "${report.haltedBy}": ${report.message}`;
      const undo = report.steps.some((s) => s.status === 'done')
        ? ' Any files it changed are in the undo journal in the Pilot panel.'
        : '';
      return { result: { success: false, message: `${why}${undo}` }, response: `${why}${undo}`, memory: next };
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
              : slot === 'workflow'
                ? await workflowQuestion()
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
    const { result, response, memory: updated, pause } = await runTask(task, workingMemory, options);
    workingMemory = updated;

    // A task that got part-way and now needs an answer - only Pilot does
    // this, because only Pilot's work survives the pause.
    if (pause) {
      task.status = 'blocked';
      return { plan: { ...plan, tasks }, memory: workingMemory, logs, transcript, pause };
    }

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
