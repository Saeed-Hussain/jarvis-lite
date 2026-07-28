'use client';

import { useEffect, useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { SunIcon, MoonIcon, MinimizeIcon, MaximizeIcon, CloseIcon } from './Icons';

function getGreeting(hour: number) {
  if (hour < 12) return 'Good Morning';
  if (hour < 18) return 'Good Afternoon';
  return 'Good Evening';
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
  const dateStr = now?.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) ?? '';

  return (
    <header className="app-drag flex items-center justify-between px-5 py-3 glass-panel border-b">
      <div>
        <h1 className="text-lg font-bold flex items-center gap-1.5">
          {getGreeting(now?.getHours() ?? 12)}, User <span>👋</span>
        </h1>
        <p className="text-xs mt-0.5" style={{ color: 'var(--jarvis-subtext)' }}>
          How can I help you today?
        </p>
      </div>

      <div className="flex items-center gap-4 app-no-drag">
        <div className="text-right hidden sm:block">
          <p className="text-base font-semibold tabular-nums">{timeStr}</p>
          <p className="text-xs" style={{ color: 'var(--jarvis-subtext)' }}>
            {dateStr}
          </p>
        </div>

        <button
          onClick={toggleTheme}
          aria-label="Toggle theme"
          className="w-8 h-8 rounded-full flex items-center justify-center glass-panel hover:brightness-110"
        >
          {theme === 'dark' ? <SunIcon width={15} height={15} /> : <MoonIcon width={15} height={15} />}
        </button>

        <div className="relative w-10 h-10 rounded-full flex items-center justify-center border-2" style={{ borderColor: 'var(--jarvis-accent-2)' }}>
          <div className="absolute inset-0 rounded-full animate-pulseRing" style={{ border: '2px solid var(--jarvis-accent-2)' }} />
          <div className="flex gap-1">
            <span className="w-1 h-1 rounded-full" style={{ backgroundColor: 'var(--jarvis-accent-2)' }} />
            <span className="w-1 h-1 rounded-full" style={{ backgroundColor: 'var(--jarvis-accent-2)' }} />
          </div>
        </div>

        {isElectron && (
          <div className="flex items-center gap-1 pl-2">
            <button onClick={() => window.jarvis?.minimize()} className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-black/10 dark:hover:bg-white/10">
              <MinimizeIcon width={14} height={14} />
            </button>
            <button onClick={() => window.jarvis?.maximize()} className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-black/10 dark:hover:bg-white/10">
              <MaximizeIcon width={13} height={13} />
            </button>
            <button onClick={() => window.jarvis?.close()} className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-red-500 hover:text-white">
              <CloseIcon width={14} height={14} />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
