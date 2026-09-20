import type { PilotStep, RunReport, UiElement, Workflow } from './pilot/types';

export type MessageRole = 'user' | 'jarvis';

export interface ActionResult {
  success: boolean;
  message: string;
  appLabel?: string;
  appIcon?: string;
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  text: string;
  timestamp: number;
  result?: ActionResult;
  needsConfirmation?: boolean;
  pendingAction?: string;
  isLearningPrompt?: boolean;
  learningFor?: string;
  /** Renders the "turn on the local model" button under this reply. */
  offerBrain?: boolean;
  /** The plan this reply executed, rendered as a step timeline in the chat. */
  plan?: Plan;
}

export interface JarvisMemory {
  last_command: string;
  last_app: string;
  custom_commands: Record<string, string>;
  /** Contact name -> phone number, learned the first time you message someone. */
  contacts: Record<string, string>;
  /**
   * Where the conversation currently is on disk. "open d drive" sets it, and
   * the next "go to the projects folder" is resolved relative to it — which is
   * what makes a sequence of spoken navigation steps behave like a shell.
   */
  last_path?: string;
  logs: LogEntry[];
}

export interface LogEntry {
  id: string;
  timestamp: number;
  input: string;
  decision: string;
  action: string;
  status: 'success' | 'error' | 'info' | 'pending';
}

// ---------------------------------------------------------------------------
// Agent plan model
// ---------------------------------------------------------------------------

export type TaskKind =
  | 'open_app'
  | 'open_site'
  | 'search'
  | 'send_message'
  | 'system'
  | 'query_time'
  | 'query_date'
  | 'learned'
  | 'wait'
  | 'pilot'
  | 'open_path'
  | 'list_path'
  | 'noop'
  | 'unknown';

export type TaskStatus = 'pending' | 'running' | 'done' | 'failed' | 'skipped' | 'blocked';

/** One executable step in a plan. Produced by the planner, run by the executor. */
export interface Task {
  id: string;
  kind: TaskKind;
  /** Human-readable description shown in the chat timeline. */
  label: string;
  status: TaskStatus;

  // --- slots (only the ones relevant to `kind` are set) ---
  /** App key, site key, or raw name. */
  target?: string;
  /** Browser profile directory name, e.g. "saeed". */
  profile?: string;
  /** Fully-qualified URL for open_site. */
  url?: string;
  /** Search query for `search`. */
  query?: string;
  /** System action verb: shutdown | restart | lock | sleep. */
  action?: string;
  /** Shell command for `learned`. */
  command?: string;
  /** Messaging slots. */
  recipient?: string;
  phone?: string;
  message?: string;
  channel?: 'whatsapp';
  /** Seconds for `wait`. */
  seconds?: number;
  /** Recorded workflow name or id for `pilot`. */
  workflow?: string;
  /** Spoken folder/drive for `open_path` / `list_path`, e.g. "d drive". */
  pathQuery?: string;
  /** Filled in once a `pilot` task has run, so the chat can offer an undo. */
  pilotRun?: RunReport;
  /**
   * One-shot: the user approved the single guarded step the run is paused on.
   * Consumed by the executor, so a second guarded step later in the same
   * workflow still has to be approved on its own.
   */
  pilotApprove?: boolean;
  /** Requires an explicit yes before running. */
  dangerous?: boolean;
  /** Free-form note (why it was skipped, what failed). */
  note?: string;
  /** Slots the user still has to supply before this task can run. */
  missing?: Array<'recipient' | 'message' | 'workflow'>;
  /** Result once executed. */
  result?: ActionResult;
}

export interface Plan {
  id: string;
  input: string;
  hadWakeWord: boolean;
  tasks: Task[];
  createdAt: number;
}

// ---------------------------------------------------------------------------
// Pilot's privileged surface
// ---------------------------------------------------------------------------

/** Every host call answers with one of these rather than throwing. */
export type PilotResult<T> = { ok: true; data: T } | { ok: false; error: string };

export interface PilotWindow {
  handle: number;
  title: string;
  process: string;
  pid: number;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
}

