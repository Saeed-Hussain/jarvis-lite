'use client';

import { useJarvisStore } from '@/lib/store';
import { MemoryIcon } from './Icons';

export default function MemoryView() {
  const memory = useJarvisStore((s) => s.memory);
  const customEntries = Object.entries(memory.custom_commands);

  return (
    <div className="flex-1 overflow-y-auto p-5 max-w-2xl">
      <h2 className="text-[15px] font-semibold mb-1 flex items-center gap-2">
        <MemoryIcon width={18} height={18} /> Memory
      </h2>
      <p className="text-sm mb-4" style={{ color: 'var(--jarvis-subtext)' }}>
        Persisted to a local JSON file — this is how Jarvis stays context-aware between commands.
      </p>

      <div className="glass-panel rounded-lg p-3.5 flex flex-col gap-3 mb-2 text-sm">
        <div className="flex items-center justify-between">
          <span style={{ color: 'var(--jarvis-subtext)' }}>Last Command</span>
          <span className="font-medium">{memory.last_command || '—'}</span>
        </div>
        <div className="flex items-center justify-between">
          <span style={{ color: 'var(--jarvis-subtext)' }}>Last App / Context</span>
          <span className="font-medium">{memory.last_app || '—'}</span>
        </div>
        <div className="flex items-center justify-between">
          <span style={{ color: 'var(--jarvis-subtext)' }}>Logged Events</span>
          <span className="font-medium">{memory.logs.length}</span>
        </div>
        <div className="flex items-center justify-between">
          <span style={{ color: 'var(--jarvis-subtext)' }}>Learned Commands</span>
          <span className="font-medium">{customEntries.length}</span>
        </div>
      </div>

      <h3 className="text-sm font-semibold mb-2">Raw custom_commands</h3>
      <pre className="glass-panel rounded-lg p-3 text-xs overflow-x-auto" style={{ color: 'var(--jarvis-subtext)' }}>
        {JSON.stringify(memory.custom_commands, null, 2)}
      </pre>
    </div>
  );
}
