'use client';

import { useJarvisStore } from '@/lib/store';
import { KNOWN_APPS, KNOWN_SITES } from '@/lib/commands';
import { APP_ICON_MAP, AppsIcon, ClockIcon, PowerIcon } from './Icons';
import './views.css';

/** Multi-step phrasings that show off the planner. */
const CHAINED_EXAMPLES = [
  'hey jarvis, open chrome with profile saeed and search whatsapp web',
  'open vscode then wait 5 seconds then open spotify',
  'go to github then search for next.js static export',
  'open chrome with profile saeed, go to whatsapp web, then text sara saying running late',
];

export default function CommandsView() {
  const memory = useJarvisStore((s) => s.memory);
  const sendMessage = useJarvisStore((s) => s.sendMessage);
  const customEntries = Object.entries(memory.custom_commands);

  return (
    <div className="v-page">
      <div className="v-page-inner">
        <header className="v-head">
          <div>
            <h1>Commands</h1>
            <p className="sub">Everything Jarvis understands without a model. Click any of them to run it.</p>
          </div>
        </header>

        <section className="glass v-card">
          <div className="v-card-head">
            <div>
              <h2 className="v-card-title">Chained commands</h2>
              <p className="v-card-sub">
                Say several things at once — Jarvis splits them into steps and runs them in order,
                asking only for what it genuinely doesn&apos;t know.
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            {CHAINED_EXAMPLES.map((example) => (
              <button key={example} onClick={() => sendMessage(example)} className="v-tile quote">
                &ldquo;{example}&rdquo;
              </button>
            ))}
          </div>
        </section>

        <section className="glass v-card">
          <div className="v-card-head">
            <h2 className="v-card-title">Apps</h2>
          </div>
          <div className="v-grid">
            {KNOWN_APPS.map((app) => {
              const Icon = APP_ICON_MAP[app.icon] || AppsIcon;
              return (
                <button key={app.key} onClick={() => sendMessage(`open ${app.key}`)} className="v-tile">
                  <span className="v-tile-ico">
                    <Icon width={17} height={17} />
                  </span>
                  <span className="v-tile-text">
                    <b>{app.label}</b>
                    <small>&ldquo;open {app.aliases[0]}&rdquo;</small>
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="glass v-card">
          <div className="v-card-head">
            <h2 className="v-card-title">Websites</h2>
          </div>
          <div className="v-grid">
            {KNOWN_SITES.map((site) => {
              const Icon = APP_ICON_MAP[site.icon] || AppsIcon;
              return (
                <button key={site.key} onClick={() => sendMessage(`open ${site.key}`)} className="v-tile">
                  <span className="v-tile-ico">
                    <Icon width={17} height={17} />
                  </span>
                  <span className="v-tile-text">
                    <b>{site.label}</b>
                    <small>&ldquo;open {site.aliases[0]}&rdquo;</small>
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="glass v-card">
          <div className="v-card-head">
            <h2 className="v-card-title">Utilities &amp; system</h2>
          </div>
          <div className="v-grid">
            <button onClick={() => sendMessage('what time is it')} className="v-tile">
              <span className="v-tile-ico">
                <ClockIcon width={17} height={17} />
              </span>
              <span className="v-tile-text">
                <b>Time &amp; date</b>
                <small>&ldquo;what time is it&rdquo;</small>
              </span>
            </button>
            <button onClick={() => sendMessage('shutdown pc')} className="v-tile">
              <span className="v-tile-ico bad">
                <PowerIcon width={17} height={17} />
              </span>
              <span className="v-tile-text">
                <b>Shutdown</b>
                <small>Asks for confirmation</small>
              </span>
            </button>
          </div>
        </section>

        <section className="glass v-card">
          <div className="v-card-head">
            <div>
              <h2 className="v-card-title">Learned commands</h2>
              <p className="v-card-sub">Phrasings you taught Jarvis in chat.</p>
            </div>
          </div>
          {customEntries.length === 0 ? (
            <p className="v-caption">
              None yet. Type an unknown command in Chat and Jarvis will ask what to do — it remembers your answer here.
            </p>
          ) : (
            <div className="v-list">
              {customEntries.map(([trigger, action]) => (
                <div key={trigger} className="v-row">
                  <span style={{ fontWeight: 560 }}>&ldquo;{trigger}&rdquo;</span>
                  <span className="v-row-v" style={{ fontWeight: 400, color: 'var(--ink-2)' }}>
                    {action}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
