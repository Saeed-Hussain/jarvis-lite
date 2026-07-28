'use client';

import { useEffect, useRef, useState } from 'react';
import { useJarvisStore } from '@/lib/store';
import { MicIcon, SendIcon } from './Icons';

// Minimal shape for the non-standard Web Speech API
interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

export default function InputBar() {
  const [value, setValue] = useState('');
  const [micError, setMicError] = useState<string | null>(null);
  const isListening = useJarvisStore((s) => s.isListening);
  const setListening = useJarvisStore((s) => s.setListening);
  const sendMessage = useJarvisStore((s) => s.sendMessage);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const SpeechRecognitionCtor: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) return;

    const recognition: SpeechRecognitionLike = new SpeechRecognitionCtor();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      const transcript = event.results?.[0]?.[0]?.transcript ?? '';
      if (transcript) {
        sendMessage(transcript);
      }
    };
    recognition.onerror = (event: any) => {
      setMicError(event?.error === 'not-allowed' ? 'Microphone permission denied.' : 'Voice recognition error.');
      setListening(false);
    };
    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;
  }, [sendMessage, setListening]);

  const handleSend = () => {
    if (!value.trim()) return;
    sendMessage(value);
    setValue('');
  };

  const handleMic = () => {
    setMicError(null);
    if (!recognitionRef.current) {
      setMicError('Voice recognition is not supported in this browser.');
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
      setListening(false);
      return;
    }
    try {
      recognitionRef.current.start();
      setListening(true);
    } catch {
      setMicError('Could not start microphone.');
    }
  };

  return (
    <div className="px-4 py-3 glass-panel border-t">
      {micError && (
        <p className="text-xs mb-2 px-1" style={{ color: 'var(--jarvis-danger)' }}>
          {micError}
        </p>
      )}
      <div className="flex items-center gap-2">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Type a command..."
          className="flex-1 rounded-lg px-3 py-2.5 text-[13px] outline-none glass-panel focus:ring-2"
          style={{ ['--tw-ring-color' as any]: 'var(--jarvis-accent)' }}
        />
        <button
          onClick={handleMic}
          aria-label="Toggle microphone"
          className="w-10 h-10 rounded-lg flex items-center justify-center text-white shrink-0"
          style={{ backgroundColor: isListening ? 'var(--jarvis-danger)' : 'var(--jarvis-accent)' }}
        >
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
