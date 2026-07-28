'use client';

import { useEffect, useState } from 'react';
import { useJarvisStore } from '@/lib/store';
import ProgressRing from './ProgressRing';
import { ChromeIcon, PlayIcon, CodeIcon, NoteIcon, ClockIcon, PowerIcon, LogsIcon } from './Icons';
import { formatTime } from '@/lib/utils';
import type { View } from './Sidebar';

interface Stats {
  cpu: number;
  ram: number;
  disk: number;
}

const QUICK_ACTIONS: { label: string; command: string; icon: typeof ChromeIcon; danger?: boolean }[] = [
  { label: 'Open Chrome', command: 'open chrome', icon: ChromeIcon },
  { label: 'Open YouTube', command: 'open youtube', icon: PlayIcon },
  { label: 'Open VS Code', command: 'open vs code', icon: CodeIcon },
  { label: 'Open Notepad', command: 'open notepad', icon: NoteIcon },
  { label: 'Show Time', command: 'what time is it', icon: ClockIcon },
  { label: 'Shutdown PC', command: 'shutdown pc', icon: PowerIcon, danger: true },
];

export default function StatusPanel({ onSelect }: { onSelect: (v: View) => void }) {
  const [stats, setStats] = useState<Stats>({ cpu: 23, ram: 45, disk: 62 });
  const memory = useJarvisStore((s) => s.memory);
  const sendMessage = useJarvisStore((s) => s.sendMessage);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      if (typeof window !== 'undefined' && window.jarvis?.isElectron) {
        try {
          const s = await window.jarvis.getStats();
          if (!cancelled) setStats((prev) => ({ ...prev, ram: s.memUsedPercent, cpu: prev.cpu }));
        } catch {
          /* ignore */
        }
      } else {
        // Lightweight simulated fluctuation when running outside Electron (browser dev mode)
        if (!cancelled) {
          setStats((prev) => ({
            cpu: clamp(prev.cpu + (Math.random() * 10 - 5)),
            ram: clamp(prev.ram + (Math.random() * 6 - 3)),
            disk: clamp(prev.disk + (Math.random() * 2 - 1)),
          }));
        }
      }
    }

    poll();
    const id = setInterval(poll, 4000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const recentLogs = memory.logs.slice(0, 5);

  return (
    <aside className="w-[260px] shrink-0 h-full overflow-y-auto flex flex-col gap-3 p-3">
      {/* System status */}
      <div className="glass-panel rounded-xl p-3.5">
        <div className="flex items-center justify-between mb-2.5">
          <h3 className="font-semibold text-[15px]">System Status</h3>
          <span style={{ color: 'var(--jarvis-accent-2)' }}>
            <ClockIcon width={16} height={16} />
          </span>
        </div>
        <div className="flex items-center justify-between">
          <ProgressRing percent={stats.cpu} color="var(--jarvis-success)" label="CPU" sublabel="Normal" />
          <ProgressRing percent={stats.ram} color="var(--jarvis-accent)" label="RAM" sublabel="Normal" />
          <ProgressRing percent={stats.disk} color="var(--jarvis-purple)" label="DISK" sublabel="Normal" />
        </div>
      </div>

      {/* Quick actions */}
      <div className="glass-panel rounded-xl p-3.5">
        <h3 className="font-semibold text-[13px] mb-2.5 flex items-center gap-1.5">
          <span>⚡</span> Quick Actions
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {QUICK_ACTIONS.map((qa) => {
            const Icon = qa.icon;
            return (
              <button
                key={qa.label}
                onClick={() => sendMessage(qa.command)}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-[11.5px] font-medium glass-panel hover:brightness-110 active:scale-[0.97]"
                style={qa.danger ? { color: 'var(--jarvis-danger)', borderColor: 'color-mix(in srgb, var(--jarvis-danger) 40%, var(--jarvis-border))' } : undefined}
              >
                <Icon width={14} height={14} />
                <span className="truncate">{qa.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Recent logs */}
      <div className="glass-panel rounded-xl p-3.5 flex-1">
        <div className="flex items-center justify-between mb-2.5">
          <h3 className="font-semibold text-[13px] flex items-center gap-1.5">
            <LogsIcon width={16} height={16} /> Recent Logs
          </h3>
          <button onClick={() => onSelect('logs')} className="text-xs font-medium" style={{ color: 'var(--jarvis-accent)' }}>
            View All
          </button>
        </div>
        <div className="flex flex-col gap-2">
          {recentLogs.length === 0 && (
            <p className="text-xs" style={{ color: 'var(--jarvis-subtext)' }}>
              No activity yet — try a command.
            </p>
          )}
          {recentLogs.map((log) => (
            <div key={log.id} className="flex items-center gap-2 text-[11px]">
              <span style={{ color: 'var(--jarvis-subtext)' }} className="w-12 shrink-0 tabular-nums">
                {formatTime(new Date(log.timestamp))}
              </span>
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{
                  backgroundColor:
                    log.status === 'success' ? 'var(--jarvis-success)' : log.status === 'error' ? 'var(--jarvis-danger)' : 'var(--jarvis-accent)',
                }}
              />
              <span className="truncate">{log.action}</span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}

function clamp(n: number) {
  return Math.min(96, Math.max(4, n));
}
