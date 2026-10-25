'use client';

import { useJarvisStore } from '@/lib/store';
import { formatTime, formatDate } from '@/lib/utils';
import './views.css';

export default function LogsView() {
  const memory = useJarvisStore((s) => s.memory);

  return (
    <div className="v-page">
      <div className="v-page-inner">
        <header className="v-head">
          <div>
            <h1>Decision logs</h1>
            <p className="sub">Every observe → decide → act cycle Jarvis runs is recorded here.</p>
          </div>
          <span className="chip">{formatDate()}</span>
        </header>

        {memory.logs.length === 0 ? (
          <section className="glass v-card">
            <p className="v-empty">No logs yet — send a command from Chat or the dashboard.</p>
          </section>
        ) : (
          <section className="glass v-card flush">
            <div className="overflow-x-auto">
              <table className="v-table">
                <thead>
                  <tr>
                    <th className="label-caps">Time</th>
                    <th className="label-caps">Input</th>
                    <th className="label-caps">Decision</th>
                    <th className="label-caps">Action / result</th>
                    <th className="label-caps">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {memory.logs.map((log) => (
                    <tr key={log.id}>
                      <td className="v-mono whitespace-nowrap">{formatTime(new Date(log.timestamp))}</td>
                      <td>{log.input}</td>
                      <td className="mono" style={{ fontSize: 12, color: 'var(--ink-2)' }}>
                        {log.decision}
                      </td>
                      <td style={{ color: 'var(--ink-2)' }}>{log.action}</td>
                      <td>
                        <span
                          className="v-pill"
                          style={
                            {
                              ['--tone' as string]:
                                log.status === 'success' ? 'var(--good)' : log.status === 'error' ? 'var(--bad)' : 'var(--accent-ink)',
                            } as React.CSSProperties
                          }
                        >
                          {log.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
