'use client';

import { useEffect, useState } from 'react';
import {
  HomeIcon,
  ChatIcon,
  CommandIcon,
  SystemIcon,
  FolderIcon,
  AppsIcon,
  SettingsIcon,
  MemoryIcon,
  LogsIcon,
  InfoIcon,
  PilotIcon,
  BotIcon,
  SunIcon,
  MoonIcon,
  SparkIcon,
} from './Icons';
import { useTheme } from '../context/ThemeContext';
import { useMarkStore } from '@/lib/mark/store';
import type { HudState } from '@/lib/mark/types';

export type View = 'hud' | 'dashboard' | 'chat' | 'pilot' | 'commands' | 'system' | 'files' | 'apps' | 'settings' | 'memory' | 'logs' | 'about';

type Item = { id: View; label: string; icon: typeof HomeIcon };

const SECTIONS: { title?: string; items: Item[] }[] = [
  { items: [{ id: 'hud', label: 'Assistant', icon: BotIcon }] },
  {
    title: 'Local',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: HomeIcon },
      { id: 'chat', label: 'Chat', icon: ChatIcon },
      { id: 'pilot', label: 'Pilot', icon: PilotIcon },
      { id: 'commands', label: 'Commands', icon: CommandIcon },
    ],
  },
  {
    title: 'Computer',
    items: [
      { id: 'system', label: 'System Control', icon: SystemIcon },
      { id: 'files', label: 'Files & Folders', icon: FolderIcon },
      { id: 'apps', label: 'Apps', icon: AppsIcon },
    ],
  },
  {
    title: 'More',
    items: [
      { id: 'memory', label: 'Memory', icon: MemoryIcon },
      { id: 'logs', label: 'Logs', icon: LogsIcon },
      { id: 'settings', label: 'Settings', icon: SettingsIcon },
      { id: 'about', label: 'About', icon: InfoIcon },
    ],
  },
];

const STATE_LABEL: Record<HudState, string> = {
  LISTENING: 'Listening',
  SPEAKING: 'Speaking',
  THINKING: 'Thinking',
  SLEEPING: 'Asleep',
};

