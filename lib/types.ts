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
}

export interface JarvisMemory {
  last_command: string;
  last_app: string;
  custom_commands: Record<string, string>;
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

export type IntentType =
  | 'open_app'
  | 'open_url'
  | 'open_generic_app'
  | 'open_generic_site'
  | 'web_search'
  | 'system_action'
  | 'query_time'
  | 'query_date'
  | 'context_repeat'
  | 'confirm_yes'
  | 'confirm_no'
  | 'learned_command'
  | 'unknown';

export interface Intent {
  type: IntentType;
  target?: string;
  raw: string;
  requiresConfirmation?: boolean;
}

declare global {
  interface Window {
    jarvis?: {
      isElectron: boolean;
      getMemory: () => Promise<JarvisMemory>;
      setMemory: (data: JarvisMemory) => Promise<boolean>;
      openApp: (appKey: string) => Promise<ActionResult>;
      openUrl: (url: string) => Promise<ActionResult>;
      openCustom: (target: string) => Promise<ActionResult>;
      systemAction: (action: string) => Promise<ActionResult>;
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
