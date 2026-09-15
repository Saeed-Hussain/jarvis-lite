'use client';

import { useJarvisStore } from '@/lib/store';
import { KNOWN_APPS, KNOWN_SITES } from '@/lib/commands';
import { APP_ICON_MAP, AppsIcon, ClockIcon, PowerIcon } from './Icons';

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
    <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
      <section>
        <h2 className="text-[15px] font-semibold mb-1">Chained commands</h2>
        <p className="text-xs mb-2" style={{ color: 'var(--jarvis-subtext)' }}>
          Say several things at once — Jarvis splits them into steps and runs them in order,
          asking only for what it genuinely doesn&apos;t know.
        </p>
        <div className="flex flex-col gap-2">
          {CHAINED_EXAMPLES.map((example) => (
            <button
              key={example}
              onClick={() => sendMessage(example)}
              className="glass-panel rounded-lg p-3 text-left text-[13px] hover:brightness-110 active:scale-[0.99]"
            >
              &ldquo;{example}&rdquo;
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-[15px] font-semibold mb-2">Apps</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {KNOWN_APPS.map((app) => {
            const Icon = APP_ICON_MAP[app.icon] || AppsIcon;
            return (
              <button key={app.key} onClick={() => sendMessage(`open ${app.key}`)} className="glass-panel rounded-lg p-3 flex items-center gap-3 text-left hover:brightness-110 active:scale-[0.97]">
                <Icon width={20} height={20} style={{ color: 'var(--jarvis-accent)' }} />
                <div>
                  <p className="font-medium text-[13px]">{app.label}</p>
                  <p className="text-xs" style={{ color: 'var(--jarvis-subtext)' }}>
                    &quot;open {app.aliases[0]}&quot;
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="text-[15px] font-semibold mb-2">Websites</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {KNOWN_SITES.map((site) => {
            const Icon = APP_ICON_MAP[site.icon] || AppsIcon;
            return (
              <button key={site.key} onClick={() => sendMessage(`open ${site.key}`)} className="glass-panel rounded-lg p-3 flex items-center gap-3 text-left hover:brightness-110 active:scale-[0.97]">
                <Icon width={20} height={20} style={{ color: 'var(--jarvis-accent)' }} />
                <div>
                  <p className="font-medium text-[13px]">{site.label}</p>
                  <p className="text-xs" style={{ color: 'var(--jarvis-subtext)' }}>
                    &quot;open {site.aliases[0]}&quot;
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="text-[15px] font-semibold mb-2">Utilities &amp; System</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <button onClick={() => sendMessage('what time is it')} className="glass-panel rounded-lg p-3 flex items-center gap-3 text-left hover:brightness-110 active:scale-[0.97]">
            <ClockIcon width={20} height={20} style={{ color: 'var(--jarvis-accent)' }} />
            <div>
              <p className="font-medium text-[13px]">Time &amp; Date</p>
              <p className="text-xs" style={{ color: 'var(--jarvis-subtext)' }}>
                &quot;what time is it&quot;
              </p>
            </div>
          </button>
          <button onClick={() => sendMessage('shutdown pc')} className="glass-panel rounded-lg p-3 flex items-center gap-3 text-left hover:brightness-110 active:scale-[0.97]">
            <PowerIcon width={20} height={20} style={{ color: 'var(--jarvis-danger)' }} />
            <div>
              <p className="font-medium text-[13px]">Shutdown</p>
              <p className="text-xs" style={{ color: 'var(--jarvis-subtext)' }}>
                Asks for confirmation
              </p>
            </div>
          </button>
        </div>
      </section>

      <section>
        <h2 className="text-[15px] font-semibold mb-2">Learned Commands</h2>
        {customEntries.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--jarvis-subtext)' }}>
            None yet. Type an unknown command in Chat and Jarvis will ask what to do — it remembers your answer here.
          </p>
        ) : (
          <div className="glass-panel rounded-xl divide-y" style={{ borderColor: 'var(--jarvis-border)' }}>
            {customEntries.map(([trigger, action]) => (
              <div key={trigger} className="flex items-center justify-between px-4 py-3 text-sm">
                <span className="font-medium">&quot;{trigger}&quot;</span>
                <span style={{ color: 'var(--jarvis-subtext)' }}>{action}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
