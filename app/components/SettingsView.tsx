'use client';

import { useTheme } from '../context/ThemeContext';
import { useJarvisStore } from '@/lib/store';
import { useVoiceStore } from '@/lib/voice/store';
import { DEFAULT_MEMORY, saveMemory } from '@/lib/memory';
import { SunIcon, MoonIcon } from './Icons';
import './views.css';

/**
 * A settings row: the whole row is the button, the switch shows the state.
 * Both model toggles are off until explicitly allowed.
 */
function ToggleRow({
  on,
  onClick,
  label,
  title,
  children,
  warn = false,
}: {
  on: boolean;
  onClick: () => void;
  label: string;
  title: string;
  children: React.ReactNode;
  warn?: boolean;
}) {
  return (
    <button onClick={onClick} aria-label={label} aria-pressed={on} className="v-setting">
      <span className="v-setting-text">
        <b>{title}</b>
        {children}
      </span>
      <span className={`switch${warn ? ' warn' : ''}${on ? ' on' : ''}`} />
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
    <div className="v-page">
      <div className="v-page-inner narrow">
        <header className="v-head">
          <div>
            <h1>Settings</h1>
            <p className="sub">How Jarvis listens, understands and answers. Everything here stays on this machine.</p>
          </div>
        </header>

        {/* --- the two local models ------------------------------------- */}
        <section className="glass v-card flush">
          <div className="v-card-head">
            <div>
              <h2 className="v-card-title">Local models</h2>
              <p className="v-card-sub">Both run inside the app and are off until you allow them.</p>
            </div>
          </div>
          <ToggleRow
            on={brainEnabled}
            onClick={brainEnabled ? disableBrain : enableBrain}
            label="Toggle the local model"
            title="Understand anything (local model)"
          >
            <small>
              Jarvis&apos;s rules are instant but finite. Turn this on and anything they miss goes to a
              small language model running inside the app — no API key, no account, nothing sent
              anywhere. It downloads about 400MB the first time, then works offline.
            </small>
            {brainEnabled && brain.message && (
              <code className={brain.status === 'unavailable' ? 'bad' : undefined}>
                {brain.message}
                {brain.lastMs > 0 && brain.status === 'ready' ? ` · last parse ${brain.lastMs}ms` : ''}
              </code>
            )}
          </ToggleRow>

          <ToggleRow
            on={wakeEnabled}
            onClick={() => (wakeEnabled ? disableWake() : void enableWake())}
            label="Toggle the wake word"
            title="Wake word — always listening"
          >
            <small>
              Keeps the microphone open and waits for &ldquo;Jarvis&rdquo;. Speech is transcribed by a
              Whisper model inside the app, so no audio leaves the machine. Jarvis stays in the system
              tray when you close the window — it can&apos;t hear you if it isn&apos;t running.
            </small>
            {voice.status !== 'off' && voice.message && (
              <code className={voice.status === 'error' ? 'bad' : undefined}>
                {voice.message}
                {voice.device ? ` · ${voice.device}` : ''}
              </code>
            )}
          </ToggleRow>
        </section>

        <section className="glass v-card flush">
          <div className="v-card-head">
            <h2 className="v-card-title">Behaviour</h2>
          </div>
          <div className="v-setting">
            <span className="v-setting-text">
              <b>Appearance</b>
              <small>Switch between dark and light mode</small>
            </span>
            <button onClick={toggleTheme} className="btn sm">
              {theme === 'dark' ? <MoonIcon width={15} height={15} /> : <SunIcon width={15} height={15} />}
              {theme === 'dark' ? 'Dark' : 'Light'} mode
            </button>
          </div>

          <ToggleRow on={voiceEnabled} onClick={toggleVoice} label="Toggle voice responses" title="Voice responses">
            <small>Jarvis speaks replies out loud using text-to-speech</small>
          </ToggleRow>

          <ToggleRow
            on={autoSendWhatsApp}
            onClick={toggleAutoSend}
            label="Toggle WhatsApp auto-send"
            title="Auto-send WhatsApp messages"
            warn
          >
            <small>
              Off: Jarvis opens the chat with your message typed in, and you press Enter.
              On: it presses Enter for you a few seconds after the chat opens — if you click
              another window during that pause, the keystroke goes there instead.
            </small>
          </ToggleRow>
        </section>

        <section className="glass v-card flush">
          <div className="v-setting">
            <span className="v-setting-text">
              <b>Reset memory</b>
              <small>Clears learned commands, context, and logs</small>
            </span>
            <button onClick={resetMemory} className="btn sm danger">
              Reset
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
