'use client';

import { useEffect, useState } from 'react';
import { useJarvisStore } from '@/lib/store';
import { useVoiceStore } from '@/lib/voice/store';
import { MicIcon, SendIcon } from './Icons';
import './views.css';

/** The level meter takes the colour of the listener state. */
const TONE: Record<string, string> = {
  off: 'var(--accent)',
  loading: 'var(--ink-3)',
  armed: 'var(--good)',
  listening: 'var(--bad)',
  thinking: 'var(--ink-3)',
  error: 'var(--bad)',
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
    <div className="v-composer-wrap">
      {note && (
        <div className={`v-composer-note${voice.status === 'error' ? ' err' : ''}`}>
          {/* A live level meter, so "is it hearing me?" has a visible answer. */}
          {(voice.status === 'armed' || voice.status === 'listening') && (
            <span className="v-level">
              <i
                style={{ width: `${Math.round(voice.level * 100)}%`, ['--tone' as string]: TONE[voice.status] } as React.CSSProperties}
              />
            </span>
          )}
          <p>
            {note}
            {voice.status === 'loading' && voice.percent > 0 ? ` (${voice.percent}%)` : ''}
          </p>
        </div>
      )}

      <div className="v-composer">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Type a command…"
          className="v-input"
        />
        <button
          onClick={handleMic}
          aria-label="Toggle microphone"
          title={wakeEnabled ? 'Listening for “Jarvis” — click to speak now' : 'Click to speak'}
          className="v-mic"
          data-s={voice.status}
        >
          {voice.status === 'listening' && <span className="v-mic-ring" />}
          <MicIcon width={17} height={17} />
        </button>
        <button onClick={handleSend} aria-label="Send message" className="v-send">
          <SendIcon width={16} height={16} />
        </button>
      </div>
    </div>
  );
}
