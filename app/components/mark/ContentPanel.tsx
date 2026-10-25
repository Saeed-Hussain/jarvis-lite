'use client';

import { useLayoutEffect, useRef } from 'react';

/** "NEWS — top world news today" → "News — top world news today". */
export function prettyTitle(t: string): string {
  const s = (t || '').slice(0, 64);
  return s.replace(/^([A-Z]{2,})(?=)/, (w) => w.charAt(0) + w.slice(1).toLowerCase());
}

export function hms(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/** The panel chrome under the HUD: ◈ TITLE ……… 12:00:00 [DISMISS ✕]. */
export function PanelHeader({ title, right, onDismiss }: { title: string; right?: string; onDismiss(): void }) {
  return (
    <div className="mk-panel-hdr">
      <span className="mk-panel-dot" />
      <span className="mk-panel-title">{title}</span>
      <span className="mk-panel-ts mono tnum">{right || ''}</span>
      <button className="btn ghost icon sm" onClick={onDismiss} title="Dismiss" aria-label="Dismiss">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      </button>
    </div>
  );
}

/**
 * Search results, news, briefings: whatever a tool hands to show_content().
 * A new arrival scrolls back to the top, like setPlainText + moveCursor(Start).
 */
export default function ContentPanel({
  title,
  text,
  at,
  height,
  onDismiss,
}: {
  title: string;
  text: string;
  at: number;
  height: number;
  onDismiss(): void;
}) {
  const bodyRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
  }, [at]);

  return (
    <div className="mk-panel glass" style={{ height }}>
      <PanelHeader title={prettyTitle(title)} right={hms(at)} onDismiss={onDismiss} />
      <div className="mk-panel-text" ref={bodyRef}>
        {(text || '').slice(0, 4000)}
      </div>
    </div>
  );
}
