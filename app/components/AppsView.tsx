'use client';

import { useJarvisStore } from '@/lib/store';
import { KNOWN_APPS } from '@/lib/commands';
import { APP_ICON_MAP, AppsIcon } from './Icons';
import './views.css';

export default function AppsView() {
  const sendMessage = useJarvisStore((s) => s.sendMessage);

  return (
    <div className="v-page">
      <div className="v-page-inner">
        <header className="v-head">
          <div>
            <h1>Apps</h1>
            <p className="sub">One tap launches the app through the Electron main process.</p>
          </div>
        </header>

        <section className="glass v-card">
          <div className="v-grid apps">
            {KNOWN_APPS.map((app) => {
              const Icon = APP_ICON_MAP[app.icon] || AppsIcon;
              return (
                <button key={app.key} onClick={() => sendMessage(`open ${app.key}`)} className="v-tile col">
                  <span className="v-tile-ico" style={{ width: 42, height: 42, borderRadius: 13 }}>
                    <Icon width={19} height={19} />
                  </span>
                  <span className="v-tile-text" style={{ maxWidth: '100%' }}>
                    <b>{app.label}</b>
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
