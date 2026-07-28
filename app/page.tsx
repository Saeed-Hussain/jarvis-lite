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
import StatusBar from './components/StatusBar';
import { useJarvisStore } from '@/lib/store';

export default function Home() {
  const [view, setView] = useState<View>('dashboard');
  const hydrate = useJarvisStore((s) => s.hydrate);
  const hydrated = useJarvisStore((s) => s.hydrated);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  if (!hydrated) {
    return (
      <div className="h-screen w-screen flex items-center justify-center" style={{ backgroundColor: 'var(--jarvis-bg)', color: 'var(--jarvis-text)' }}>
        <p className="text-sm" style={{ color: 'var(--jarvis-subtext)' }}>
          Waking up Jarvis...
        </p>
      </div>
    );
  }

  const showFullDashboard = view === 'dashboard' || view === 'chat';

  return (
    <div className="h-screen w-screen flex flex-col" style={{ backgroundColor: 'var(--jarvis-bg)', color: 'var(--jarvis-text)' }}>
      <div className="flex-1 flex min-h-0">
        <Sidebar active={view} onSelect={setView} />

        <main className="flex-1 flex flex-col min-w-0">
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

            {view === 'commands' && <CommandsView />}
            {view === 'system' && <SystemView />}
            {view === 'files' && <FilesView />}
            {view === 'apps' && <AppsView />}
            {view === 'settings' && <SettingsView />}
            {view === 'memory' && <MemoryView />}
            {view === 'logs' && <LogsView />}
            {view === 'about' && <AboutView />}
          </div>
        </main>
      </div>
      <StatusBar onSelect={setView} />
    </div>
  );
}
