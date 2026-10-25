'use client';

// Mark LIV's floating overlays, mounted once by MarkHud. Which one is up comes
// from the store (`overlay`); the confirmation banner is independent of it and
// sits above everything, as Mark raised it over whatever else was open.

import './overlays.css';
import { useEffect } from 'react';
import { useMarkStore } from '@/lib/mark/store';
import SetupOverlay from './SetupOverlay';
import CustomizeOverlay from './CustomizeOverlay';
import PluginManagerOverlay from './PluginManagerOverlay';
import PluginSettingsOverlay from './PluginSettingsOverlay';
import AudioDeviceOverlay from './AudioDeviceOverlay';
import MemoryOverlay from './MemoryOverlay';
import RemoteKeyOverlay from './RemoteKeyOverlay';
import ConfirmBanner from './ConfirmBanner';

export default function MarkOverlays() {
  const overlay = useMarkStore((s) => s.overlay);
  const confirm = useMarkStore((s) => s.confirm);
  const hasRemote = useMarkStore((s) => !!s.remote);

  // Esc closes whatever dialog is open — except first-run setup, which has
  // nothing to go back to. Customise reverts an unsaved colour on unmount, so
  // closing it this way is a cancel. Captured first and marked handled, so the
  // HUD's own Esc (interrupt) does not also fire.
  useEffect(() => {
    if (!overlay || overlay === 'setup') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      useMarkStore.getState().setOverlay(null);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [overlay]);

  let panel: JSX.Element | null = null;
  switch (overlay) {
    case 'setup':
      panel = <SetupOverlay />;
      break;
    case 'customize':
      panel = <CustomizeOverlay />;
      break;
    case 'plugins':
      panel = <PluginManagerOverlay />;
      break;
    case 'plugin-settings':
      panel = <PluginSettingsOverlay />;
      break;
    case 'audio':
      panel = <AudioDeviceOverlay />;
      break;
    case 'memory':
      panel = <MemoryOverlay />;
      break;
    case 'remote':
      panel = hasRemote ? <RemoteKeyOverlay /> : null;
      break;
    default:
      panel = null;
  }

  return (
    <>
      {panel && (
        // Keyed so reopening an overlay starts it fresh, like Mark building a
        // new widget each time.
        <div className="mko-layer" key={overlay ?? ''}>
          {panel}
        </div>
      )}
      {confirm && (
        <div className="mko-layer mko-confirm-layer">
          {/* Keyed on the request so a new confirmation replaces the old one. */}
          <ConfirmBanner key={`${confirm.title}\u0000${confirm.detail}`} title={confirm.title} detail={confirm.detail} />
        </div>
      )}
    </>
  );
}
