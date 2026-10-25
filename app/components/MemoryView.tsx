'use client';

import { useJarvisStore } from '@/lib/store';
import { MemoryIcon, UserIcon, CodeIcon } from './Icons';
import './views.css';

export default function MemoryView() {
  const memory = useJarvisStore((s) => s.memory);
  const customEntries = Object.entries(memory.custom_commands);
  const contactEntries = Object.entries(memory.contacts ?? {});

  return (
    <div className="v-page">
      <div className="v-page-inner narrow">
        <header className="v-head">
          <div>
            <h1>Memory</h1>
            <p className="sub">Persisted to a local JSON file — this is how Jarvis stays context-aware between commands.</p>
          </div>
        </header>

        <section className="glass v-card">
          <div className="v-card-head">
            <h2 className="v-card-title">
              <MemoryIcon width={16} height={16} /> Context
            </h2>
          </div>
          <div className="v-stats">
            <div className="v-stat">
              <small>Last command</small>
              <b title={memory.last_command || undefined}>{memory.last_command || '—'}</b>
            </div>
            <div className="v-stat">
              <small>Last app / context</small>
              <b title={memory.last_app || undefined}>{memory.last_app || '—'}</b>
            </div>
            <div className="v-stat">
              <small>Logged events</small>
              <b className="tnum">{memory.logs.length}</b>
            </div>
            <div className="v-stat">
              <small>Learned commands</small>
              <b className="tnum">{customEntries.length}</b>
            </div>
            <div className="v-stat">
              <small>Saved contacts</small>
              <b className="tnum">{contactEntries.length}</b>
            </div>
          </div>
        </section>

        <section className="glass v-card">
          <div className="v-card-head">
            <h2 className="v-card-title">
              <UserIcon width={16} height={16} /> Contacts
            </h2>
          </div>
          {contactEntries.length === 0 ? (
            <p className="v-caption">
              None yet. The first time you say &ldquo;text sara …&rdquo; Jarvis asks for the number,
              then remembers it.
            </p>
          ) : (
            <div className="v-list">
              {contactEntries.map(([name, phone]) => (
                <div key={name} className="v-row">
                  <span style={{ fontWeight: 560 }}>{name}</span>
                  <span className="v-row-v mono" style={{ fontWeight: 400, fontSize: 12.5, color: 'var(--ink-2)' }}>
                    {phone}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="glass v-card">
          <div className="v-card-head">
            <h2 className="v-card-title">
              <CodeIcon width={16} height={16} /> Raw custom_commands
            </h2>
          </div>
          <pre className="v-pre">{JSON.stringify(memory.custom_commands, null, 2)}</pre>
        </section>
      </div>
    </div>
  );
}
