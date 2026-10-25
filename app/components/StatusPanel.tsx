'use client';

import { useEffect, useState } from 'react';
import { useJarvisStore } from '@/lib/store';
import ProgressRing from './ProgressRing';
import { ChromeIcon, PlayIcon, CodeIcon, NoteIcon, ClockIcon, PowerIcon, LogsIcon, SystemIcon, SparkIcon } from './Icons';
import { formatTime } from '@/lib/utils';
import { isVisible } from '@/lib/visibility';
import type { View } from './Sidebar';
import './views.css';

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
      if (!isVisible()) return;
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
    <aside className="v-side">
      {/* System status */}
      <div className="glass v-card">
        <div className="v-card-head">
          <h3 className="v-card-title">
            <SystemIcon width={16} height={16} /> System
          </h3>
        </div>
        <div className="v-rings">
          <ProgressRing percent={stats.cpu} color="var(--good)" label="CPU" sublabel="Normal" />
          <ProgressRing percent={stats.ram} color="var(--accent)" label="RAM" sublabel="Normal" />
          <ProgressRing percent={stats.disk} color="var(--think)" label="Disk" sublabel="Normal" />
        </div>
      </div>

      {/* Quick actions */}
      <div className="glass v-card">
        <div className="v-card-head">
          <h3 className="v-card-title">
            <SparkIcon width={16} height={16} /> Quick actions
          </h3>
        </div>
        <div className="v-grid two">
          {QUICK_ACTIONS.map((qa) => {
            const Icon = qa.icon;
            return (
              <button
                key={qa.label}
                onClick={() => sendMessage(qa.command)}
                className={`v-tile sm${qa.danger ? ' danger' : ''}`}
              >
                <Icon width={15} height={15} style={{ flex: 'none', color: qa.danger ? undefined : 'var(--ink-3)' }} />
                <span className="truncate">{qa.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Recent logs */}
      <div className="glass v-card flex-1">
        <div className="v-card-head">
          <h3 className="v-card-title">
            <LogsIcon width={16} height={16} /> Recent activity
          </h3>
          <button onClick={() => onSelect('logs')} className="btn ghost sm" style={{ height: 26, padding: '0 10px', color: 'var(--accent-ink)' }}>
            View all
          </button>
        </div>
        <div className="flex flex-col gap-2.5">
          {recentLogs.length === 0 && <p className="v-caption">No activity yet — try a command.</p>}
          {recentLogs.map((log) => (
            <div key={log.id} className="flex items-center gap-2.5 text-[12.5px]">
              <span className="v-mono w-11 shrink-0">{formatTime(new Date(log.timestamp))}</span>
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{
                  backgroundColor: log.status === 'success' ? 'var(--good)' : log.status === 'error' ? 'var(--bad)' : 'var(--accent)',
                }}
              />
              <span className="truncate" style={{ color: 'var(--ink-2)' }}>
                {log.action}
              </span>
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
