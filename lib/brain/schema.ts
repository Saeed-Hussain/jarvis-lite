/**
 * What the model is allowed to say, and how we check it.
 *
 * A language model writing plans is only safe if something else decides what a
 * plan may contain. This file is that something else: it defines a small,
 * closed vocabulary of intents, and turns model output into Task[] by
 * validating every field rather than trusting any of it.
 *
 * Three rules hold here and are worth stating plainly:
 *
 *   1. An intent the model invents is dropped, not guessed at. There is no
 *      "close enough" mapping — an unknown `kind` produces nothing.
 *   2. `dangerous` is set by THIS code from the intent's own kind, never by
 *      the model. A model cannot mark a shutdown as safe, because it is not
 *      asked. Destructive steps keep going through the same confirmation the
 *      rule-based planner uses.
 *   3. Free text is bounded. Every string is length-capped before it reaches a
 *      shell, a URL or a message body.
 */

import type { Task, TaskKind } from '../types';
import { uid } from '../utils';

/** Hard cap on any string the model produces. */
const MAX_TEXT = 500;

/** A plan longer than this is the model rambling, not a real instruction. */
const MAX_STEPS = 8;

/** System verbs the model may name. Anything else is dropped. */
const SYSTEM_ACTIONS = ['shutdown', 'restart', 'lock', 'sleep'] as const;

/**
 * Intents the model may emit, and what each one needs.
 * The keys are exactly what the prompt documents — keep the two in step.
 */
export const INTENTS = {
  open_app: { kind: 'open_app', needs: 'app' },
  open_site: { kind: 'open_site', needs: 'site' },
  search: { kind: 'search', needs: 'query' },
  open_path: { kind: 'open_path', needs: 'path' },
  list_path: { kind: 'list_path', needs: 'path' },
  send_message: { kind: 'send_message', needs: 'message' },
  system: { kind: 'system', needs: 'action' },
  time: { kind: 'query_time', needs: null },
  date: { kind: 'query_date', needs: null },
  wait: { kind: 'wait', needs: 'seconds' },
  pilot: { kind: 'pilot', needs: 'workflow' },
} as const satisfies Record<string, { kind: TaskKind; needs: string | null }>;

export type IntentName = keyof typeof INTENTS;

/** Only these ever get a confirmation prompt, and we decide it, not the model. */
const DANGEROUS_KINDS = new Set<TaskKind>(['system']);

function text(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim().slice(0, MAX_TEXT);
  return trimmed || undefined;
}

function digits(value: unknown): number | undefined {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.min(n, 3600) : undefined;
}

/** Only http(s) survives; a file:// or custom scheme from a model is dropped. */
function url(value: unknown): string | undefined {
  const raw = text(value);
  if (!raw) return undefined;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i.test(raw)) return `https://${raw}`;
  return undefined;
}

function label(kind: TaskKind, step: Record<string, unknown>): string {
  switch (kind) {
    case 'open_app':
      return `Open ${text(step.app) ?? 'that app'}`;
    case 'open_site':
      return `Open ${text(step.site) ?? 'that site'}`;
    case 'search':
      return `Search for "${text(step.query) ?? ''}"`;
    case 'open_path':
      return `Open ${text(step.path) ?? 'that folder'}`;
    case 'list_path':
      return `List ${text(step.path) ?? 'that folder'}`;
    case 'send_message': {
      const who = text(step.recipient);
      return `Send WhatsApp message${who ? ` to ${who}` : ''}`;
    }
    case 'system':
      return `${(text(step.action) ?? 'system action').replace(/^\w/, (c) => c.toUpperCase())} the PC`;
    case 'query_time':
      return 'Check the time';
    case 'query_date':
      return 'Check the date';
    case 'wait':
      return `Wait ${digits(step.seconds) ?? 1}s`;
    case 'pilot':
      return `Replay "${text(step.workflow) ?? ''}" on screen`;
    default:
      return kind;
  }
}

