'use client';

import { useEffect, useRef } from 'react';
import { useJarvisStore } from '@/lib/store';
import { UserIcon, BotIcon, CheckIcon, CloseIcon, APP_ICON_MAP, AppsIcon } from './Icons';
import { formatTime } from '@/lib/utils';
import type { TaskStatus } from '@/lib/types';

/** Compact status marks for the plan timeline. */
const STEP_GLYPH: Record<TaskStatus, string> = {
  pending: '○',
  running: '◐',
  done: '✓',
  failed: '✕',
  skipped: '–',
  blocked: '?',
};

const STEP_COLOR: Record<TaskStatus, string> = {
  pending: 'var(--jarvis-subtext)',
  running: 'var(--jarvis-accent)',
  done: 'var(--jarvis-success)',
  failed: 'var(--jarvis-danger)',
  skipped: 'var(--jarvis-subtext)',
  blocked: 'var(--jarvis-accent-2)',
};

export default function Chat() {
  const messages = useJarvisStore((s) => s.messages);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-2.5">
      {messages.map((msg) => {
        if (msg.role === 'user') {
          return (
            <div key={msg.id} className="flex items-start gap-3 justify-end">
              <div className="flex items-end gap-2 max-w-[70%]">
                <span className="text-[10px] mb-1" style={{ color: 'var(--jarvis-subtext)' }}>
                  {formatTime(new Date(msg.timestamp))}
                </span>
                <div className="rounded-xl rounded-tr-sm px-3 py-2 text-[13px] text-white" style={{ backgroundColor: 'var(--jarvis-accent)' }}>
                  {msg.text}
                </div>
              </div>
              <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 glass-panel">
                <UserIcon width={14} height={14} style={{ color: 'var(--jarvis-subtext)' }} />
              </div>
            </div>
          );
        }

        const AppIcon = msg.result?.appIcon ? APP_ICON_MAP[msg.result.appIcon] || AppsIcon : null;

        return (
          <div key={msg.id} className="flex flex-col gap-2 items-start">
            <div className="flex items-start gap-3 max-w-[75%]">
              <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 border" style={{ borderColor: 'var(--jarvis-accent-2)' }}>
                <BotIcon width={13} height={13} style={{ color: 'var(--jarvis-accent-2)' }} />
              </div>
              <div className="glass-panel rounded-xl rounded-tl-sm px-3 py-2">
                <p className="text-[13px] whitespace-pre-line">{msg.text}</p>
                <p className="text-[10px] mt-0.5" style={{ color: 'var(--jarvis-subtext)' }}>
                  {formatTime(new Date(msg.timestamp))}
                </p>
              </div>
            </div>

            {/* Step timeline - only worth showing once a plan has several steps */}
            {msg.plan && msg.plan.tasks.length > 1 && (
              <div className="ml-9 glass-panel rounded-lg px-3 py-2.5 min-w-[260px]">
                <p className="text-[10px] uppercase tracking-wide mb-1.5" style={{ color: 'var(--jarvis-subtext)' }}>
                  Plan · {msg.plan.tasks.length} steps
                </p>
                <ol className="flex flex-col gap-1">
                  {msg.plan.tasks.map((task, i) => (
                    <li key={task.id} className="flex items-start gap-2 text-[12px]">
                      <span className="w-4 shrink-0 text-right" style={{ color: 'var(--jarvis-subtext)' }}>
                        {i + 1}
                      </span>
                      <span className="shrink-0 mt-[1px]">{STEP_GLYPH[task.status]}</span>
                      <span style={{ color: STEP_COLOR[task.status] }}>
                        {task.label}
                        {task.note ? ` — ${task.note}` : ''}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {msg.result?.appLabel && (
              <div className="ml-9 glass-panel rounded-lg px-3 py-2.5 flex items-center gap-2.5 min-w-[220px]">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--jarvis-bg)' }}>
                  {AppIcon && <AppIcon width={15} height={15} style={{ color: 'var(--jarvis-accent)' }} />}
                </div>
                <div className="flex-1">
                  <p className="text-[13px] font-semibold">{msg.result.appLabel}</p>
                  <p className="text-xs" style={{ color: msg.result.success ? 'var(--jarvis-success)' : 'var(--jarvis-danger)' }}>
                    {msg.result.success ? 'Application opened successfully' : msg.result.message}
                  </p>
                </div>
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                  style={{ backgroundColor: msg.result.success ? 'color-mix(in srgb, var(--jarvis-success) 20%, transparent)' : 'color-mix(in srgb, var(--jarvis-danger) 20%, transparent)' }}
                >
                  {msg.result.success ? (
                    <CheckIcon width={11} height={11} style={{ color: 'var(--jarvis-success)' }} />
                  ) : (
                    <CloseIcon width={11} height={11} style={{ color: 'var(--jarvis-danger)' }} />
                  )}
                </div>
              </div>
            )}

            {/* Nothing matched and there is no model to fall back on. Offering
                one is a better answer than asking the user to teach every
                phrasing they might ever use. */}
            {msg.offerBrain && (
              <div className="ml-9 glass-panel rounded-lg px-3 py-2.5 max-w-[75%]">
                <p className="text-[12px]" style={{ color: 'var(--jarvis-subtext)' }}>
                  I only know the phrasings I was written with. I can run a small language model
                  inside the app so I understand this sort of thing on my own — it downloads once
                  (~400MB) and nothing is sent anywhere.
                </p>
                <button
                  onClick={() => useJarvisStore.getState().enableBrain()}
                  className="mt-2 px-3 py-1.5 rounded-md text-xs font-medium text-white"
                  style={{ backgroundColor: 'var(--jarvis-accent)' }}
                >
                  Turn on the local model
                </button>
              </div>
            )}

            {msg.needsConfirmation && (
              <div className="ml-9 flex gap-2">
                <button
                  onClick={() => useJarvisStore.getState().sendMessage('yes')}
                  className="px-3 py-1.5 rounded-md text-xs font-medium text-white"
                  style={{ backgroundColor: 'var(--jarvis-danger)' }}
                >
                  Confirm
                </button>
                <button
                  onClick={() => useJarvisStore.getState().sendMessage('no')}
                  className="px-3 py-1.5 rounded-md text-xs font-medium glass-panel"
                >
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
