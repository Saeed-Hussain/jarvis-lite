'use client';

import { useJarvisStore } from '@/lib/store';
import { SettingsIcon } from './Icons';
import type { View } from './Sidebar';
import './views.css';

export default function StatusBar({ onSelect }: { onSelect: (v: View) => void }) {
  const voiceEnabled = useJarvisStore((s) => s.voiceEnabled);

  return (
    <footer className="v-statusbar">
      <span className="v-statusbar-l">Jarvis Lite <span className="tnum">1.0.0</span></span>

      <div className="v-statusbar-r">
        <span className="chip good">
          <i className="dot" />
          Online
        </span>
        <span className={`chip${voiceEnabled ? ' on' : ''}`}>Voice {voiceEnabled ? 'on' : 'off'}</span>
        <button onClick={() => onSelect('settings')} aria-label="Settings" title="Settings" className="btn ghost icon sm">
          <SettingsIcon width={15} height={15} />
        </button>
      </div>
    </footer>
  );
}
