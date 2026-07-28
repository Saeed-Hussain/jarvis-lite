'use client';

import { useEffect, useRef } from 'react';
import { useJarvisStore } from '@/lib/store';
import { UserIcon, BotIcon, CheckIcon, CloseIcon, APP_ICON_MAP, AppsIcon } from './Icons';
import { formatTime } from '@/lib/utils';

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
                <p className="text-[13px]">{msg.text}</p>
                <p className="text-[10px] mt-0.5" style={{ color: 'var(--jarvis-subtext)' }}>
                  {formatTime(new Date(msg.timestamp))}
                </p>
              </div>
            </div>

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
