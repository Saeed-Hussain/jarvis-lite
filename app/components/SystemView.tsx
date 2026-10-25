'use client';

import { useJarvisStore } from '@/lib/store';
import ProgressRing from './ProgressRing';
import { PowerIcon, SystemIcon } from './Icons';
import './views.css';
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
    <div className="v-page">
      <div className="v-page-inner narrow">
        <header className="v-head">
          <div>
            <h1>System control</h1>
            <p className="sub">Live resource usage and power actions. Destructive actions always ask for confirmation.</p>
          </div>
        </header>

        <section className="glass v-card">
          <div className="v-card-head">
            <h2 className="v-card-title">
              <SystemIcon width={16} height={16} /> Resources
            </h2>
          </div>
          <div className="v-rings" style={{ padding: '6px 0 2px' }}>
            <ProgressRing percent={stats.cpu} color="var(--good)" label="CPU" sublabel="Normal" />
            <ProgressRing percent={stats.ram} color="var(--accent)" label="RAM" sublabel="Normal" />
            <ProgressRing percent={stats.disk} color="var(--think)" label="Disk" sublabel="Normal" />
          </div>
        </section>

        <section className="glass v-card">
          <div className="v-card-head">
            <h2 className="v-card-title">
              <PowerIcon width={16} height={16} /> Power
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <button onClick={() => sendMessage('shutdown pc')} className="v-tile col">
              <span className="v-tile-ico bad">
                <PowerIcon width={18} height={18} />
              </span>
              <span className="v-tile-text">
                <b>Shutdown</b>
              </span>
            </button>
            <button onClick={() => sendMessage('restart pc')} className="v-tile col">
              <span className="v-tile-ico">
                <PowerIcon width={18} height={18} />
              </span>
              <span className="v-tile-text">
                <b>Restart</b>
              </span>
            </button>
            <button onClick={() => sendMessage('lock pc')} className="v-tile col">
              <span className="v-tile-ico think">
                <PowerIcon width={18} height={18} />
              </span>
              <span className="v-tile-text">
                <b>Lock</b>
              </span>
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
