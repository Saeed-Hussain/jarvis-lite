'use client';

import { useTheme } from '../context/ThemeContext';
import { useJarvisStore } from '@/lib/store';
import { useVoiceStore } from '@/lib/voice/store';
import { DEFAULT_MEMORY, saveMemory } from '@/lib/memory';
import { SunIcon, MoonIcon } from './Icons';

/** The two model toggles share a look; both are off until explicitly allowed. */
function Toggle({ on, onClick, label, tone = 'var(--jarvis-accent)' }: { on: boolean; onClick: () => void; label: string; tone?: string }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="w-12 h-7 rounded-full relative transition-colors shrink-0"
      style={{ backgroundColor: on ? tone : 'var(--jarvis-border)' }}
    >
      <span className="absolute top-0.5 w-6 h-6 rounded-full bg-white transition-all" style={{ left: on ? '22px' : '2px' }} />
    </button>
  );
}

export default function SettingsView() {
  const { theme, toggleTheme } = useTheme();
  const voiceEnabled = useJarvisStore((s) => s.voiceEnabled);
  const toggleVoice = useJarvisStore((s) => s.toggleVoice);
  const autoSendWhatsApp = useJarvisStore((s) => s.autoSendWhatsApp);
  const toggleAutoSend = useJarvisStore((s) => s.toggleAutoSend);

  const brainEnabled = useJarvisStore((s) => s.brainEnabled);
  const enableBrain = useJarvisStore((s) => s.enableBrain);
  const disableBrain = useJarvisStore((s) => s.disableBrain);
  const brain = useJarvisStore((s) => s.brain);

  const wakeEnabled = useVoiceStore((s) => s.wakeEnabled);
  const enableWake = useVoiceStore((s) => s.enable);
  const disableWake = useVoiceStore((s) => s.disable);
  const voice = useVoiceStore((s) => s.state);

  const resetMemory = async () => {
    await saveMemory(DEFAULT_MEMORY);
    window.location.reload();
  };

  return (
    <div className="flex-1 overflow-y-auto p-5 max-w-2xl flex flex-col gap-4">
      <h2 className="text-[15px] font-semibold mb-1">Settings</h2>

      {/* --- the two local models ------------------------------------- */}
      <div className="glass-panel rounded-lg p-3.5 flex items-center justify-between">
        <div className="pr-4">
          <p className="font-medium text-[13px]">Understand anything (local model)</p>
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--jarvis-subtext)' }}>
            Jarvis&apos;s rules are instant but finite. Turn this on and anything they miss goes to a
            small language model running inside the app — no API key, no account, nothing sent
            anywhere. It downloads about 400MB the first time, then works offline.
          </p>
          {brainEnabled && brain.message && (
            <p
              className="text-[11px] mt-1.5 font-mono"
              style={{ color: brain.status === 'unavailable' ? 'var(--jarvis-danger)' : 'var(--jarvis-accent)' }}
            >
              {brain.message}
              {brain.lastMs > 0 && brain.status === 'ready' ? ` · last parse ${brain.lastMs}ms` : ''}
            </p>
          )}
        </div>
        <Toggle on={brainEnabled} onClick={brainEnabled ? disableBrain : enableBrain} label="Toggle the local model" />
      </div>

      <div className="glass-panel rounded-lg p-3.5 flex items-center justify-between">
        <div className="pr-4">
          <p className="font-medium text-[13px]">Wake word — always listening</p>
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--jarvis-subtext)' }}>
            Keeps the microphone open and waits for &ldquo;Jarvis&rdquo;. Speech is transcribed by a
            Whisper model inside the app, so no audio leaves the machine. Jarvis stays in the system
            tray when you close the window — it can&apos;t hear you if it isn&apos;t running.
          </p>
          {voice.status !== 'off' && voice.message && (
            <p
              className="text-[11px] mt-1.5 font-mono"
              style={{ color: voice.status === 'error' ? 'var(--jarvis-danger)' : 'var(--jarvis-accent)' }}
            >
              {voice.message}
              {voice.device ? ` · ${voice.device}` : ''}
            </p>
          )}
        </div>
        <Toggle
          on={wakeEnabled}
          onClick={() => (wakeEnabled ? disableWake() : void enableWake())}
          label="Toggle the wake word"
          tone="var(--jarvis-accent-2)"
        />
      </div>

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
        <div className="pr-4">
          <p className="font-medium text-[13px]">Auto-send WhatsApp messages</p>
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--jarvis-subtext)' }}>
            Off: Jarvis opens the chat with your message typed in, and you press Enter.
            On: it presses Enter for you a few seconds after the chat opens — if you click
            another window during that pause, the keystroke goes there instead.
          </p>
        </div>
        <button
          onClick={toggleAutoSend}
          aria-label="Toggle WhatsApp auto-send"
          className="w-12 h-7 rounded-full relative transition-colors shrink-0"
          style={{ backgroundColor: autoSendWhatsApp ? 'var(--jarvis-danger)' : 'var(--jarvis-border)' }}
        >
          <span
            className="absolute top-0.5 w-6 h-6 rounded-full bg-white transition-all"
            style={{ left: autoSendWhatsApp ? '22px' : '2px' }}
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
