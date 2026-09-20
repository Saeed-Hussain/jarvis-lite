import type { JarvisMemory } from './types';

const LOCAL_KEY = 'jarvis-lite-memory';

export const DEFAULT_MEMORY: JarvisMemory = {
  last_command: '',
  last_app: '',
  custom_commands: {},
  contacts: {},
  last_path: '',
  logs: [],
};

export async function loadMemory(): Promise<JarvisMemory> {
  if (typeof window === 'undefined') return { ...DEFAULT_MEMORY };

  if (window.jarvis?.isElectron) {
    try {
      const stored = await window.jarvis.getMemory();
      return { ...DEFAULT_MEMORY, ...stored };
    } catch {
      return { ...DEFAULT_MEMORY };
    }
  }

  try {
    const raw = window.localStorage.getItem(LOCAL_KEY);
    if (raw) return { ...DEFAULT_MEMORY, ...JSON.parse(raw) };
  } catch {
    /* malformed or unavailable storage - start clean */
  }
  return { ...DEFAULT_MEMORY };
}

export async function saveMemory(memory: JarvisMemory): Promise<void> {
  if (typeof window === 'undefined') return;

  if (window.jarvis?.isElectron) {
    try {
      await window.jarvis.setMemory(memory);
    } catch {
      /* the main process logs the real failure */
    }
    return;
  }

  try {
    window.localStorage.setItem(LOCAL_KEY, JSON.stringify(memory));
  } catch {
    /* quota exceeded or storage disabled - non-fatal */
  }
}

export function learnCommand(memory: JarvisMemory, trigger: string, mappedAction: string): JarvisMemory {
  return {
    ...memory,
    custom_commands: { ...memory.custom_commands, [trigger]: mappedAction },
  };
}

export function rememberContact(memory: JarvisMemory, name: string, phone: string): JarvisMemory {
  return { ...memory, contacts: { ...memory.contacts, [name]: phone } };
}

/** Keep only the most recent N log entries so memory.json stays small. */
export function appendLog(memory: JarvisMemory, log: JarvisMemory['logs'][number], max = 100): JarvisMemory {
  return { ...memory, logs: [log, ...memory.logs].slice(0, max) };
}
