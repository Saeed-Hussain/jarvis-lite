/**
 * The step loop.
 *
 * Runs a recorded workflow one step at a time: find the target, check the
 * guard, act, then check that the screen reacted. It mirrors the shape of
 * lib/executor.ts on purpose — it pauses rather than fails when it needs the
 * user, and the caller resumes it — so Pilot pauses through the same chat
 * conversation the rest of Jarvis already uses.
 *
 * Three rules do most of the work:
 *
 *   1. Never act on a guess. A target that grounds below the confidence floor,
 *      or that ties with another candidate, fails the step with a reason. An
 *      agent that clicks when it is unsure is worse than one that stops.
 *   2. Notice that nothing happened. A click that leaves the screen identical
 *      is retried once, and the second silence is reported rather than papered
 *      over — this is how "the dialog never opened" stops the run instead of
 *      the next eight steps typing into the wrong window.
 *   3. Stop means stop. The flag lives in the main process and is re-read
 *      before every step and inside every wait.
 */

import type {
  GroundResult,
  PilotStep,
  RunReport,
  StepRun,
  TargetDescriptor,
  UiElement,
  Workflow,
} from './types';
import { CONFIDENCE_FLOOR, ground, targetLabel } from './grounder';
import { groundByVision, visionAvailable } from './vision';
import { uid } from '../utils';

const pilot = () => (typeof window !== 'undefined' ? window.jarvis?.pilot : undefined);

/** A step that grounds below this refuses rather than clicks. */
const FLOOR = CONFIDENCE_FLOOR;

/** One retry, then report. More than that just repeats a wrong assumption. */
const MAX_ATTEMPTS = 2;

/** How long a `wait_for` keeps looking before giving up. */
const DEFAULT_WAIT_FOR_MS = 8000;

/** Vision, when it exists, gets this long before the step fails instead. */
const VISION_BUDGET_MS = 1200;

