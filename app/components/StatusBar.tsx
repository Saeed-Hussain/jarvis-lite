'use client';

import { useJarvisStore } from '@/lib/store';
import { SettingsIcon } from './Icons';
import type { View } from './Sidebar';

export default function StatusBar({ onSelect }: { onSelect: (v: View) => void }) {
  const voiceEnabled = useJarvisStore((s) => s.voiceEnabled);

  return (
    <footer className="flex items-center justify-between px-4 py-1.5 glass-panel border-t text-[11px]" style={{ color: 'var(--jarvis-subtext)' }}>
      <span className="font-medium">JARVIS LITE v1.0.0</span>

      <div className="flex items-center gap-2">
        <span>Status:</span>
        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--jarvis-success)' }} />
        <span style={{ color: 'var(--jarvis-text)' }}>Online</span>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span>Voice:</span>
          <span style={{ color: voiceEnabled ? 'var(--jarvis-accent)' : 'var(--jarvis-subtext)' }}>{voiceEnabled ? 'ON' : 'OFF'}</span>
        </div>
        <button onClick={() => onSelect('settings')} aria-label="Settings" className="hover:text-jarvis-text">
          <SettingsIcon width={15} height={15} />
        </button>
      </div>
    </footer>
  );
}
