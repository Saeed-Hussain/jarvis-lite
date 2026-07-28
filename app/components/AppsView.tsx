'use client';

import { useJarvisStore } from '@/lib/store';
import { KNOWN_APPS } from '@/lib/commands';
import { APP_ICON_MAP, AppsIcon } from './Icons';

export default function AppsView() {
  const sendMessage = useJarvisStore((s) => s.sendMessage);

  return (
    <div className="flex-1 overflow-y-auto p-5">
      <h2 className="text-[15px] font-semibold mb-1">Apps</h2>
      <p className="text-xs mb-4" style={{ color: 'var(--jarvis-subtext)' }}>
        One tap launches the app through the Electron main process.
      </p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        {KNOWN_APPS.map((app) => {
          const Icon = APP_ICON_MAP[app.icon] || AppsIcon;
          return (
            <button
              key={app.key}
              onClick={() => sendMessage(`open ${app.key}`)}
              className="glass-panel rounded-lg p-3 flex flex-col items-center gap-2 hover:brightness-110 active:scale-[0.97]"
            >
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--jarvis-bg)' }}>
                <Icon width={17} height={17} style={{ color: 'var(--jarvis-accent)' }} />
              </div>
              <p className="text-[12px] font-medium">{app.label}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
