'use client';

import { useEffect, useState } from 'react';
import { useJarvisStore } from '@/lib/store';
import { useVoiceStore } from '@/lib/voice/store';
import { MicIcon, SendIcon } from './Icons';

/** What the mic button looks like in each listener state. */
const TONE: Record<string, string> = {
  off: 'var(--jarvis-accent)',
  loading: 'var(--jarvis-subtext)',
  armed: 'var(--jarvis-accent-2)',
  listening: 'var(--jarvis-danger)',
  thinking: 'var(--jarvis-subtext)',
  error: 'var(--jarvis-danger)',
};

export default function InputBar() {
  const [value, setValue] = useState('');
  const sendMessage = useJarvisStore((s) => s.sendMessage);
  const thinking = useJarvisStore((s) => s.thinking);

  const init = useVoiceStore((s) => s.init);
  const listenOnce = useVoiceStore((s) => s.listenOnce);
  const disable = useVoiceStore((s) => s.disable);
  const wakeEnabled = useVoiceStore((s) => s.wakeEnabled);
  const voice = useVoiceStore((s) => s.state);

  // Creates the listener and, if the wake word was left on, starts it.
  useEffect(() => {
    init();
  }, [init]);

  const handleSend = () => {
    if (!value.trim()) return;
    sendMessage(value);
    setValue('');
  };

  const handleMic = () => {
    if (voice.status === 'listening') {
      // Cancel: drop back to the wake word, or off entirely.
      if (wakeEnabled) useVoiceStore.getState().listener?.listenNow();
      else disable();
      return;
    }
    void listenOnce();
  };

  const note =
    voice.status === 'error'
      ? voice.message
      : voice.status === 'loading'
        ? voice.message
        : thinking
          ? 'Working out what that meant…'
          : voice.status === 'listening'
            ? 'Listening…'
            : voice.status === 'thinking'
              ? 'Transcribing…'
              : voice.status === 'armed'
                ? `Listening for “Jarvis”${voice.heard ? ` · heard: “${voice.heard}”` : ''}`
                : '';

  return (
    <div className="px-4 py-3 glass-panel border-t">
      {note && (
        <div className="flex items-center gap-2 mb-2 px-1">
          {/* A live level meter, so "is it hearing me?" has a visible answer. */}
          {(voice.status === 'armed' || voice.status === 'listening') && (
            <span className="w-12 h-1 rounded-full overflow-hidden shrink-0" style={{ backgroundColor: 'var(--jarvis-border)' }}>
              <span
                className="block h-full rounded-full transition-all duration-75"
                style={{ width: `${Math.round(voice.level * 100)}%`, backgroundColor: TONE[voice.status] }}
              />
            </span>
          )}
          <p
            className="text-xs truncate"
            style={{ color: voice.status === 'error' ? 'var(--jarvis-danger)' : 'var(--jarvis-subtext)' }}
          >
            {note}
            {voice.status === 'loading' && voice.percent > 0 ? ` (${voice.percent}%)` : ''}
          </p>
        </div>
      )}

      <div className="flex items-center gap-2">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Type a command..."
          className="flex-1 rounded-lg px-3 py-2.5 text-[13px] outline-none glass-panel focus:ring-2"
          style={{ ['--tw-ring-color' as string]: 'var(--jarvis-accent)' } as React.CSSProperties}
        />
        <button
          onClick={handleMic}
          aria-label="Toggle microphone"
          title={wakeEnabled ? 'Listening for “Jarvis” — click to speak now' : 'Click to speak'}
          className="w-10 h-10 rounded-lg flex items-center justify-center text-white shrink-0 relative"
          style={{ backgroundColor: TONE[voice.status] ?? 'var(--jarvis-accent)' }}
        >
          {voice.status === 'listening' && (
            <span className="absolute inset-0 rounded-lg animate-pulseRing" style={{ border: '2px solid var(--jarvis-danger)' }} />
          )}
          <MicIcon width={16} height={16} />
        </button>
        <button
          onClick={handleSend}
          aria-label="Send message"
          className="w-10 h-10 rounded-lg flex items-center justify-center text-white shrink-0"
          style={{ backgroundColor: 'var(--jarvis-accent)' }}
        >
          <SendIcon width={15} height={15} />
        </button>
      </div>
    </div>
  );
}
