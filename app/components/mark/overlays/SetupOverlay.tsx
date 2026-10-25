'use client';

// First-boot setup (Mark's SetupOverlay): Gemini API key + operating system.
// There is no close button on purpose — nothing works without a key.

import { useState } from 'react';
import { useMarkStore } from '@/lib/mark/store';
import type { MarkConfig } from '@/lib/mark/types';
import { LinkIcon } from '../../Icons';
import { Field } from './common';

type OsKey = MarkConfig['os'];

function detectOs(): OsKey {
  if (typeof navigator === 'undefined') return 'windows';
  const p = `${navigator.platform || ''} ${navigator.userAgent || ''}`.toLowerCase();
  if (p.includes('win')) return 'windows';
  if (p.includes('mac')) return 'mac';
  return 'linux';
}

const OS_BTNS: [OsKey, string][] = [
  ['windows', 'Windows'],
  ['mac', 'macOS'],
  ['linux', 'Linux'],
];
const OS_NAME: Record<OsKey, string> = { windows: 'Windows', mac: 'macOS', linux: 'Linux' };

const KEY_URL = 'https://aistudio.google.com/app/apikey';

export default function SetupOverlay() {
  const [detected] = useState<OsKey>(detectOs);
  const [os, setOs] = useState<OsKey>(detected);
  const [key, setKey] = useState('');
  const [bad, setBad] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const k = key.trim();
    if (!k) {
      setBad(true);
      return;
    }
    setBusy(true);
    const s = useMarkStore.getState();
    const ok = await s.saveApiKey(k, os).catch(() => false);
    setBusy(false);
    if (!ok) {
      setBad(true);
      return;
    }
    const name = useMarkStore.getState().config?.assistant_name || 'JARVIS';
    s.writeLog(`SYS: Initialised. OS=${os.toUpperCase()}. ${name} online.`);
  };

  return (
    <div className="mko-modal mko-setup glass-strong" style={{ width: 440 }} role="dialog" aria-modal="true" aria-labelledby="mko-setup-t">
      <div className="mko-hero">
        <div className="mko-brand">
          <span />
        </div>
        <h2 id="mko-setup-t">Welcome to Jarvis</h2>
        <p>Add your Gemini API key and pick your system — that’s all it needs to start talking.</p>
      </div>

      <div className="mko-content">
        <Field
          label="Gemini API key"
          hint={
            bad ? (
              <span className="mko-err">Enter a valid Gemini API key to continue.</span>
            ) : (
              <>
                Don’t have one?{' '}
                <a className="mko-link" href={KEY_URL} target="_blank" rel="noreferrer">
                  Get a free key at aistudio.google.com
                  <LinkIcon />
                </a>
              </>
            )
          }
        >
          <input
            className={`field mono${bad ? ' mko-bad' : ''}`}
            type="password"
            placeholder="AIza…"
            value={key}
            autoFocus
            spellCheck={false}
            aria-invalid={bad}
            onChange={(e) => {
              setKey(e.target.value);
              if (bad) setBad(false);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit();
            }}
          />
        </Field>

        <div className="mko-field">
          <span className="mko-field-top">
            <span className="mko-label">Operating system</span>
            <span className="chip">
              <i className="dot" style={{ color: 'var(--good)' }} />
              {`Detected: ${OS_NAME[detected]}`}
            </span>
          </span>
          <div className="mk-seg mko-seg" role="radiogroup" aria-label="Operating system">
            {OS_BTNS.map(([k, label]) => {
              const sel = k === os;
              return (
                <button key={k} className={sel ? 'on' : ''} role="radio" aria-checked={sel} onClick={() => setOs(k)}>
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <button className="btn primary" disabled={busy} onClick={submit}>
          {busy ? 'Setting up…' : 'Get started'}
        </button>
      </div>
    </div>
  );
}