export interface RunOptions {
  /** Step ids the user has approved a 'confirm' verdict for, this run. */
  approved?: Set<string>;
  /** Resume a paused run: steps already finished, and where to pick up. */
  priorSteps?: StepRun[];
  startAt?: number;
  /** Existing run id, so a resumed run stays one run in the journal. */
  runId?: string;
  /** Called after every step so the panel can show progress live. */
  onProgress?: (report: RunReport) => void;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function stepRun(step: PilotStep, index: number, patch: Partial<StepRun> = {}): StepRun {
  return { stepId: step.id, index, label: step.label, status: 'pending', ms: 0, ...patch };
}

// ---------------------------------------------------------------------------
// Grounding
// ---------------------------------------------------------------------------

interface WindowRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Resolve a descriptor to a point on screen.
 *
 * The accessibility tree is asked first because it is both cheaper and more
 * precise. Vision is consulted only when the tree has nothing — which is the
 * honest division of labour: the tree is right most of the time and silent the
 * rest of it, and a model that is only asked the hard questions is a model
 * whose latency is affordable.
 */
async function locate(target: TargetDescriptor): Promise<GroundResult> {
  const api = pilot();
  const started = Date.now();
  if (!api) {
    return { ok: false, x: 0, y: 0, confidence: 0, source: 'none', candidates: [], ms: 0, reason: 'Pilot is not available outside the desktop app' };
  }

  const where = await api.foreground();
  const tree = await api.tree({ handle: 0, maxNodes: 600 });
  if (!tree.ok) {
    return { ok: false, x: 0, y: 0, confidence: 0, source: 'none', candidates: [], ms: Date.now() - started, reason: tree.error };
  }

  const elements: UiElement[] = tree.data.elements ?? [];
  const rect: WindowRect | undefined =
    where.w > 0 ? { x: where.x, y: where.y, w: where.w, h: where.h } : undefined;

  const byTree = ground(target, elements, { window: rect, ms: Date.now() - started });
  if (byTree.ok) return byTree;

  // The tree did not identify it. This is where Pilot's second phase lives;
  // until a local vision grounder is registered, the step fails with the
  // tree's own reason rather than a guess.
  if (!visionAvailable()) {
    return { ...byTree, ms: Date.now() - started };
  }

  const frame = await api.capture({ full: true });
  if (!frame.ok || !frame.data.image) return { ...byTree, ms: Date.now() - started };

  const byVision = await groundByVision({
    target,
    image: frame.data.image,
    width: frame.data.width,
    height: frame.data.height,
    budgetMs: VISION_BUDGET_MS,
  });
  return byVision.ok && byVision.confidence >= FLOOR
    ? { ...byVision, ms: Date.now() - started }
    : { ...byTree, ms: Date.now() - started };
}

/** Keep looking until it appears, or the budget runs out. */
async function waitFor(target: TargetDescriptor, timeoutMs: number): Promise<GroundResult> {
  const deadline = Date.now() + timeoutMs;
  let last = await locate(target);
  while (!last.ok && Date.now() < deadline) {
    if (await halted()) break;
    await sleep(250);
    last = await locate(target);
  }
  return last;
}

async function halted(): Promise<boolean> {
  const state = await pilot()?.stopState();
  return !!state?.stopped;
}

// ---------------------------------------------------------------------------
// One step
// ---------------------------------------------------------------------------

interface StepOutcome {
  status: StepRun['status'];
  message?: string;
  groundMs?: number;
  confidence?: number;
  source?: GroundResult['source'];
  verdict?: StepRun['verdict'];
  /** Set when the guard wants a yes before this step can run. */
  approval?: string;
  /** The click landed but the screen did not move. Triggers the one retry. */
  inert?: boolean;
}

async function runStep(step: PilotStep, approved: boolean, runId: string): Promise<StepOutcome> {
  const api = pilot();
  if (!api) return { status: 'failed', message: 'Pilot needs the desktop app.' };

  switch (step.kind) {
    // --- waiting ----------------------------------------------------------
    case 'wait': {
      const seconds = step.seconds ?? 1;
      // Broken into slices so a stop during a long wait is felt immediately.
      const slices = Math.ceil((seconds * 1000) / 200);
      for (let i = 0; i < slices; i++) {
        if (await halted()) return { status: 'stopped', message: 'Stopped while waiting.' };
        await sleep(200);
      }
      return { status: 'done', message: `Waited ${seconds}s.` };
    }

    case 'wait_for': {
      if (!step.target) return { status: 'failed', message: 'This step has nothing to wait for.' };
      const found = await waitFor(step.target, step.timeoutMs ?? DEFAULT_WAIT_FOR_MS);
      return found.ok
        ? {
            status: 'done',
            message: `${targetLabel(step.target)} appeared.`,
            groundMs: found.ms,
            confidence: found.confidence,
            source: found.source,
          }
        : {
            status: 'failed',
            message: `${targetLabel(step.target)} never appeared — ${found.reason ?? 'not found'}.`,
            groundMs: found.ms,
            confidence: found.confidence,
            source: found.source,
          };
    }

    case 'assert': {
      if (!step.target) return { status: 'failed', message: 'This step has nothing to check.' };
      const found = await waitFor(step.target, step.timeoutMs ?? 2000);
      return found.ok
        ? { status: 'done', message: `${targetLabel(step.target)} is there.`, groundMs: found.ms, confidence: found.confidence, source: found.source }
        : {
            status: 'failed',
            message: `Expected ${targetLabel(step.target)} and it is not on screen — ${found.reason ?? 'not found'}.`,
            groundMs: found.ms,
            confidence: found.confidence,
          };
    }

    // --- windows -----------------------------------------------------------
    case 'focus_window': {
      const wanted = (step.window ?? '').toLowerCase();
      const list = await api.windows();
      if (!list.ok) return { status: 'failed', message: list.error };

      const match = list.data.windows.find(
        (w) => w.title.toLowerCase().includes(wanted) || w.process.toLowerCase() === wanted,
      );
      if (!match) {
        return { status: 'failed', message: `No open window matches "${step.window}". Is the app running?` };
      }
      const res = await api.act({ type: 'focus', handle: match.handle });
      return res.success
        ? { status: 'done', message: `Focused "${match.title}".` }
        : { status: 'failed', message: res.message };
    }

    // --- clicking ----------------------------------------------------------
    case 'click': {
      if (!step.target) return { status: 'failed', message: 'This step has no target.' };

      const found = await locate(step.target);
      if (!found.ok || found.confidence < FLOOR) {
        return {
          status: 'failed',
          message: `I couldn't confidently find ${targetLabel(step.target)} — ${found.reason ?? 'no match'}. I'd rather stop than click the wrong thing.`,
          groundMs: found.ms,
          confidence: found.confidence,
          source: found.source,
        };
      }

      const before = await api.capture();
      const res = await api.act(
        {
          type: 'click',
          x: found.x,
          y: found.y,
          button: step.button ?? 'left',
          double: !!step.double,
          // The guard judges the label that is actually on screen right now,
          // not the one the workflow was recorded with.
          targetName: found.element?.name ?? step.target.name,
        },
        { approved },
      );

      if (res.blocked) return { status: 'blocked', message: res.message, verdict: 'block', groundMs: found.ms, confidence: found.confidence };
      if (res.needsApproval) return { status: 'blocked', message: res.message, verdict: 'confirm', approval: res.question, groundMs: found.ms, confidence: found.confidence };
      if (!res.success) return { status: 'failed', message: res.message, groundMs: found.ms, confidence: found.confidence };

      // Did anything happen? A click that changes nothing usually means it
      // landed on a decoration or a control that was not really ready.
      const after = await api.settle({ baseline: before.ok ? before.data.hash : undefined, timeoutMs: 2500 });
      const inert = after.ok && before.ok && !after.data.changedFrom;

      return {
        status: 'done',
        message: inert
          ? `Clicked ${targetLabel(step.target)}, but the screen did not change.`
          : `Clicked ${targetLabel(step.target)}.`,
        groundMs: found.ms,
        confidence: found.confidence,
        source: found.source,
        verdict: res.verdict,
        inert,
      };
    }

    // --- input -------------------------------------------------------------
    case 'type': {
      const res = await api.act({ type: 'type', text: step.text ?? '' }, { approved });
      if (res.blocked) return { status: 'blocked', message: res.message, verdict: 'block' };
      if (res.needsApproval) return { status: 'blocked', message: res.message, verdict: 'confirm', approval: res.question };
      return res.success
        ? { status: 'done', message: `Typed ${(step.text ?? '').length} characters.`, verdict: res.verdict }
        : { status: 'failed', message: res.message };
    }

    case 'key': {
      const res = await api.act({ type: 'key', keys: step.keys ?? '' }, { approved });
      if (res.blocked) return { status: 'blocked', message: res.message, verdict: 'block' };
      if (res.needsApproval) return { status: 'blocked', message: res.message, verdict: 'confirm', approval: res.question };
      return res.success
        ? { status: 'done', message: `Sent ${step.keys}.`, verdict: res.verdict }
        : { status: 'failed', message: res.message };
    }

    case 'scroll': {
      const res = await api.act({ type: 'scroll', amount: step.amount ?? -3 });
      return res.success ? { status: 'done', message: 'Scrolled.' } : { status: 'failed', message: res.message };
    }

    // --- files -------------------------------------------------------------
    case 'write_file':
    case 'move_file':
    case 'delete_file': {
      // The run id has to travel with the operation: it is what "undo this
      // run" groups the journal entries by.
      const res = await api.act(
        { type: step.kind, path: step.path, to: step.to, content: step.content, runId },
        { approved },
      );
      if (res.blocked) return { status: 'blocked', message: res.message, verdict: 'block' };
      if (res.needsApproval) return { status: 'blocked', message: res.message, verdict: 'confirm', approval: res.question };
      return res.success
        ? { status: 'done', message: res.message, verdict: res.verdict }
        : { status: 'failed', message: res.message };
    }

    default:
      return { status: 'failed', message: `Pilot has no "${(step as PilotStep).kind}" step.` };
  }
}

// ---------------------------------------------------------------------------
// The whole workflow
// ---------------------------------------------------------------------------

/**
 * Run a workflow, or resume one that paused for approval.
 *
 * Always resolves with a report. `status: 'awaiting-approval'` means a guard
 * verdict needs a yes; call again with that step's id in `approved`, the
 * report's steps as `priorSteps`, and `startAt` set to the paused index.
 */
export async function runWorkflow(workflow: Workflow, options: RunOptions = {}): Promise<RunReport> {
  const api = pilot();
  const runId = options.runId ?? uid();
  const startedAt = Date.now();
  const steps: StepRun[] = [...(options.priorSteps ?? [])];
  const approved = options.approved ?? new Set<string>();

  const report = (patch: Partial<RunReport> = {}): RunReport => ({
    runId,
    workflowId: workflow.id,
    workflowName: workflow.name,
    startedAt,
    ms: Date.now() - startedAt,
    steps: [...steps],
    status: 'running',
    ...patch,
  });

  const emit = (patch: Partial<RunReport> = {}) => {
    const snapshot = report(patch);
    options.onProgress?.(snapshot);
    return snapshot;
  };

  if (!api) {
    return emit({ status: 'failed', message: 'Pilot only runs inside the desktop app — the browser cannot see your screen.' });
  }

  // A fresh run clears a stop left over from the last one; a resumed run does
  // not, so a stop pressed while the approval prompt was up still holds.
  if (!options.priorSteps?.length) await api.clearStop();

  const begin = options.startAt ?? 0;
  for (let i = begin; i < workflow.steps.length; i++) {
    const step = workflow.steps[i];

    if (await halted()) {
      for (let j = i; j < workflow.steps.length; j++) {
        steps.push(stepRun(workflow.steps[j], j, { status: 'stopped', message: 'stopped' }));
      }
      const state = await api.stopState();
      return emit({ status: 'stopped', haltedBy: state?.source ?? 'user', message: 'Stopped. Nothing further was done.' });
    }

    const current = stepRun(step, i, { status: 'running' });
    steps.push(current);
    emit();

    const stepStarted = Date.now();
    let outcome = await runStep(step, approved.has(step.id), runId);
    let attempts = 1;

    // Retry once when the click landed but nothing moved. The target is
    // re-grounded, so a control that had not finished appearing gets a second,
    // better-informed attempt rather than a blind repeat.
    while (attempts < MAX_ATTEMPTS && step.kind === 'click' && outcome.status === 'done' && outcome.inert) {
      if (await halted()) break;
      await sleep(300);
      outcome = await runStep(step, approved.has(step.id), runId);
      attempts++;
    }

    Object.assign(current, {
      status: outcome.status,
      message: outcome.message,
      ms: Date.now() - stepStarted,
      groundMs: outcome.groundMs,
      confidence: outcome.confidence,
      source: outcome.source,
      verdict: outcome.verdict,
      attempts,
    });
    emit();

    // --- the guard wants a yes ---------------------------------------------
    if (outcome.approval) {
      return emit({
        status: 'awaiting-approval',
        pendingApproval: { stepIndex: i, question: outcome.approval },
        message: outcome.message,
      });
    }

    // --- the guard said no --------------------------------------------------
    if (outcome.status === 'blocked') {
      for (let j = i + 1; j < workflow.steps.length; j++) {
        steps.push(stepRun(workflow.steps[j], j, { status: 'skipped', message: 'an earlier step was blocked' }));
      }
      return emit({ status: 'blocked', haltedBy: step.label, message: outcome.message });
    }

    if (outcome.status === 'stopped') {
      for (let j = i + 1; j < workflow.steps.length; j++) {
        steps.push(stepRun(workflow.steps[j], j, { status: 'stopped' }));
      }
      return emit({ status: 'stopped', haltedBy: 'user', message: outcome.message });
    }

    // --- it went wrong ------------------------------------------------------
    // Later steps assume this one worked, so running them would be running
    // against a screen that never happened.
    if (outcome.status === 'failed') {
      for (let j = i + 1; j < workflow.steps.length; j++) {
        steps.push(stepRun(workflow.steps[j], j, { status: 'skipped', message: 'an earlier step failed' }));
      }
      return emit({ status: 'failed', haltedBy: step.label, message: outcome.message });
    }
  }

  const finished = emit({ status: 'done', message: `Finished ${workflow.name}.` });
  await api.recordRun(workflow.id, {
    success: true,
    ms: finished.ms,
    steps: workflow.steps.length,
  });
  return finished;
}

// ---------------------------------------------------------------------------
// Dry run
// ---------------------------------------------------------------------------

export interface DryRunRow {
  index: number;
  label: string;
  kind: PilotStep['kind'];
  verdict: 'allow' | 'confirm' | 'block';
  reason?: string;
  /** Whether the target can be found on screen right now. */
  found?: boolean;
  confidence?: number;
  groundMs?: number;
  detail?: string;
}

export interface DryRunReport {
  workflowId: string;
  rows: DryRunRow[];
  window: string;
  /** True when nothing in the plan is blocked. */
  runnable: boolean;
  ms: number;
}

/**
 * Show the plan without doing any of it.
 *
 * This is the thing a serious reviewer looks for first, so it is not a
 * rendering of the recorded steps — it re-grounds every target against the
 * screen as it is right now and says which ones it can actually find. A plan
 * that looks fine but cannot locate step 4 is worth knowing about before the
 * first click, not after the third.
 */
export async function dryRun(workflow: Workflow): Promise<DryRunReport> {
  const api = pilot();
  const started = Date.now();

  if (!api) {
    return {
      workflowId: workflow.id,
      window: '',
      runnable: false,
      ms: 0,
      rows: workflow.steps.map((step, index) => ({
        index,
        label: step.label,
        kind: step.kind,
        verdict: 'allow' as const,
        detail: 'Pilot cannot read the screen outside the desktop app.',
      })),
    };
  }

  const actions = workflow.steps.map((step) => ({
    type: step.kind === 'click' ? 'click' : step.kind,
    text: step.text,
    keys: step.keys,
    path: step.path,
    targetName: step.target?.name,
  }));
  const reviewed = await api.review(actions);

  const rows: DryRunRow[] = [];
  for (let i = 0; i < workflow.steps.length; i++) {
    const step = workflow.steps[i];
    const verdict = reviewed.verdicts[i];
    const row: DryRunRow = {
      index: i,
      label: step.label,
      kind: step.kind,
      verdict: verdict?.verdict ?? 'allow',
      reason: verdict?.reason,
    };

    // Only the first steps' targets are meaningfully checkable: everything
    // after the first click describes a screen that does not exist yet. Saying
    // "not found" about those would be noise, so they are left unjudged.
    const reachable = workflow.steps.slice(0, i).every((s) => s.kind !== 'click' && s.kind !== 'key');
    if (step.target && reachable) {
      const found = await locate(step.target);
      row.found = found.ok;
      row.confidence = found.confidence;
      row.groundMs = found.ms;
      if (!found.ok) row.detail = found.reason;
    }

    rows.push(row);
  }

  return {
    workflowId: workflow.id,
    window: reviewed.context?.windowTitle ?? '',
    runnable: rows.every((r) => r.verdict !== 'block'),
    rows,
    ms: Date.now() - started,
  };
}
