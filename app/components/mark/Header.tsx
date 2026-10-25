'use client';

import { useEffect, useState } from 'react';
import { APP_VERSION } from './LeftPanel';
import { markBridge } from '@/lib/mark/types';
import { useMarkStore } from '@/lib/mark/store';
import { CloseIcon, MaximizeIcon, MinimizeIcon, SlidersIcon } from '../Icons';

type WinApi = { minimize?(): void; maximize?(): void; close?(): void };
const win = (): WinApi | null =>
  typeof window === 'undefined' ? null : ((window as unknown as { jarvis?: WinApi }).jarvis ?? null);

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const p2 = (n: number) => String(n).padStart(2, '0');

function clockText(d: Date): [string, string] {
  return [`${p2(d.getHours())}:${p2(d.getMinutes())}`, `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`];
}

/** One word for what the assistant is doing, and the colour it is shown in. */
export function useStatus(): { label: string; tone: string } {
  const state = useMarkStore((s) => s.state);
  const muted = useMarkStore((s) => s.muted);
  const connected = useMarkStore((s) => s.connected);
  const configured = useMarkStore((s) => !!s.config?.configured);
  const wake = useMarkStore((s) => s.wake);
  if (!configured) return { label: 'Needs an API key', tone: 'idle' };
  if (!connected) return { label: 'Connecting', tone: 'idle' };
  if (muted) return { label: 'Muted', tone: 'muted' };
  if (state === 'SPEAKING') return { label: 'Speaking', tone: 'speaking' };
  if (state === 'THINKING') return { label: 'Thinking', tone: 'thinking' };
  if (state === 'SLEEPING') return { label: wake.enabled ? 'Asleep — say “Hey Jarvis”' : 'Asleep', tone: 'idle' };
  return { label: 'Listening', tone: 'listening' };
}

export function StatusPill() {
  const { label, tone } = useStatus();
  return (
    <span className={`mk-pill tone-${tone}`}>
      <i />
      {label}
    </span>
  );
}

export default function Header({
  assistantName,
  drawerOpen,
  onToggleDrawer,
}: {
  assistantName: string;
  drawerOpen: boolean;
  onToggleDrawer(): void;
}) {
  // Rendered empty on the server pass so the static export never bakes in a
  // build-time clock; the first tick fills it in.
  const [now, setNow] = useState<[string, string]>(['', '']);
  const [inElectron, setInElectron] = useState(false);
  useEffect(() => setInElectron(!!markBridge()), []);
  useEffect(() => {
    const tick = () => setNow(clockText(new Date()));
    tick();
    const t = setInterval(tick, 5000);
    return () => clearInterval(t);
  }, []);

  const name = assistantName.length <= 4 && assistantName === assistantName.toUpperCase()
    ? assistantName
    : assistantName.charAt(0).toUpperCase() + assistantName.slice(1).toLowerCase();

  return (
    // The window is frameless, so this bar doubles as the title bar.
    <header className="mk-header app-drag">
      <div className="mk-header-l">
        <button
          className={`btn icon sm app-no-drag${drawerOpen ? ' accent' : ''}`}
          onClick={onToggleDrawer}
          title="Settings & controls"
          aria-pressed={drawerOpen}
          aria-label="Settings & controls"
        >
          <SlidersIcon width={16} height={16} />
        </button>
        <span className="chip mk-ver">{APP_VERSION}</span>
      </div>

      <div className="mk-header-c">
        <span className="mk-name">{name}</span>
        <StatusPill />
      </div>

      <div className="mk-header-r">
        <div className="mk-clock">
          <span className="tnum">{now[0]}</span>
          <small>{now[1]}</small>
        </div>
        {inElectron && (
          <div className="mk-winctl app-no-drag">
            <button onClick={() => win()?.minimize?.()} title="Minimise" aria-label="Minimise">
              <MinimizeIcon width={15} height={15} />
            </button>
            <button onClick={() => win()?.maximize?.()} title="Maximise" aria-label="Maximise">
              <MaximizeIcon width={14} height={14} />
            </button>
            <button className="close" onClick={() => win()?.close?.()} title="Close" aria-label="Close">
              <CloseIcon width={15} height={15} />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
