'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useMarkStore } from '@/lib/mark/store';
import type { LogLine } from '@/lib/mark/store';

// Mark's LogWidget types each line out a glyph at a time (a 6 ms timer), then
// pauses 20 ms before the next queued line. Lines queue; nothing is dropped.
const CHAR_MS = 6;
const LINE_GAP_MS = 20;
/** A backlog this deep is not worth typing out; show it and type what follows. */
const MAX_BACKLOG = 60;

type Kind = 'you' | 'ai' | 'web' | 'file' | 'err' | 'sys';

/** What a log line is, and its text without the "Speaker:" prefix. */
function parse(text: string, aiName: string): { kind: Kind; body: string } {
  const tl = text.toLowerCase();
  const strip = (n: number) => text.slice(n).trimStart();
  if (tl.startsWith('you:')) return { kind: 'you', body: strip(4) };
  if (tl.startsWith(`${aiName}:`)) return { kind: 'ai', body: strip(aiName.length + 1) };
  if (tl.startsWith('jarvis:')) return { kind: 'ai', body: strip(7) };
  if (tl.startsWith('[web]:')) return { kind: 'web', body: strip(6) };
  if (tl.startsWith('file:')) return { kind: 'file', body: strip(5) };
  if (tl.startsWith('err:')) return { kind: 'err', body: strip(4) };
  if (tl.startsWith('net:')) return { kind: 'err', body: strip(4) };
  if (tl.startsWith('sys:')) return { kind: 'sys', body: strip(4) };
  if (tl.includes('err')) return { kind: 'err', body: text };
  return { kind: 'sys', body: text };
}

function Line({ line, shown, aiName, aiLabel }: { line: LogLine; shown?: number; aiName: string; aiLabel: string }) {
  const { kind, body } = parse(line.text, aiName);
  // While typing, reveal the body in step with the raw line's progress.
  const prefix = line.text.length - body.length;
  const text = shown == null ? body : body.slice(0, Math.max(0, shown - prefix));
  if (kind === 'you' || kind === 'web' || kind === 'ai') {
    return (
      <div className={`mk-msg ${kind === 'ai' ? 'ai' : 'you'}`}>
        {kind === 'ai' && <span className="mk-msg-who">{aiLabel}</span>}
        {kind === 'web' && <span className="mk-msg-who">From your phone</span>}
        <div className="mk-bubble">{text || ' '}</div>
      </div>
    );
  }
  return <div className={`mk-note ${kind}`}>{text || ' '}</div>;
}

export default function LogPanel() {
  const logs = useMarkStore((s) => s.logs);
  const rawName = useMarkStore((s) => (s.config?.assistant_name || 'jarvis').trim());
  const aiName = rawName.toLowerCase();
  const aiLabel = rawName.length <= 4 ? rawName.toUpperCase() : rawName.charAt(0).toUpperCase() + rawName.slice(1).toLowerCase();

  // Everything already in the log when the panel mounts is history: show it
  // at once rather than re-typing a whole session on every view switch.
  const [shownId, setShownId] = useState(() => (logs.length ? logs[logs.length - 1].id : 0));
  const [pos, setPos] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);

  const pending = logs.filter((l) => l.id > shownId);
  const typing: LogLine | undefined = pending[0];

  useEffect(() => {
    if (pending.length > MAX_BACKLOG) {
      setShownId(pending[pending.length - MAX_BACKLOG - 1].id);
      setPos(0);
    }
  }, [pending.length]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!typing) return;
    let raf = 0;
    let gap: ReturnType<typeof setTimeout> | undefined;
    const start = performance.now();
    const len = typing.text.length;
    const step = () => {
      const n = Math.min(len, Math.floor((performance.now() - start) / CHAR_MS) + 1);
      setPos(n);
      if (n < len) {
        raf = requestAnimationFrame(step);
      } else {
        gap = setTimeout(() => {
          setShownId(typing.id);
          setPos(0);
        }, LINE_GAP_MS);
      }
    };
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      if (gap) clearTimeout(gap);
    };
  }, [typing?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Follow the newest text unless the user scrolled up to read something.
  useLayoutEffect(() => {
    const el = boxRef.current;
    if (el && stickRef.current) el.scrollTop = el.scrollHeight;
  });

  const onScroll = () => {
    const el = boxRef.current;
    if (el) stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
  };

  const done = logs.filter((l) => l.id <= shownId);
  return (
    <div className="mk-log" ref={boxRef} onScroll={onScroll}>
      {!done.length && !typing && (
        <div className="mk-empty">
          <b>Say hello.</b>
          <span>Talk, or type below. Everything you and {aiLabel} say appears here.</span>
        </div>
      )}
      {done.map((l) => (
        <Line key={l.id} line={l} aiName={aiName} aiLabel={aiLabel} />
      ))}
      {typing && pos > 0 && <Line key={typing.id} line={typing} shown={pos} aiName={aiName} aiLabel={aiLabel} />}
    </div>
  );
}
