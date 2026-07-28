'use client';

import { useTheme } from '../context/ThemeContext';
import { useJarvisStore } from '@/lib/store';
import { DEFAULT_MEMORY, saveMemory } from '@/lib/memory';
import { SunIcon, MoonIcon } from './Icons';

export default function SettingsView() {
  const { theme, toggleTheme } = useTheme();
  const voiceEnabled = useJarvisStore((s) => s.voiceEnabled);
  const toggleVoice = useJarvisStore((s) => s.toggleVoice);

  const resetMemory = async () => {
    await saveMemory(DEFAULT_MEMORY);
    window.location.reload();
  };

  return (
    <div className="flex-1 overflow-y-auto p-5 max-w-2xl flex flex-col gap-4">
      <h2 className="text-[15px] font-semibold mb-1">Settings</h2>

      <div className="glass-panel rounded-lg p-3.5 flex items-center justify-between">
        <div>
          <p className="font-medium text-[13px]">Appearance</p>
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--jarvis-subtext)' }}>
            Switch between dark and light mode
          </p>
        </div>
        <button
          onClick={toggleTheme}
          className="flex items-center gap-2 px-3 py-1.5 rounded-md text-[12px] font-medium text-white"
          style={{ backgroundColor: 'var(--jarvis-accent)' }}
        >
          {theme === 'dark' ? <MoonIcon width={16} height={16} /> : <SunIcon width={16} height={16} />}
          {theme === 'dark' ? 'Dark' : 'Light'} mode
        </button>
      </div>

      <div className="glass-panel rounded-lg p-3.5 flex items-center justify-between">
        <div>
          <p className="font-medium text-[13px]">Voice Responses</p>
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--jarvis-subtext)' }}>
            Jarvis speaks replies out loud using text-to-speech
          </p>
        </div>
        <button
          onClick={toggleVoice}
          className="w-12 h-7 rounded-full relative transition-colors"
          style={{ backgroundColor: voiceEnabled ? 'var(--jarvis-accent)' : 'var(--jarvis-border)' }}
        >
          <span
            className="absolute top-0.5 w-6 h-6 rounded-full bg-white transition-all"
            style={{ left: voiceEnabled ? '22px' : '2px' }}
          />
        </button>
      </div>

      <div className="glass-panel rounded-lg p-3.5 flex items-center justify-between">
        <div>
          <p className="font-medium text-[13px]">Reset Memory</p>
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--jarvis-subtext)' }}>
            Clears learned commands, context, and logs
          </p>
        </div>
        <button onClick={resetMemory} className="px-3 py-1.5 rounded-md text-[12px] font-medium" style={{ color: 'var(--jarvis-danger)', border: '1px solid var(--jarvis-danger)' }}>
          Reset
        </button>
      </div>
    </div>
  );
}
