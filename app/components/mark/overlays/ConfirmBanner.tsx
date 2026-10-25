'use client';

// Mark's ConfirmBanner: the gate in front of an action that cannot be taken
// back. The answer goes from a human finger to the main process
// (confirm.js) without the model in the loop. Nothing blocks while it is up;
// the main process withdraws it (confirm-hide) when its 90 s timeout lapses.

import { useMarkStore } from '@/lib/mark/store';
import { ShieldIcon } from '../../Icons';

export default function ConfirmBanner(props: { title: string; detail: string }) {
  const { title, detail } = props;
  const answer = (ok: boolean) => useMarkStore.getState().answerConfirm(ok);
  return (
    <div className="mko-confirm glass-strong" role="alertdialog" aria-labelledby="mko-confirm-t" aria-describedby="mko-confirm-d">
      <span className="mko-confirm-ico">
        <ShieldIcon />
      </span>
      <div className="mko-confirm-main">
        <span className="mko-confirm-eyebrow">Needs your confirmation</span>
        <h2 className="mko-confirm-title" id="mko-confirm-t">
          {title}
        </h2>
        {detail && (
          <p className="mko-confirm-detail" id="mko-confirm-d">
            {detail}
          </p>
        )}
        <div className="mko-confirm-btns">
          {/* Default focus on Cancel: Enter without reading picks the safe answer. */}
          <button className="btn" autoFocus onClick={() => answer(false)}>
            Cancel
          </button>
          <button className="btn danger mko-danger" onClick={() => answer(true)}>
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
