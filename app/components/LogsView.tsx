'use client';

import { useJarvisStore } from '@/lib/store';
import { formatTime, formatDate } from '@/lib/utils';

export default function LogsView() {
  const memory = useJarvisStore((s) => s.memory);

  return (
    <div className="flex-1 overflow-y-auto p-5">
      <h2 className="text-[15px] font-semibold mb-1">Decision Logs</h2>
      <p className="text-sm mb-2" style={{ color: 'var(--jarvis-subtext)' }}>
        Every observe → decide → act cycle Jarvis runs is recorded here.
      </p>

      {memory.logs.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--jarvis-subtext)' }}>
          No logs yet — send a command from Chat or the dashboard.
        </p>
      ) : (
        <div className="glass-panel rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b" style={{ borderColor: 'var(--jarvis-border)' }}>
                <th className="px-4 py-3 font-medium" style={{ color: 'var(--jarvis-subtext)' }}>Time</th>
                <th className="px-4 py-3 font-medium" style={{ color: 'var(--jarvis-subtext)' }}>Input</th>
                <th className="px-4 py-3 font-medium" style={{ color: 'var(--jarvis-subtext)' }}>Decision</th>
                <th className="px-4 py-3 font-medium" style={{ color: 'var(--jarvis-subtext)' }}>Action / Result</th>
                <th className="px-4 py-3 font-medium" style={{ color: 'var(--jarvis-subtext)' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {memory.logs.map((log) => (
                <tr key={log.id} className="border-b last:border-0" style={{ borderColor: 'var(--jarvis-border)' }}>
                  <td className="px-4 py-3 whitespace-nowrap" style={{ color: 'var(--jarvis-subtext)' }}>
                    {formatTime(new Date(log.timestamp))}
                  </td>
                  <td className="px-4 py-3">{log.input}</td>
                  <td className="px-4 py-3 font-mono text-xs">{log.decision}</td>
                  <td className="px-4 py-3">{log.action}</td>
                  <td className="px-4 py-3">
                    <span
                      className="px-2 py-0.5 rounded-full text-xs font-medium"
                      style={{
                        backgroundColor:
                          log.status === 'success'
                            ? 'color-mix(in srgb, var(--jarvis-success) 18%, transparent)'
                            : log.status === 'error'
                            ? 'color-mix(in srgb, var(--jarvis-danger) 18%, transparent)'
                            : 'color-mix(in srgb, var(--jarvis-accent) 18%, transparent)',
                        color: log.status === 'success' ? 'var(--jarvis-success)' : log.status === 'error' ? 'var(--jarvis-danger)' : 'var(--jarvis-accent)',
                      }}
                    >
                      {log.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs mt-4" style={{ color: 'var(--jarvis-subtext)' }}>
        {formatDate()}
      </p>
    </div>
  );
}
