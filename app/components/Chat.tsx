'use client';

import { useEffect, useRef } from 'react';
import { useJarvisStore } from '@/lib/store';
import { CheckIcon, CloseIcon, APP_ICON_MAP, AppsIcon } from './Icons';
import { formatTime } from '@/lib/utils';
import type { TaskStatus } from '@/lib/types';
import './views.css';

/** The plan timeline marks each step by shape and colour, not by glyph. */
function StepMark({ status }: { status: TaskStatus }) {
  return (
    <span className="v-step-mark" data-s={status}>
      {status === 'done' && <CheckIcon width={10} height={10} strokeWidth={3} />}
      {status === 'failed' && <CloseIcon width={10} height={10} strokeWidth={3} />}
    </span>
  );
}

export default function Chat() {
  const messages = useJarvisStore((s) => s.messages);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  return (
    <div className="v-chat">
      {messages.map((msg) => {
        if (msg.role === 'user') {
          return (
            <div key={msg.id} className="v-msg you">
              <div className="v-bubble">{msg.text}</div>
              <span className="v-msg-time">{formatTime(new Date(msg.timestamp))}</span>
            </div>
          );
        }

        const AppIcon = msg.result?.appIcon ? APP_ICON_MAP[msg.result.appIcon] || AppsIcon : null;

        return (
          <div key={msg.id} className="v-msg ai">
            <div className="v-bubble">{msg.text}</div>
            <span className="v-msg-time">{formatTime(new Date(msg.timestamp))}</span>

            {/* Step timeline - only worth showing once a plan has several steps */}
            {msg.plan && msg.plan.tasks.length > 1 && (
              <div className="v-attach">
                <p className="v-card-sub" style={{ margin: 0 }}>
                  Plan · {msg.plan.tasks.length} steps
                </p>
                <ol className="v-steps">
                  {msg.plan.tasks.map((task) => (
                    <li key={task.id} data-s={task.status}>
                      <StepMark status={task.status} />
                      <span>
                        {task.label}
                        {task.note ? ` — ${task.note}` : ''}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {msg.result?.appLabel && (
              <div className="v-attach row">
                <span className="v-tile-ico">{AppIcon && <AppIcon width={17} height={17} />}</span>
                <div className="v-tile-text" style={{ flex: 1 }}>
                  <b>{msg.result.appLabel}</b>
                  <small style={{ color: msg.result.success ? 'var(--good)' : 'var(--bad)', whiteSpace: 'normal' }}>
                    {msg.result.success ? 'Application opened successfully' : msg.result.message}
                  </small>
                </div>
                <span
                  className="v-result-ico"
                  style={{ ['--tone' as string]: msg.result.success ? 'var(--good)' : 'var(--bad)' } as React.CSSProperties}
                >
                  {msg.result.success ? <CheckIcon width={12} height={12} /> : <CloseIcon width={12} height={12} />}
                </span>
              </div>
            )}

            {/* Nothing matched and there is no model to fall back on. Offering
                one is a better answer than asking the user to teach every
                phrasing they might ever use. */}
            {msg.offerBrain && (
              <div className="v-attach" style={{ maxWidth: 460 }}>
                <p className="v-caption" style={{ color: 'var(--ink-2)' }}>
                  I only know the phrasings I was written with. I can run a small language model
                  inside the app so I understand this sort of thing on my own — it downloads once
                  (~400MB) and nothing is sent anywhere.
                </p>
                <button onClick={() => useJarvisStore.getState().enableBrain()} className="btn accent sm" style={{ marginTop: 10 }}>
                  Turn on the local model
                </button>
              </div>
            )}

            {msg.needsConfirmation && (
              <div className="flex gap-2">
                <button onClick={() => useJarvisStore.getState().sendMessage('yes')} className="btn solid-bad sm">
                  Confirm
                </button>
                <button onClick={() => useJarvisStore.getState().sendMessage('no')} className="btn sm">
                  Cancel
                </button>
              </div>
            )}
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
