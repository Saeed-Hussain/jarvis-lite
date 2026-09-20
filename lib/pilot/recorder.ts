/**
 * Recording a workflow.
 *
 * "Do it once with the model, then save it as a script that runs without the
 * model at all" — this is that, minus the model, because for a single
 * application the accessibility tree already knows what was clicked.
 *
 * What is recorded is a *description* of each target, resolved again at replay
 * time (see grounder.ts). What is deliberately not recorded is anything the
 * user types: clicks are enough to replay a workflow, and a recorder that
 * captured every keystroke on the machine would be a keylogger with a friendly
 * name. Typed steps are added by hand afterwards, where they are visible and
 * editable.
 */

import type { PilotStep, TargetDescriptor, UiElement, Workflow } from './types';
import { describe, scoreElement, AMBIGUITY_MARGIN, targetLabel } from './grounder';
import { uid } from '../utils';

const pilot = () => (typeof window !== 'undefined' ? window.jarvis?.pilot : undefined);

/** Fast enough to feel instant, slow enough to cost nothing. */
const POLL_MS = 80;

/** Two clicks on the same spot inside this window are one double-click. */
const DOUBLE_CLICK_MS = 400;

export interface RecorderEvents {
  onStep: (step: PilotStep, all: PilotStep[]) => void;
  onError?: (message: string) => void;
}

interface RawClick {
  type: 'click';
  button: 'left' | 'right' | 'middle';
  double: boolean;
  x: number;
  y: number;
  element?: UiElement | null;
  window?: { handle: number; title: string; process: string; x: number; y: number; w: number; h: number } | null;
}

/**
 * Work out whether this element needs an index to be identified later.
 *
 * If the screen holds several controls that the descriptor describes equally
 * well, replay would be a coin flip. Recording which one it was — in reading
 * order — is the difference between a workflow that deletes the right row and
 * one that deletes whichever row the tree happened to list first.
 */
function disambiguate(descriptor: TargetDescriptor, element: UiElement, elements: UiElement[], rect?: { x: number; y: number; w: number; h: number }): number | undefined {
  if (elements.length === 0) return undefined;

  const scored = elements
    .map((el) => ({ el, score: scoreElement(descriptor, el, rect) }))
    .sort((a, b) => b.score - a.score);

  const best = scored[0]?.score ?? 0;
  const equals = scored
    .filter((c) => best - c.score < AMBIGUITY_MARGIN)
    .map((c) => c.el)
    .sort((a, b) => a.y - b.y || a.x - b.x);

  if (equals.length <= 1) return undefined;

  const index = equals.findIndex((el) => el.x === element.x && el.y === element.y && el.name === element.name);
  return index > 0 ? index : index === 0 ? 0 : undefined;
}

function labelFor(step: PilotStep): string {
  switch (step.kind) {
    case 'click':
      return `${step.double ? 'Double-click' : step.button === 'right' ? 'Right-click' : 'Click'} ${targetLabel(step.target)}`;
    case 'type':
      return `Type "${(step.text ?? '').length > 30 ? `${step.text!.slice(0, 29)}…` : step.text}"`;
    case 'key':
      return `Press ${step.keys}`;
    case 'scroll':
      return `Scroll ${(step.amount ?? -3) < 0 ? 'down' : 'up'}`;
    case 'wait':
      return `Wait ${step.seconds ?? 1}s`;
    case 'wait_for':
      return `Wait for ${targetLabel(step.target)}`;
    case 'assert':
      return `Check ${targetLabel(step.target)} is there`;
    case 'focus_window':
      return `Focus the "${step.window}" window`;
    case 'write_file':
      return `Write ${step.path}`;
    case 'move_file':
      return `Move ${step.path} to ${step.to}`;
    case 'delete_file':
      return `Remove ${step.path}`;
    default:
      return step.kind;
  }
}

/** Build a step from any kind, with a label that reads like a sentence. */
export function makeStep(partial: Omit<PilotStep, 'id' | 'label'> & { label?: string }): PilotStep {
  const step = { id: uid(), label: '', ...partial } as PilotStep;
  step.label = partial.label ?? labelFor(step);
  return step;
}

