import type { JarvisMemory } from './types';

const LOCAL_KEY = 'jarvis-lite-memory';

export const DEFAULT_MEMORY: JarvisMemory = {
  last_command: '',
  last_app: '',
  custom_commands: {},
  logs: [],
};

export async function loadMemory(): Promise<JarvisMemory> {
  if (typeof window !== 'undefined' && window.jarvis?.isElectron) {
    return window.jarvis.getMemory();
  }
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(LOCAL_KEY);
      if (raw) return { ...DEFAULT_MEMORY, ...JSON.parse(raw) };
    } catch {
      /* ignore malformed local storage */
    }
  }
  return { ...DEFAULT_MEMORY };
}

export async function saveMemory(memory: JarvisMemory): Promise<void> {
  if (typeof window !== 'undefined' && window.jarvis?.isElectron) {
    await window.jarvis.setMemory(memory);
    return;
  }
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(LOCAL_KEY, JSON.stringify(memory));
  }
}

export function learnCommand(memory: JarvisMemory, trigger: string, mappedAction: string): JarvisMemory {
  return {
    ...memory,
    custom_commands: { ...memory.custom_commands, [trigger]: mappedAction },
  };
}

/** Keep only the most recent N log entries to stay lightweight */
export function appendLog(memory: JarvisMemory, log: JarvisMemory['logs'][number], max = 100): JarvisMemory {
  const logs = [log, ...memory.logs].slice(0, max);
  return { ...memory, logs };
}
