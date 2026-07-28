'use client';

import { useJarvisStore } from '@/lib/store';
import ProgressRing from './ProgressRing';
import { PowerIcon, SystemIcon } from './Icons';
import { useEffect, useState } from 'react';

export default function SystemView() {
  const sendMessage = useJarvisStore((s) => s.sendMessage);
  const [stats, setStats] = useState({ cpu: 23, ram: 45, disk: 62 });

  useEffect(() => {
    async function load() {
      if (typeof window !== 'undefined' && window.jarvis?.isElectron) {
        const s = await window.jarvis.getStats();
        setStats((p) => ({ ...p, ram: s.memUsedPercent }));
      }
    }
    load();
  }, []);

  return (
    <div className="flex-1 overflow-y-auto p-5">
      <h2 className="text-[15px] font-semibold mb-1 flex items-center gap-2">
        <SystemIcon width={18} height={18} /> System Control
      </h2>
      <p className="text-sm mb-4" style={{ color: 'var(--jarvis-subtext)' }}>
        Live resource usage and power actions. Destructive actions always ask for confirmation.
      </p>

      <div className="glass-panel rounded-lg p-4 flex items-center justify-around mb-4">
        <ProgressRing percent={stats.cpu} color="var(--jarvis-success)" label="CPU" sublabel="Normal" />
        <ProgressRing percent={stats.ram} color="var(--jarvis-accent)" label="RAM" sublabel="Normal" />
        <ProgressRing percent={stats.disk} color="var(--jarvis-purple)" label="DISK" sublabel="Normal" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button onClick={() => sendMessage('shutdown pc')} className="glass-panel rounded-lg p-3.5 flex flex-col items-center gap-2 hover:brightness-110 active:scale-[0.97]">
          <PowerIcon width={22} height={22} style={{ color: 'var(--jarvis-danger)' }} />
          <span className="text-sm font-medium">Shutdown</span>
        </button>
        <button onClick={() => sendMessage('restart pc')} className="glass-panel rounded-lg p-3.5 flex flex-col items-center gap-2 hover:brightness-110 active:scale-[0.97]">
          <PowerIcon width={22} height={22} style={{ color: 'var(--jarvis-accent)' }} />
          <span className="text-sm font-medium">Restart</span>
        </button>
        <button onClick={() => sendMessage('lock pc')} className="glass-panel rounded-lg p-3.5 flex flex-col items-center gap-2 hover:brightness-110 active:scale-[0.97]">
          <PowerIcon width={22} height={22} style={{ color: 'var(--jarvis-purple)' }} />
          <span className="text-sm font-medium">Lock</span>
        </button>
      </div>
    </div>
  );
}