export interface PilotContext {
  windowTitle: string;
  processName: string;
  handle: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** One thing Pilot can be asked to do. Judged by the guard before it runs. */
export interface PilotAction {
  type:
    | 'click'
    | 'type'
    | 'key'
    | 'scroll'
    | 'focus'
    | 'write_file'
    | 'move_file'
    | 'delete_file';
  x?: number;
  y?: number;
  button?: 'left' | 'right' | 'middle';
  double?: boolean;
  text?: string;
  chunkDelayMs?: number;
  keys?: string;
  amount?: number;
  handle?: number;
  /** The on-screen label of a click target, so the guard can judge it. */
  targetName?: string;
  path?: string;
  to?: string;
  content?: string;
  runId?: string;
}

export interface PilotActionResult extends ActionResult {
  ms?: number;
  /** The guard refused outright. There is no override for this. */
  blocked?: boolean;
  /** The guard wants an explicit yes before this runs. */
  needsApproval?: boolean;
  question?: string;
  verdict?: 'allow' | 'confirm' | 'block';
  window?: string;
  /** A hard stop cut this short. */
  halted?: boolean;
  data?: unknown;
}

export interface PilotBridge {
  available: () => Promise<{ available: boolean; reason: string; stopShortcut: string | null }>;
  foreground: () => Promise<PilotContext>;
  tree: (options?: { handle?: number; maxNodes?: number }) => Promise<
    PilotResult<{ elements: UiElement[]; total: number; truncated: boolean; ms: number }>
  >;
  windows: () => Promise<PilotResult<{ windows: PilotWindow[] }>>;
  elementAt: (x: number, y: number) => Promise<
    PilotResult<{ element: UiElement; deepest: UiElement; window: PilotWindow }>
  >;
  pollInput: () => Promise<PilotResult<{ events: unknown[] }>>;

  act: (action: PilotAction, options?: { approved?: boolean }) => Promise<PilotActionResult>;
  capture: (options?: { full?: boolean }) => Promise<
    PilotResult<{ hash: string; width: number; height: number; scale: number; ms: number; image?: string }>
  >;
  settle: (options?: { baseline?: string; timeoutMs?: number; intervalMs?: number }) => Promise<
    PilotResult<{ hash: string; ms: number; changedFrom: boolean; settled: boolean }>
  >;
  /**
   * Judge a plan without running it. The step types here are workflow step
   * kinds, not just actions — `wait` and `assert` have no action to judge and
   * come back allowed, which is what the dry run wants to show.
   */
  review: (steps: Array<{ type: string } & Omit<Partial<PilotAction>, 'type'>>) => Promise<{
    context: PilotContext;
    verdicts: Array<{ index: number; verdict: 'allow' | 'confirm' | 'block'; reason?: string }>;
  }>;

  stop: () => Promise<ActionResult>;
  clearStop: () => Promise<ActionResult>;
  stopState: () => Promise<{ stopped: boolean; at: number; source: string | null }>;

  workflows: () => Promise<Workflow[]>;
  saveWorkflow: (workflow: Workflow) => Promise<ActionResult & { workflow?: Workflow }>;
  deleteWorkflow: (id: string) => Promise<ActionResult>;
  findWorkflow: (nameOrId: string) => Promise<Workflow | null>;
  recordRun: (id: string, summary: { success: boolean; ms: number; steps: number }) => Promise<boolean>;

  journal: (limit?: number) => Promise<
    Array<{
      id: string;
      runId?: string;
      at: number;
      op: 'create' | 'overwrite' | 'delete' | 'move';
      target: string;
      from?: string;
      undone: boolean;
    }>
  >;
  undo: (entryId: string) => Promise<ActionResult>;
  undoRun: (runId: string) => Promise<ActionResult>;

  /** Returns an unsubscribe function. */
  onStopped: (handler: (payload: { source: string; at: number }) => void) => () => void;
}

declare global {
  interface Window {
    jarvis?: {
      isElectron: boolean;
      getMemory: () => Promise<JarvisMemory>;
      setMemory: (data: JarvisMemory) => Promise<boolean>;
      openApp: (appKey: string, options?: { profile?: string; url?: string }) => Promise<ActionResult>;
      openUrl: (url: string) => Promise<ActionResult>;
      openUrlInProfile: (url: string, browser: string, profile?: string) => Promise<ActionResult>;
      openCustom: (target: string) => Promise<ActionResult>;
      openPath: (query: string, base?: string) => Promise<ActionResult & { path?: string; candidates?: string[] }>;
      listPath: (
        query: string,
        base?: string,
      ) => Promise<ActionResult & { path?: string; folders?: string[]; files?: string[] }>;
      resolvePath: (
        query: string,
        base?: string,
      ) => Promise<{ success: boolean; path?: string; candidates?: string[]; message?: string }>;
      systemAction: (action: string) => Promise<ActionResult>;
      sendWhatsApp: (payload: {
        phone?: string;
        message?: string;
        profile?: string;
        autoSend?: boolean;
      }) => Promise<ActionResult>;
      listProfiles: (browser?: string) => Promise<Array<{ dir: string; name: string; email: string }>>;
      createFile: (filePath: string, content: string) => Promise<ActionResult>;
      openFile: (filePath: string) => Promise<ActionResult>;
      getStats: () => Promise<{
        platform: string;
        cpuModel: string;
        cpuCount: number;
        memUsedPercent: number;
        uptime: number;
      }>;
      getDateTime: () => Promise<{ time: string; date: string; iso: string }>;
      minimize: () => Promise<void>;
      maximize: () => Promise<void>;
      close: () => Promise<void>;
      showWindow: () => Promise<void>;
      hideWindow: () => Promise<void>;
      pilot: PilotBridge;
    };
  }
}

export type { PilotStep, Workflow, RunReport, UiElement };