export class Recorder {
  private steps: PilotStep[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastClick = { x: 0, y: 0, at: 0 };
  private busy = false;

  readonly startedAt = Date.now();
  app = '';

  constructor(
    public name: string,
    private events: RecorderEvents,
  ) {}

  get recording(): boolean {
    return this.timer !== null;
  }

  get recorded(): PilotStep[] {
    return [...this.steps];
  }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => void this.tick(), POLL_MS);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** Add a step the recorder cannot see — typing, a key, a deliberate wait. */
  add(partial: Omit<PilotStep, 'id' | 'label'> & { label?: string }): PilotStep {
    const step = makeStep(partial);
    this.steps.push(step);
    this.events.onStep(step, this.recorded);
    return step;
  }

  remove(id: string): void {
    this.steps = this.steps.filter((s) => s.id !== id);
  }

  move(id: string, delta: number): void {
    const index = this.steps.findIndex((s) => s.id === id);
    const next = index + delta;
    if (index < 0 || next < 0 || next >= this.steps.length) return;
    const [step] = this.steps.splice(index, 1);
    this.steps.splice(next, 0, step);
  }

  toWorkflow(description?: string): Workflow {
    return {
      id: '',
      name: this.name,
      description,
      app: this.app || undefined,
      steps: this.recorded,
      createdAt: this.startedAt,
    };
  }

  // -------------------------------------------------------------------------

  private async tick(): Promise<void> {
    // A tick that overlaps the previous one would double-count a click, and
    // reading the tree can take longer than the poll interval.
    if (this.busy) return;
    this.busy = true;
    try {
      const api = pilot();
      if (!api) return;

      const polled = await api.pollInput();
      if (!polled.ok) {
        this.events.onError?.(polled.error);
        return;
      }
      for (const event of polled.data.events as RawClick[]) {
        await this.absorb(event);
      }
    } finally {
      this.busy = false;
    }
  }

  private async absorb(event: RawClick): Promise<void> {
    if (!event.element || !event.element.name) {
      // An unnamed control cannot be described, only pointed at, and a
      // workflow of raw coordinates breaks the first time a window moves.
      this.events.onError?.(
        'That control has no accessible name, so I can\'t record it in a way that will replay reliably. This is the case a local vision model would have to handle.',
      );
      return;
    }

    const now = Date.now();
    const sameSpot = Math.hypot(event.x - this.lastClick.x, event.y - this.lastClick.y) < 6;
    const quick = now - this.lastClick.at < DOUBLE_CLICK_MS;
    this.lastClick = { x: event.x, y: event.y, at: now };

    if (sameSpot && quick && this.steps.length) {
      // Promote the click we already recorded rather than recording a second.
      const previous = this.steps[this.steps.length - 1];
      if (previous.kind === 'click') {
        previous.double = true;
        previous.label = labelFor(previous);
        this.events.onStep(previous, this.recorded);
        return;
      }
    }

    if (!this.app && event.window?.process) this.app = event.window.process;

    const rect = event.window && event.window.w > 0 ? event.window : undefined;
    const descriptor = describe(event.element, rect);

    // Read the tree once, so the recording knows whether this target is
    // ambiguous and needs an index pinned to it.
    const api = pilot();
    const tree = await api?.tree({ handle: event.window?.handle ?? 0, maxNodes: 600 });
    if (tree?.ok) {
      const nth = disambiguate(descriptor, event.element, tree.data.elements ?? [], rect);
      if (typeof nth === 'number' && nth > 0) descriptor.nth = nth;
    }

    // A click that changes which window is in front is worth recording as an
    // explicit focus step: on replay the app may not already be in front.
    if (event.window && this.steps.length === 0) {
      this.add({ kind: 'focus_window', window: event.window.title });
    }

    this.add({
      kind: 'click',
      target: descriptor,
      button: event.button,
      double: event.double,
    });
  }
}