/**
 * Turn one model-proposed step into a Task, or null if it does not survive
 * validation. Returning null is the normal case for bad output, not an error.
 */
export function validateStep(raw: unknown): Task | null {
  if (!raw || typeof raw !== 'object') return null;
  const step = raw as Record<string, unknown>;

  const name = text(step.intent) ?? text(step.kind) ?? text(step.action_type);
  if (!name) return null;

  const intent = INTENTS[name.toLowerCase() as IntentName];
  if (!intent) return null;

  const kind = intent.kind as TaskKind;
  const task: Task = {
    id: uid(),
    kind,
    label: label(kind, step),
    status: 'pending',
  };

  switch (kind) {
    case 'open_app': {
      const app = text(step.app) ?? text(step.target);
      if (!app) return null;
      task.target = app.toLowerCase();
      task.profile = text(step.profile);
      break;
    }

    case 'open_site': {
      const site = text(step.site) ?? text(step.target);
      const href = url(step.url) ?? url(site);
      if (!href) return null;
      task.url = href;
      task.target = site ?? href;
      break;
    }

    case 'search': {
      const query = text(step.query);
      if (!query) return null;
      task.query = query;
      break;
    }

    case 'open_path':
    case 'list_path': {
      const where = text(step.path) ?? text(step.target);
      if (!where) return null;
      task.pathQuery = where;
      task.target = where;
      break;
    }

    case 'send_message': {
      const message = text(step.message);
      const recipient = text(step.recipient);
      // A half-specified message is legitimate: the executor pauses and asks,
      // exactly as it does for the rule-based planner.
      const missing: Array<'recipient' | 'message'> = [];
      if (!recipient) missing.push('recipient');
      if (!message) missing.push('message');
      task.recipient = recipient;
      task.message = message;
      task.channel = 'whatsapp';
      if (missing.length) {
        task.missing = missing;
        task.status = 'blocked';
      }
      break;
    }

    case 'system': {
      const action = (text(step.action) ?? '').toLowerCase();
      if (!SYSTEM_ACTIONS.includes(action as (typeof SYSTEM_ACTIONS)[number])) return null;
      task.action = action;
      break;
    }

    case 'wait': {
      task.seconds = digits(step.seconds) ?? 1;
      break;
    }

    case 'pilot': {
      const workflow = text(step.workflow) ?? text(step.target);
      if (!workflow) {
        task.missing = ['workflow'];
        task.status = 'blocked';
        break;
      }
      task.workflow = workflow;
      task.target = workflow;
      break;
    }

    default:
      break;
  }

  // Set here, from the kind, never from anything the model said.
  if (DANGEROUS_KINDS.has(kind)) task.dangerous = true;

  return task;
}

/** Validate a whole proposed plan. Returns [] when nothing survives. */
export function validatePlan(raw: unknown): Task[] {
  const list = Array.isArray(raw)
    ? raw
    : raw && typeof raw === 'object' && Array.isArray((raw as { steps?: unknown }).steps)
      ? (raw as { steps: unknown[] }).steps
      : [];

  const tasks: Task[] = [];
  for (const entry of list.slice(0, MAX_STEPS)) {
    const task = validateStep(entry);
    if (task) tasks.push(task);
  }
  return tasks;
}

/**
 * Pull the JSON out of whatever the model wrote around it.
 *
 * Small instruct models routinely wrap output in prose or a fenced block even
 * when told not to, so extracting is more reliable than insisting.
 */
export function extractJson(output: string): unknown {
  const text = String(output ?? '').trim();

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidates = [fenced?.[1], text];

  for (const candidate of candidates) {
    if (!candidate) continue;
    const trimmed = candidate.trim();
    try {
      return JSON.parse(trimmed);
    } catch {
      /* try harder below */
    }
    // Fall back to the outermost array or object in the string.
    const start = trimmed.search(/[[{]/);
    const end = Math.max(trimmed.lastIndexOf(']'), trimmed.lastIndexOf('}'));
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch {
        /* genuinely unparseable */
      }
    }
  }
  return null;
}
