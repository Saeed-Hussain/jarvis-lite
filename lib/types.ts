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
  /** The plan this reply executed, rendered as a step timeline in the chat. */
  plan?: Plan;
}

export interface JarvisMemory {
  last_command: string;
  last_app: string;
  custom_commands: Record<string, string>;
  /** Contact name -> phone number, learned the first time you message someone. */
  contacts: Record<string, string>;
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
  /** Requires an explicit yes before running. */
  dangerous?: boolean;
  /** Free-form note (why it was skipped, what failed). */
  note?: string;
  /** Slots the user still has to supply before this task can run. */
  missing?: Array<'recipient' | 'message'>;
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
    };
  }
}
