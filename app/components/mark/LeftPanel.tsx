'use client';

import { useEffect, useState } from 'react';
import { markBridge } from '@/lib/mark/types';
import type { Metrics } from '@/lib/mark/types';
import { useMarkStore } from '@/lib/mark/store';
import { isVisible } from '@/lib/visibility';
import MetricBar from './MetricBar';

export const APP_VERSION = 'MARK LIV';
const APP_PROTOCOL = APP_VERSION.split(' ').pop() || APP_VERSION;

/** A number from the first of `keys` that holds one, else null. */
function num(m: Metrics | null, ...keys: string[]): number | null {
  if (!m) return null;
  for (const k of keys) {
    const v = m[k];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
  }
  return null;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** SYS MONITOR column: five gauges, uptime/process/OS box, status tags. */
export default function LeftPanel() {
  const os = useMarkStore((s) => s.config?.os);
  const [m, setM] = useState<Metrics | null>(null);

  useEffect(() => {
    const bridge = markBridge();
    if (!bridge) return;
    let alive = true;
    let busy = false;
    const tick = async () => {
      // A slow sample (WMI on a busy machine) must not stack up behind itself,
      // and gauges nobody can see are not worth sampling.
      if (busy || !isVisible()) return;
      busy = true;
      try {
        const next = await bridge.metrics();
        if (alive) setM(next);
      } catch {
        /* keep the last sample */
      } finally {
        busy = false;
      }
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  const cpu = num(m, 'cpu');
  const mem = num(m, 'ram', 'mem');
  const net = num(m, 'net', 'netMBs', 'net_mbs'); // MB/s
  const gpu = num(m, 'gpu');
  const tmp = num(m, 'temp', 'tmp');
  let uptime = num(m, 'uptime', 'uptimeSec');
  const boot = num(m, 'bootTime', 'boot_time');
  if (uptime == null && boot != null) uptime = Date.now() / 1000 - (boot > 1e12 ? boot / 1000 : boot);
  const procs = num(m, 'procs', 'proc', 'processes', 'procCount');

  // Unknown GPU / temperature come back negative or missing: show N/A.
  const netText = net == null ? '--' : net < 1 ? `${(net * 1024).toFixed(0)}KB/s` : `${net.toFixed(1)}MB/s`;
  const osName = os === 'windows' ? 'WIN' : os === 'mac' ? 'macOS' : os === 'linux' ? 'LINUX' : '--';

  const up = uptime == null ? '--' : `${Math.floor(uptime / 3600)}h ${pad(Math.floor((uptime % 3600) / 60))}m`;
  const osLabel = os === 'windows' ? 'Windows' : os === 'mac' ? 'macOS' : os === 'linux' ? 'Linux' : '--';
  void osName;

  return (
    <aside className="mk-left glass">
      <div className="mk-card-title">
        <span>System</span>
        <span className="mk-live-dot" title="Live" />
      </div>
      <div className="mk-metrics">
        <MetricBar label="CPU" color="var(--accent)" value={cpu ?? 0} text={cpu == null ? '--' : `${cpu.toFixed(0)}%`} />
        <MetricBar label="Memory" color="var(--accent)" value={mem ?? 0} text={mem == null ? '--' : `${mem.toFixed(0)}%`} />
        <MetricBar label="Network" color="var(--good)" value={net == null ? 0 : Math.min(100, net * 10)} text={netText} />
        <MetricBar
          label="GPU"
          color="var(--think)"
          value={gpu != null && gpu >= 0 ? gpu : 0}
          text={m == null || gpu == null ? '--' : gpu >= 0 ? `${gpu.toFixed(0)}%` : 'N/A'}
        />
        <MetricBar
          label="Temperature"
          color="var(--warn)"
          value={tmp != null && tmp >= 0 ? Math.min(100, tmp) : 0}
          text={m == null || tmp == null ? '--' : tmp > 0 ? `${tmp.toFixed(0)}°C` : 'N/A'}
        />
      </div>

      <dl className="mk-info">
        <div>
          <dt>Uptime</dt>
          <dd className="mono tnum">{up}</dd>
        </div>
        <div>
          <dt>Processes</dt>
          <dd className="mono tnum">{procs == null ? '--' : procs}</dd>
        </div>
        <div>
          <dt>System</dt>
          <dd>{osLabel}</dd>
        </div>
      </dl>

      <div style={{ flex: 1 }} />

      <div className="mk-tags">
        <span className="chip"><i className="dot" style={{ color: 'var(--good)' }} />AI core</span>
        <span className="chip"><i className="dot" style={{ color: 'var(--accent)' }} />Secure</span>
        <span className="chip">Protocol {APP_PROTOCOL}</span>
      </div>
    </aside>
  );
}
