'use client';

import { useEffect, useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { SunIcon, MoonIcon, MinimizeIcon, MaximizeIcon, CloseIcon } from './Icons';
import './views.css';

function getGreeting(hour: number) {
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function TopBar() {
  const { theme, toggleTheme } = useTheme();
  const [now, setNow] = useState<Date | null>(null);
  const isElectron = typeof window !== 'undefined' && !!window.jarvis?.isElectron;

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const timeStr = now?.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) ?? '--:--';
  const dateStr = now?.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }) ?? '';

  return (
    // The window is frameless, so this slim bar doubles as the title bar.
    <header className="v-topbar app-drag">
      <div className="v-topbar-l">
        <b>{getGreeting(now?.getHours() ?? 12)}</b>
        <span>{dateStr}</span>
      </div>

      <div className="v-topbar-r">
        <span className="v-clock tnum hidden sm:inline">{timeStr}</span>

        <button
          onClick={toggleTheme}
          aria-label="Toggle theme"
          title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
          className="btn ghost icon sm app-no-drag"
        >
          {theme === 'dark' ? <SunIcon width={16} height={16} /> : <MoonIcon width={16} height={16} />}
        </button>

        {isElectron && (
          <div className="v-winctl app-no-drag">
            <button onClick={() => window.jarvis?.minimize()} title="Minimise" aria-label="Minimise">
              <MinimizeIcon width={15} height={15} />
            </button>
            <button onClick={() => window.jarvis?.maximize()} title="Maximise" aria-label="Maximise">
              <MaximizeIcon width={14} height={14} />
            </button>
            <button className="close" onClick={() => window.jarvis?.close()} title="Close" aria-label="Close">
              <CloseIcon width={15} height={15} />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
