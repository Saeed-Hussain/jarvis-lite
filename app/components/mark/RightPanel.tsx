'use client';

import { useState } from 'react';
import { useMarkStore } from '@/lib/mark/store';
import LogPanel from './LogPanel';
import FileDropZone, { fmtSize, splitPath } from './FileDropZone';
import { HandIcon, MicIcon, MicOffIcon, SendIcon } from '../Icons';

/** F4 and the mute button: flip the mic and say so in the log, as Mark does. */
export function toggleMuteLogged(): void {
  const s = useMarkStore.getState();
  s.toggleMute();
  s.writeLog(useMarkStore.getState().muted ? 'SYS: Microphone muted.' : 'SYS: Microphone active.');
}

/** The conversation column: transcript, attachment, composer. */
export default function RightPanel() {
  const currentFile = useMarkStore((s) => s.currentFile);
  const muted = useMarkStore((s) => s.muted);
  const speaking = useMarkStore((s) => s.state === 'SPEAKING');
  const assistantName = useMarkStore((s) => (s.config?.assistant_name || 'JARVIS').trim() || 'JARVIS');
  const [size, setSize] = useState<{ path: string; bytes: number | null } | null>(null);
  const [input, setInput] = useState('');

  const onPick = (path: string, bytes: number | null) => {
    const s = useMarkStore.getState();
    setSize({ path, bytes });
    s.setCurrentFile(path);
    const { name, ext } = splitPath(path);
    const sz = bytes != null ? fmtSize(bytes) : '?';
    s.writeLog(`FILE: ${name} (${sz}) loaded`);
    // Straight into the conversation, so the assistant acknowledges the file.
    s.sendText(
      `[FILE_UPLOADED] path=${path} | name=${name} | type=${ext} | size=${sz} | ` +
        `Briefly tell the user you can see the file '${name}' (${sz}) has been uploaded ` +
        `and ask what they'd like to do with it.`,
    );
  };

  const onClear = () => {
    setSize(null);
    useMarkStore.getState().setCurrentFile(null);
  };

  const send = () => {
    const txt = input.trim();
    if (!txt) return;
    setInput('');
    const s = useMarkStore.getState();
    s.writeLog(`You: ${txt}`);
    s.sendText(txt);
  };

  const bytes = size && size.path === currentFile ? size.bytes : null;

  return (
    <aside className="mk-right glass">
      <div className="mk-card-title">
        <span>Conversation</span>
        <button
          className={`btn ghost sm mk-interrupt${speaking ? ' live' : ''}`}
          onClick={() => useMarkStore.getState().interrupt()}
          title="Stop talking (Esc)"
        >
          <HandIcon width={15} height={15} />
          Interrupt
          <kbd>Esc</kbd>
        </button>
      </div>

      <LogPanel />

      <FileDropZone file={currentFile} size={bytes} onPick={onPick} onClear={onClear} assistantName={assistantName} />

      <div className="mk-composer">
        <button
          className={`mk-mic${muted ? ' off' : ''}`}
          onClick={toggleMuteLogged}
          title={muted ? 'Microphone muted — click to unmute (F4)' : 'Microphone on — click to mute (F4)'}
          aria-label={muted ? 'Unmute microphone' : 'Mute microphone'}
        >
          {muted ? <MicOffIcon width={18} height={18} /> : <MicIcon width={18} height={18} />}
        </button>
        <input
          className="mk-input"
          placeholder={`Message ${assistantName.charAt(0) + assistantName.slice(1).toLowerCase()}…`}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') send();
          }}
        />
        <button className="mk-send" onClick={send} disabled={!input.trim()} aria-label="Send">
          <SendIcon width={17} height={17} />
        </button>
      </div>
    </aside>
  );
}
