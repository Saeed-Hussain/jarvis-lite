'use client';

import { useJarvisStore } from '@/lib/store';
import { MemoryIcon } from './Icons';

export default function MemoryView() {
  const memory = useJarvisStore((s) => s.memory);
  const customEntries = Object.entries(memory.custom_commands);
  const contactEntries = Object.entries(memory.contacts ?? {});

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
        <div className="flex items-center justify-between">
          <span style={{ color: 'var(--jarvis-subtext)' }}>Saved Contacts</span>
          <span className="font-medium">{contactEntries.length}</span>
        </div>
      </div>

      <h3 className="text-sm font-semibold mb-2 mt-3">Contacts</h3>
      {contactEntries.length === 0 ? (
        <p className="text-xs glass-panel rounded-lg p-3" style={{ color: 'var(--jarvis-subtext)' }}>
          None yet. The first time you say &ldquo;text sara …&rdquo; Jarvis asks for the number,
          then remembers it.
        </p>
      ) : (
        <div className="glass-panel rounded-lg p-3 flex flex-col gap-2 text-sm">
          {contactEntries.map(([name, phone]) => (
            <div key={name} className="flex items-center justify-between">
              <span className="font-medium">{name}</span>
              <span style={{ color: 'var(--jarvis-subtext)' }}>{phone}</span>
            </div>
          ))}
        </div>
      )}

      <h3 className="text-sm font-semibold mb-2 mt-4">Raw custom_commands</h3>
      <pre className="glass-panel rounded-lg p-3 text-xs overflow-x-auto" style={{ color: 'var(--jarvis-subtext)' }}>
        {JSON.stringify(memory.custom_commands, null, 2)}
      </pre>
    </div>
  );
}
