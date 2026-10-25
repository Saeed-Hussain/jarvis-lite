'use client';

// Mark's PluginManagerOverlay: every discovered plugin with an ON/OFF toggle.
// A plugin that failed to load shows its file and a disabled BROKEN button;
// Mark put the load error in a tooltip, which is easy to miss, so it is also
// printed under the row. "Open plugins folder" is jarvis-lite's way in for
// dropping new plugins, since there is no source tree to put them in.

import { useEffect, useState } from 'react';
import { useMarkStore } from '@/lib/mark/store';
import { markBridge, type PluginInfo } from '@/lib/mark/types';
import { FolderIcon, PuzzleIcon } from '../../Icons';
import { Modal, errText } from './common';

export default function PluginManagerOverlay() {
  const [plugins, setPlugins] = useState<PluginInfo[] | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const bridge = markBridge();
    if (!bridge) {
      setPlugins([]);
      return;
    }
    bridge
      .pluginsList()
      .then((list) => alive && setPlugins(list || []))
      .catch((e) => {
        if (!alive) return;
        setPlugins([]);
        setError(errText(e));
      });
    return () => {
      alive = false;
    };
  }, []);

  const toggle = async (p: PluginInfo) => {
    const bridge = markBridge();
    if (!bridge || busy) return;
    setBusy(p.name);
    setError('');
    try {
      const list = await bridge.pluginToggle(p.name, !p.enabled);
      setPlugins(list || []);
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(null);
    }
  };

  const openFolder = async () => {
    const bridge = markBridge();
    if (!bridge) return;
    try {
      // shell.openPath resolves to '' on success, else an error string.
      const err = await bridge.openPluginsFolder();
      if (err) setError(err);
    } catch (e) {
      setError(errText(e));
    }
  };

  const close = () => useMarkStore.getState().setOverlay(null);

  return (
    <Modal
      width={460}
      icon={<PuzzleIcon />}
      title="Plugins"
      description="Turn skills on and off, or drop new ones into the plugins folder."
      onClose={close}
      footer={
        <>
          <button className="btn ghost" onClick={openFolder}>
            <FolderIcon width={16} height={16} />
            Open plugins folder
          </button>
          <button className="btn primary" onClick={close}>
            Done
          </button>
        </>
      }
    >
      {plugins === null && (
        <div className="mko-well">
          <div className="mko-empty">Scanning…</div>
        </div>
      )}
      {plugins !== null && plugins.length === 0 && (
        <div className="mko-well">
          <div className="mko-empty">
            <span className="mko-empty-ico">
              <PuzzleIcon />
            </span>
            <b>No plugins yet</b>
            No plugins found in /plugins.
          </div>
        </div>
      )}

      {plugins !== null && plugins.length > 0 && (
        <div className="mko-well rows">
          {plugins.map((p) =>
            p.valid ? (
              <button
                key={`${p.name}\u0000${p.file}`}
                className="mk-row"
                role="switch"
                aria-checked={p.enabled}
                title={p.description}
                disabled={busy === p.name}
                onClick={() => toggle(p)}
              >
                <span className="mk-row-ico">
                  <PuzzleIcon />
                </span>
                <span className="mk-row-text">
                  <b className="mk-ellipsis">{p.name}</b>
                  {p.description && <small className="mk-ellipsis">{p.description}</small>}
                </span>
                <span className={`switch${p.enabled ? ' on' : ''}`} />
              </button>
            ) : (
              <div key={`${p.name}\u0000${p.file}`} className="mk-row" title={p.error}>
                <span className="mk-row-ico" style={{ color: 'var(--bad)' }}>
                  <PuzzleIcon />
                </span>
                <span className="mk-row-text">
                  <b className="mk-ellipsis" style={{ color: 'var(--ink-2)' }}>
                    {p.name}
                  </b>
                  <small className="mk-ellipsis">{p.file}</small>
                  {p.error && <span className="mko-row-sub-err">{p.error}</span>}
                </span>
                <span className="chip" style={{ color: 'var(--bad)' }}>
                  <i className="dot" />
                  Broken
                </span>
              </div>
            ),
          )}
        </div>
      )}

      {error && <div className="mko-err">{error}</div>}
    </Modal>
  );
}
