'use client';

// Mark's MemoryOverlay: everything the assistant has stored about you, newest
// first, with the date it learned it, and ✕ to forget one. A memory you
// cannot inspect is a memory you cannot trust, and "delete" has to be
// something the person can do.
//
// Mark's _settle/_rebuild dance existed to stop Qt leaving ghost pixels when
// the hand-placed panel shrank. Here the forgotten row collapses out, the list
// is re-read from disk, and the flex layer keeps the panel centred as it
// resizes.

import { useCallback, useEffect, useState } from 'react';
import { useMarkStore } from '@/lib/mark/store';
import { markBridge, type MemoryRow } from '@/lib/mark/types';
import { CloseIcon, MemoryIcon } from '../../Icons';
import { Modal, displayName, errText } from './common';

const rowId = (r: MemoryRow) => `${r.category}\u0000${r.key}`;

/** all_entries_for_ui order: newest first, undated last. */
function sortRows(rows: MemoryRow[]): MemoryRow[] {
  return [...rows].sort((a, b) =>
    (b.updated || '0000-00-00').localeCompare(a.updated || '0000-00-00'),
  );
}

export default function MemoryOverlay() {
  const name = useMarkStore((s) => s.config?.assistant_name) || 'JARVIS';
  const [rows, setRows] = useState<MemoryRow[] | null>(null);
  const [leaving, setLeaving] = useState<Set<string>>(() => new Set());
  const [error, setError] = useState('');

  const rebuild = useCallback(async () => {
    const bridge = markBridge();
    if (!bridge) {
      setRows([]);
      return;
    }
    try {
      setRows(sortRows((await bridge.memoryList()) || []));
      setError('');
    } catch (e) {
      setRows((r) => r ?? []);
      setError(errText(e));
    }
  }, []);

  useEffect(() => {
    rebuild();
  }, [rebuild]);

  const forget = async (r: MemoryRow) => {
    const bridge = markBridge();
    if (!bridge) return;
    const id = rowId(r);
    if (leaving.has(id)) return;
    setLeaving((s) => new Set(s).add(id));
    try {
      await Promise.all([
        bridge.memoryForget(r.category, r.key),
        // Let the row finish collapsing before the list is replaced.
        new Promise((res) => setTimeout(res, 180)),
      ]);
    } catch (e) {
      setError(errText(e));
    }
    await rebuild();
    setLeaving((s) => {
      const n = new Set(s);
      n.delete(id);
      return n;
    });
  };

  const count = rows?.length ?? 0;
  const close = () => useMarkStore.getState().setOverlay(null);

  return (
    <Modal
      width={540}
      icon={<MemoryIcon />}
      title={`What ${displayName(name)} remembers`}
      description={
        rows === null
          ? 'Reading memory…'
          : `${count} stored facts, newest first. Nothing here is sent anywhere — it lives in ` +
            `long_term.json on this machine.`
      }
      onClose={close}
      footer={
        <button className="btn primary" onClick={close}>
          Done
        </button>
      }
    >
      {rows !== null && rows.length === 0 && (
        <div className="mko-well">
          <div className="mko-empty">
            <span className="mko-empty-ico">
              <MemoryIcon />
            </span>
            <b>Nothing stored yet</b>
            Things you tell it to remember will show up here.
          </div>
        </div>
      )}

      {rows !== null && rows.length > 0 && (
        <div className="mko-well rows mko-mem">
          {rows.map((r) => {
            const id = rowId(r);
            return (
              <div key={id} className={`mko-mem-row${leaving.has(id) ? ' leaving' : ''}`}>
                <div className="mko-mem-text">
                  <span className="mko-mem-key">{r.key.replace(/_/g, ' ')}</span>
                  <span className="mko-mem-val">{r.value}</span>
                  <span className="mko-mem-meta">{`${r.category} · ${r.updated || '—'}`}</span>
                </div>
                <button
                  className="btn ghost icon sm mko-forget"
                  title="Forget this"
                  aria-label={`Forget ${r.key.replace(/_/g, ' ')}`}
                  onClick={() => forget(r)}
                >
                  <CloseIcon width={15} height={15} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {error && <div className="mko-err">{error}</div>}
    </Modal>
  );
}
