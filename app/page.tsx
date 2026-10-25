'use client';

import { useEffect, useState } from 'react';
import Sidebar, { View } from './components/Sidebar';
import TopBar from './components/TopBar';
import Chat from './components/Chat';
import InputBar from './components/InputBar';
import StatusPanel from './components/StatusPanel';
import CommandsView from './components/CommandsView';
import LogsView from './components/LogsView';
import SettingsView from './components/SettingsView';
import AboutView from './components/AboutView';
import FilesView from './components/FilesView';
import AppsView from './components/AppsView';
import SystemView from './components/SystemView';
import MemoryView from './components/MemoryView';
import PilotView from './components/PilotView';
import StatusBar from './components/StatusBar';
import MarkHud from './components/mark/MarkHud';
import Backdrop from './components/Backdrop';
import { useJarvisStore } from '@/lib/store';
import { useMarkStore } from '@/lib/mark/store';
import { startMarkLive } from '@/lib/mark/live';
// Registers the local "Hey Jarvis" detector with the Live controller.
import '@/lib/mark/wake';

export default function Home() {
  const [view, setView] = useState<View>('hud');
  const hydrate = useJarvisStore((s) => s.hydrate);
  const hydrated = useJarvisStore((s) => s.hydrated);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // Mark LIV runs for the life of the window, whichever view is showing: it is
  // a voice assistant, and switching to the old panels must not hang it up.
  useEffect(() => {
    useMarkStore
      .getState()
      .init()
      .catch((e) => console.error('[Mark] init failed', e))
      .finally(() => startMarkLive());
  }, []);

  if (!hydrated) {
    return (
      <>
        <Backdrop />
        <div className="relative z-[1] h-screen w-screen flex items-center justify-center">
          <p className="text-sm" style={{ color: 'var(--ink-3)' }}>
            Waking up Jarvis…
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <Backdrop />
      <div className="app-shell">
        <Sidebar active={view} onSelect={setView} />

        <main className="app-main">
          {/* The assistant brings its own header (it doubles as the title bar). */}
          {view === 'hud' && <MarkHud />}

          {view !== 'hud' && (
            <div key={view} className="page-in flex-1 flex flex-col min-h-0">
              <TopBar />
              <div className="flex-1 flex min-h-0">
                {view === 'dashboard' && (
                  <>
                    <section className="flex-1 flex flex-col min-w-0">
                      <Chat />
                      <InputBar />
                    </section>
                    <StatusPanel onSelect={setView} />
                  </>
                )}

                {view === 'chat' && (
                  <section className="flex-1 flex flex-col min-w-0">
                    <Chat />
                    <InputBar />
                  </section>
                )}

                {view === 'pilot' && <PilotView />}
                {view === 'commands' && <CommandsView />}
                {view === 'system' && <SystemView />}
                {view === 'files' && <FilesView />}
                {view === 'apps' && <AppsView />}
                {view === 'settings' && <SettingsView />}
                {view === 'memory' && <MemoryView />}
                {view === 'logs' && <LogsView />}
                {view === 'about' && <AboutView />}
              </div>
              <StatusBar onSelect={setView} />
            </div>
          )}
        </main>
      </div>
    </>
  );
}
