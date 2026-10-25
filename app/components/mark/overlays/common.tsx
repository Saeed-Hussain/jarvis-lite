'use client';

// Shared bits for the overlays: the glass modal shell, grouped wells and
// labelled fields. The layer (index.tsx + overlays.css) dims and softens the
// HUD behind and centres the card; each overlay only describes its content.

import { useId, type CSSProperties, type ReactNode } from 'react';
import { ChevronRightIcon, CloseIcon } from '../../Icons';

/** "JARVIS" → "Jarvis" for prose; short acronyms stay as they are. */
export function displayName(s: string): string {
  return s.length <= 4 && s === s.toUpperCase() ? s : s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

export function Modal(props: {
  width: number;
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  /** Close button (top right). Omitted → no close button. */
  onClose?: () => void;
  footer?: ReactNode;
  /** Caption shown at the left of the footer. */
  footerNote?: ReactNode;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}) {
  const { width, title, description, icon, onClose, footer, footerNote, className, style, children } = props;
  const id = useId();
  return (
    <div
      className={`mko-modal glass-strong${className ? ` ${className}` : ''}`}
      style={{ width, ...style }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${id}-t`}
    >
      <header className="mko-head">
        {icon && <span className="mko-head-ico">{icon}</span>}
        <div className="mko-head-text">
          <h2 className="mko-title" id={`${id}-t`}>
            {title}
          </h2>
          {description && <p className="mko-desc">{description}</p>}
        </div>
        {onClose && (
          <button className="btn ghost icon sm mko-close" aria-label="Close" title="Close" onClick={onClose}>
            <CloseIcon width={16} height={16} />
          </button>
        )}
      </header>
      {children && <div className="mko-content">{children}</div>}
      {footer && (
        <footer className="mko-foot">
          {footerNote && <span className="mko-foot-note">{footerNote}</span>}
          <div className="mko-foot-btns">{footer}</div>
        </footer>
      )}
    </div>
  );
}

/** A labelled group: small caption above a translucent well. */
export function Group(props: { title?: ReactNode; aside?: ReactNode; className?: string; children: ReactNode }) {
  const { title, aside, className, children } = props;
  return (
    <section className="mko-group">
      {(title || aside) && (
        <div className="mko-group-hdr">
          {title && <span className="mko-group-title">{title}</span>}
          {aside}
        </div>
      )}
      <div className={`mko-well${className ? ` ${className}` : ''}`}>{children}</div>
    </section>
  );
}

/** Label + control + optional hint, stacked. */
export function Field(props: { label: ReactNode; hint?: ReactNode; aside?: ReactNode; children: ReactNode }) {
  const { label, hint, aside, children } = props;
  return (
    <label className="mko-field">
      <span className="mko-field-top">
        <span className="mko-label">{label}</span>
        {aside}
      </span>
      {children}
      {hint && <span className="mko-hint">{hint}</span>}
    </label>
  );
}

/** A native select dressed as a .field, with a chevron. */
export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const { className, ...rest } = props;
  return (
    <span className="mko-select">
      <select className={`field${className ? ` ${className}` : ''}`} {...rest} />
      <ChevronRightIcon width={16} height={16} className="mko-select-chev" aria-hidden />
    </span>
  );
}

export function errText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
