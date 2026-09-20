/**
 * Pilot's data model.
 *
 * The distinction that matters here: a recorded step stores a *description* of
 * what was acted on, never a pair of coordinates. Coordinates are resolved
 * fresh on every replay, so a workflow survives a moved window, a different
 * screen resolution and a rearranged toolbar. Replaying pixels would not.
 */

/** One addressable control, as the accessibility tree reports it. */
export interface UiElement {
  /** The accessible name — the label a screen reader would announce. */
  name: string;
  /** Control type with the "ControlType." prefix stripped: Button, Edit, … */
  role: string;
  /** AutomationId: stable across localisation when the app bothers to set it. */
  id: string;
  /** Win32 class name. Useful when name and id are both empty. */
  cls: string;
  help: string;
  enabled: boolean;
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * How a step names its target.
 *
 * Every field is optional and every field that is present is evidence. The
 * grounder scores candidates against all of them rather than requiring an
 * exact match on any one, because the accessibility tree is inconsistent
 * enough that insisting on a single field fails constantly.
 */
export interface TargetDescriptor {
  /** What the user would call it: "Save", "Invoice number". */
  name?: string;
  role?: string;
  id?: string;
  cls?: string;
  /** Disambiguates identical controls: the 2nd "Delete" on screen. */
  nth?: number;
  /**
   * Where it was when recorded, as a fraction of the window (0..1). Used only
   * to break ties between equally good name matches — never on its own.
   */
  at?: { x: number; y: number };
}

export type PilotStepKind =
  | 'focus_window'
  | 'click'
  | 'type'
  | 'key'
  | 'scroll'
  | 'wait'
  | 'wait_for'
  | 'assert'
  | 'write_file'
  | 'move_file'
  | 'delete_file';

/** One step of a recorded workflow. */
export interface PilotStep {
  id: string;
  kind: PilotStepKind;
  /** Shown in the dry run and the live timeline. */
  label: string;

  /** click / assert / wait_for */
  target?: TargetDescriptor;
  /** click */
  button?: 'left' | 'right' | 'middle';
  double?: boolean;
  /** type */
  text?: string;
  /** key — SendKeys syntax: "^s", "{ENTER}", "%{TAB}" */
  keys?: string;
  /** scroll — notches, negative is down */
  amount?: number;
  /** wait */
  seconds?: number;
  /** wait_for / assert — how long to keep looking */
  timeoutMs?: number;
  /** focus_window — matched against the window title */
  window?: string;
  /** file steps */
  path?: string;
  to?: string;
  content?: string;

  /** Free-form note carried from recording. */
  note?: string;
}

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  /** The application this was recorded against, for the dry run's header. */
  app?: string;
  steps: PilotStep[];
  createdAt: number;
  savedAt?: number;
  runCount?: number;
  lastRun?: { at: number; success: boolean; ms: number; steps: number };
}

export type StepStatus = 'pending' | 'running' | 'done' | 'failed' | 'skipped' | 'blocked' | 'stopped';

/** What happened to one step, including the numbers worth publishing. */
export interface StepRun {
  stepId: string;
  index: number;
  label: string;
  status: StepStatus;
  /** Wall clock for the whole step: grounding + action + verification. */
  ms: number;
  /** Time spent finding the target. Usually the bulk of `ms`. */
  groundMs?: number;
  /** 0..1 from the grounder. */
  confidence?: number;
  source?: GroundSource;
  message?: string;
  /** Set when the guard had an opinion. */
  verdict?: 'allow' | 'confirm' | 'block';
  /** Attempts used, when the step had to be retried. */
  attempts?: number;
}

export interface RunReport {
  runId: string;
  workflowId: string;
  workflowName: string;
  startedAt: number;
  ms: number;
  steps: StepRun[];
  status: 'running' | 'done' | 'failed' | 'stopped' | 'blocked' | 'awaiting-approval';
  /** Set when a run halted: 'user', 'shortcut', 'guard', or a step label. */
  haltedBy?: string;
  message?: string;
  /** Set when the run is paused on a 'confirm' verdict. */
  pendingApproval?: { stepIndex: number; question: string };
}

export type GroundSource = 'a11y' | 'vision' | 'window' | 'none';

/** What the grounder concluded about one target. */
export interface GroundResult {
  ok: boolean;
  /** Click point: the centre of the matched element. */
  x: number;
  y: number;
  element?: UiElement;
  /** 0..1. Below the runner's floor, the step refuses rather than guesses. */
  confidence: number;
  source: GroundSource;
  /** Runners-up, for the "why did it click that?" panel. */
  candidates: Array<{ element: UiElement; score: number }>;
  ms: number;
  reason?: string;
}

/** A recording in progress, before it becomes a Workflow. */
export interface Recording {
  name: string;
  app?: string;
  startedAt: number;
  steps: PilotStep[];
}
