'use client';

// Mark's RemoteKeyOverlay: a QR code that logs the phone straight in, plus the
// manual URL and one-time key as a fallback, with a 10-minute countdown. The
// key expiring closes the panel; NEW KEY mints a fresh one and restarts the
// clock. When a phone connects while it is open, the panel says so (Mark's
// mark_connected) and the countdown stops.

import { useEffect, useRef, useState } from 'react';
import { useMarkStore } from '@/lib/mark/store';
import { CheckIcon, PhoneIcon } from '../../Icons';
import { Modal, displayName } from './common';

const EXPIRY_SECS = 600;

type QrState = { kind: 'img'; src: string } | { kind: 'text'; text: string };

async function makeQr(url: string): Promise<QrState> {
  if (!url) return { kind: 'text', text: '—' };
  try {
    const QR = await import('qrcode');
    const src = await QR.toDataURL(url, {
      errorCorrectionLevel: 'M',
      margin: 2,
      scale: 5,
      color: { dark: '#000000', light: '#ffffff' },
    });
    return { kind: 'img', src };
  } catch {
    return { kind: 'text', text: url.slice(0, 28) };
  }
}

export default function RemoteKeyOverlay() {
  const remote = useMarkStore((s) => s.remote);
  const phoneConnected = useMarkStore((s) => s.phoneConnected);
  const name = useMarkStore((s) => s.config?.assistant_name) || 'JARVIS';

  const [qr, setQr] = useState<QrState>({ kind: 'text', text: '' });
  const [expiry, setExpiry] = useState(() => Date.now() + EXPIRY_SECS * 1000);
  const [now, setNow] = useState(() => Date.now());
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);

  const close = () => useMarkStore.getState().setOverlay(null);

  // Mark logs the manual address when the key is generated.
  const loggedFor = useRef('');
  useEffect(() => {
    if (!remote || loggedFor.current === remote.key) return;
    loggedFor.current = remote.key;
    useMarkStore
      .getState()
      .writeLog(`SYS: Remote key generated — manual: ${remote.manualUrl || remote.url}`);
  }, [remote]);

  useEffect(() => {
    let alive = true;
    const url = remote ? remote.autoLoginUrl || remote.url : '';
    makeQr(url).then((q) => alive && setQr(q));
    return () => {
      alive = false;
    };
  }, [remote]);

  // Only a connection that happens while the panel is up counts, as in Mark:
  // an older phone session should not make a fresh key read CONNECTED.
  const prevPhone = useRef(phoneConnected);
  useEffect(() => {
    if (phoneConnected && !prevPhone.current) setConnected(true);
    prevPhone.current = phoneConnected;
  }, [phoneConnected]);

  useEffect(() => {
    if (connected) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [connected]);

  const remaining = Math.max(0, Math.ceil((expiry - now) / 1000));
  useEffect(() => {
    if (!connected && remaining === 0) close();
  }, [remaining, connected]);

  const refreshKey = async () => {
    if (busy) return;
    setBusy(true);
    const before = useMarkStore.getState().remote;
    await useMarkStore.getState().newRemoteKey().catch(() => {});
    setBusy(false);
    if (useMarkStore.getState().remote === before) return; // nothing new came back
    setConnected(false);
    setExpiry(Date.now() + EXPIRY_SECS * 1000);
    setNow(Date.now());
  };

  const mm = String(Math.floor(remaining / 60)).padStart(2, '0');
  const ss = String(remaining % 60).padStart(2, '0');

  return (
    <Modal
      width={400}
      icon={<PhoneIcon />}
      title="Remote control"
      description="Scan with your phone’s camera to connect instantly."
      onClose={close}
      footer={
        <>
          <button className="btn" disabled={busy} onClick={refreshKey}>
            New key
          </button>
          <button className="btn primary" onClick={close}>
            Done
          </button>
        </>
      }
    >
      {connected ? (
        <div className="mko-qr connected">
          <CheckIcon />
        </div>
      ) : (
        <div className="mko-qr">
          {qr.kind === 'img' ? (
            <img src={qr.src} alt="Pairing QR code" />
          ) : (
            <span
              className={qr.text.length > 1 ? 'mono' : undefined}
              style={{ fontSize: qr.text.length > 1 ? '11px' : undefined, overflowWrap: 'anywhere' }}
            >
              {qr.text}
            </span>
          )}
        </div>
      )}

      <div className="mko-or">or enter it manually</div>

      <div className="mko-well" style={{ gap: 10 }}>
        <div className="mko-url">{remote ? remote.manualUrl || remote.url : ''}</div>
        <div className={`mko-key${connected ? ' connected' : ''}`}>{connected ? 'Connected' : remote?.key || '—'}</div>
      </div>

      <span className={`chip mko-expiry${connected ? ' ok' : ''}`}>
        <i className="dot" />
        <span className="tnum">{connected ? `Phone connected — ${displayName(name)} ready` : `Key expires in ${mm}:${ss}`}</span>
      </span>
    </Modal>
  );
}