export default function Sidebar({ active, onSelect }: { active: View; onSelect: (v: View) => void }) {
  const { theme, toggleTheme, effects, toggleEffects } = useTheme();
  const name = useMarkStore((s) => (s.config?.assistant_name || 'Jarvis').trim() || 'Jarvis');
  const state = useMarkStore((s) => s.state);
  const muted = useMarkStore((s) => s.muted);
  const connected = useMarkStore((s) => s.connected);
  const configured = useMarkStore((s) => !!s.config?.configured);

  // Resolved after mount so the static export and the first render agree.
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  const status = !ready
    ? 'Starting'
    : !configured
      ? 'Needs an API key'
      : !connected
        ? 'Connecting'
        : muted
          ? 'Muted'
          : STATE_LABEL[state];
  const tone = !connected || !configured ? 'idle' : muted ? 'muted' : state.toLowerCase();

  return (
    <aside className="sb glass">
      <div className="sb-brand app-drag">
        <div className="sb-mark">
          <span />
        </div>
        <div className="sb-brand-text">
          <span className="sb-name">{titleCase(name)}</span>
          <span className="sb-tag">Personal assistant</span>
        </div>
      </div>

      <nav className="sb-nav">
        {SECTIONS.map((sec, i) => (
          <div key={i} className="sb-sec">
            {sec.title && <div className="sb-sec-title">{sec.title}</div>}
            {sec.items.map((item) => {
              const Icon = item.icon;
              const on = active === item.id;
              return (
                <button key={item.id} className={`sb-item${on ? ' on' : ''}`} onClick={() => onSelect(item.id)} aria-current={on ? 'page' : undefined}>
                  <Icon width={17} height={17} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      <button className={`sb-status tone-${tone}`} onClick={() => onSelect('hud')} title="Open the assistant">
        <span className="sb-orb">
          <i />
        </span>
        <span className="sb-status-text">
          <b>{titleCase(name)}</b>
          <small>{status}</small>
        </span>
      </button>

      <div className="sb-foot">
        <button className="btn ghost icon sm" onClick={toggleTheme} title={theme === 'dark' ? 'Light theme' : 'Dark theme'} aria-label="Toggle theme">
          {theme === 'dark' ? <SunIcon width={17} height={17} /> : <MoonIcon width={17} height={17} />}
        </button>
        <button
          className={`btn ghost icon sm${effects === 'lite' ? '' : ' fx-on'}`}
          onClick={toggleEffects}
          title={effects === 'lite' ? 'Effects: lite — the background holds still. Click for full.' : 'Effects: full — the background drifts. Click for lite (lighter on the GPU).'}
          aria-label="Toggle background motion"
        >
          <SparkIcon width={17} height={17} />
        </button>
      </div>

      <style jsx>{`
        .sb {
          display: flex;
          flex-direction: column;
          min-height: 0;
          border-radius: var(--radius-lg);
          padding: 14px 10px 10px;
          overflow: hidden;
        }
        .sb-brand {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 2px 6px 12px;
        }
        .sb-mark {
          flex: none;
          width: 32px;
          height: 32px;
          border-radius: 10px;
          display: grid;
          place-items: center;
          background: var(--primary);
          box-shadow: 0 6px 16px -6px rgba(var(--accent-rgb), 0.8);
        }
        .sb-mark span {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: radial-gradient(circle at 35% 35%, #fff, var(--accent) 60%);
          box-shadow: 0 0 10px var(--accent);
        }
        .sb-brand-text {
          display: flex;
          flex-direction: column;
          line-height: 1.15;
          min-width: 0;
        }
        .sb-name {
          font-size: 15.5px;
          font-weight: 650;
          letter-spacing: -0.02em;
        }
        .sb-tag {
          font-size: 11.5px;
          color: var(--ink-3);
        }
        .sb-nav {
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 4px;
          padding-right: 2px;
        }
        .sb-sec {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .sb-sec + .sb-sec {
          margin-top: 6px;
        }
        .sb-sec-title {
          padding: 2px 12px 2px;
          font-size: 11.5px;
          font-weight: 560;
          color: var(--ink-3);
        }
        .sb-item {
          display: flex;
          align-items: center;
          gap: 11px;
          height: 34px;
          padding: 0 12px;
          border-radius: 12px;
          font-size: 13.5px;
          font-weight: 520;
          color: var(--ink-2);
          background: transparent;
          border: 1px solid transparent;
          text-align: left;
          transition: background 0.2s var(--ease), color 0.2s, border-color 0.2s, transform 0.2s var(--spring);
        }
        .sb-item:hover {
          background: var(--fill-2);
          color: var(--ink);
        }
        .sb-item:active {
          transform: scale(0.985);
        }
        .sb-item.on {
          color: var(--ink);
          background: var(--glass-strong);
          border-color: var(--line);
          box-shadow: inset 0 1px 0 var(--highlight), var(--shadow-sm);
        }
        .sb-item.on :global(svg) {
          color: var(--accent-ink);
        }
        .sb-status {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-top: 8px;
          padding: 8px 10px;
          border-radius: 14px;
          background: var(--fill);
          border: 1px solid var(--line);
          text-align: left;
          transition: background 0.2s;
        }
        .sb-status:hover {
          background: var(--fill-2);
        }
        .sb-orb {
          position: relative;
          flex: none;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          background: var(--fill-2);
        }
        .sb-orb i {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: var(--ink-4);
          transition: background 0.3s, box-shadow 0.3s;
        }
        .tone-listening .sb-orb i {
          background: var(--good);
          box-shadow: 0 0 10px var(--good);
        }
        .tone-speaking .sb-orb i {
          background: var(--accent);
          box-shadow: 0 0 12px var(--accent);
          animation: sb-pulse 1s ease-in-out infinite;
        }
        .tone-thinking .sb-orb i {
          background: var(--think);
          box-shadow: 0 0 10px var(--think);
          animation: sb-pulse 0.7s ease-in-out infinite;
        }
        .tone-muted .sb-orb i {
          background: var(--bad);
        }
        .sb-status-text {
          display: flex;
          flex-direction: column;
          line-height: 1.25;
          min-width: 0;
        }
        .sb-status-text b {
          font-size: 13px;
          font-weight: 600;
        }
        .sb-status-text small {
          font-size: 11.5px;
          color: var(--ink-3);
        }
        .sb-foot {
          display: flex;
          gap: 2px;
          padding: 8px 2px 0;
          color: var(--ink-2);
        }
        .sb-foot .fx-on {
          color: var(--accent-ink);
        }
        /* Short windows: tighter rows and no section captions, so the whole
           list fits without a scrollbar. */
        @media (max-height: 760px) {
          .sb-item {
            height: 30px;
          }
          .sb-sec-title {
            display: none;
          }
          .sb-sec + .sb-sec {
            margin-top: 8px;
            padding-top: 8px;
            border-top: 1px solid var(--line);
          }
          .sb-brand {
            padding-bottom: 8px;
          }
        }
        @keyframes sb-pulse {
          50% {
            transform: scale(1.35);
          }
        }
      `}</style>
    </aside>
  );
}

function titleCase(s: string): string {
  return s.length <= 4 && s === s.toUpperCase() ? s : s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}
