'use client';

import { useState } from 'react';
import { useMarkStore } from '@/lib/mark/store';
import { markBridge } from '@/lib/mark/types';
import {
  ChevronRightIcon,
  CoffeeIcon,
  EarIcon,
  ExpandIcon,
  FaceIcon,
  HeadphonesIcon,
  MemoryIcon,
  MicIcon,
  PaletteIcon,
  PhoneIcon,
  PowerIcon,
  PuzzleIcon,
  SettingsIcon,
  ShortcutIcon,
  SparkIcon,
} from '../Icons';

/** The push-to-talk chord (core/hotkey.py DEFAULT_CHORD). */
export const PTT_CHORD_LABEL = 'Ctrl+Space';

export function toggleFullscreen(): void {
  if (typeof document === 'undefined') return;
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  else document.documentElement.requestFullscreen().catch(() => {});
}

/** The ⚙ drawer under the header: every setting and switch Mark keeps there. */
export default function QuickDrawer() {
  const s = useMarkStore();
  const log = s.writeLog;
  const [downloading, setDownloading] = useState(false);

  const remote = async () => {
    await s.openRemote();
    const st = useMarkStore.getState();
    if (st.overlay === 'remote' && st.remote) {
      log(`SYS: Remote key generated — manual: ${st.remote.manualUrl || st.remote.url}`);
    }
  };

  const shortcut = async () => {
    const bridge = markBridge();
    if (!bridge) return;
    try {
      const r = await bridge.desktopShortcut();
      log(r.ok ? 'SYS: Desktop shortcut created.' : `ERR: Shortcut failed — ${r.message}`);
    } catch (e) {
      log(`ERR: Shortcut failed — ${(e as Error)?.message || e}`);
    }
  };

  const autostart = async () => {
    const was = s.autostart;
    try {
      await s.toggleAutostart();
      const now = useMarkStore.getState().autostart;
      if (now !== was) log(`SYS: Auto-start ${now ? 'enabled' : 'disabled'}.`);
      else log('ERR: Auto-start failed — the setting did not change.');
    } catch (e) {
      log(`ERR: Auto-start failed — ${(e as Error)?.message || e}`);
    }
  };

  // First use downloads the wake-word model (one time), then switches it on.
  const installWake = async () => {
    setDownloading(true);
    let ok = false;
    let msg = '';
    try {
      [ok, msg] = await s.installWakeWord((m) => log(`SYS: ${m}`));
      if (ok) await useMarkStore.getState().toggleWakeWord();
    } catch (e) {
      ok = false;
      msg = String((e as Error)?.message || e);
    }
    setDownloading(false);
    log(`SYS: ${ok ? 'Wake word ready.' : `Wake word setup failed: ${msg}`}`);
  };

  const wakeToggle = async () => {
    if (!s.wake.ready) return installWake();
    const res = await s.toggleWakeWord();
    if (res === 'need_download') installWake();
  };

  const hudStyle = async () => {
    const want = s.config?.hud_style === 'face' ? 'core' : 'face';
    await s.setHudStyle(want);
    log(want === 'face' ? 'SYS: HUD switched to the animated face.' : 'SYS: HUD switched to the reactor core.');
  };

  const brief = !!s.config?.morning_brief_enabled;
  const face = (s.config?.hud_style || 'face') === 'face';
  const ptt = s.ptt.enabled;

  const wakeOn = s.wake.ready && s.wake.enabled;
  const wakeSub = downloading
    ? 'Downloading the model (one time)…'
    : !s.wake.ready
      ? 'Download once (3.6 MB), then works offline'
      : s.wake.enabled
        ? 'Sleeps after 2 minutes of quiet'
        : 'Say “Hey Jarvis” to wake it';

  return (
    <div className="mk-drawer glass-strong" role="menu">
      <Group title="Assistant">
        <Row icon={<PaletteIcon />} label="Customise" sub="Name, your name, voice, colour" onClick={() => s.setOverlay('customize')} chevron />
        <Row icon={<CoffeeIcon />} label="Morning briefing" sub="Greeting, yesterday’s recap and the news" onClick={() => s.toggleBrief()} on={brief} />
        <div className="mk-row seg-row">
          <span className="mk-row-ico"><FaceIcon /></span>
          <span className="mk-row-text">
            <b>Centrepiece</b>
            <small>Pure taste — both cost the same</small>
          </span>
          <div className="mk-seg">
            <button className={face ? 'on' : ''} onClick={() => !face && hudStyle()}>Face</button>
            <button className={!face ? 'on' : ''} onClick={() => face && hudStyle()}>Core</button>
          </div>
        </div>
      </Group>

      <Group title="Listening">
        <Row
          icon={<EarIcon />}
          label="Wake word"
          sub={wakeSub}
          onClick={wakeToggle}
          on={wakeOn}
          disabled={downloading}
          action={!s.wake.ready && !downloading ? 'Download' : undefined}
        />
        {!downloading && wakeOn && (
          <Row icon={<SparkIcon />} label={s.wake.awake ? 'Sleep now' : 'Wake now'} sub="Without waiting for the timeout" onClick={() => s.wakeManual()} chevron />
        )}
        <Row
          icon={<MicIcon />}
          label="Push to talk"
          sub={ptt ? `Hold ${PTT_CHORD_LABEL} — the mic is closed otherwise` : `Hold ${PTT_CHORD_LABEL} instead of an open mic`}
          onClick={() => s.togglePushToTalk().catch((e) => log(`ERR: Push-to-talk failed — ${(e as Error)?.message || e}`))}
          on={ptt}
        />
      </Group>

      <Group title="Devices & data">
        <Row icon={<HeadphonesIcon />} label="Audio devices" sub="Microphone and speakers" onClick={() => s.setOverlay('audio')} chevron />
        <Row icon={<PhoneIcon />} label="Remote control" sub="Use it from your phone" onClick={remote} chevron />
        <Row icon={<MemoryIcon />} label="Memory" sub="What it knows about you" onClick={() => s.setOverlay('memory')} chevron />
        <Row icon={<PuzzleIcon />} label="Plugins" sub="Turn skills on and off" onClick={() => s.setOverlay('plugins')} chevron />
        <Row icon={<SettingsIcon />} label="Plugin settings" sub="Tokens and connections" onClick={() => s.setOverlay('plugin-settings')} chevron />
      </Group>

      <Group title="Window">
        <Row icon={<ExpandIcon />} label="Fullscreen" sub="F11" onClick={toggleFullscreen} chevron />
        <Row icon={<PowerIcon />} label="Start with Windows" sub="Opens quietly in the tray" onClick={autostart} on={s.autostart} />
        <Row icon={<ShortcutIcon />} label="Desktop shortcut" sub="Create one on your desktop" onClick={shortcut} chevron />
      </Group>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mk-group">
      <div className="label-caps">{title}</div>
      <div className="mk-group-body">{children}</div>
    </section>
  );
}

function Row({
  icon,
  label,
  sub,
  onClick,
  on,
  chevron,
  disabled,
  action,
}: {
  icon: React.ReactNode;
  label: string;
  sub?: string;
  onClick(): void;
  on?: boolean;
  chevron?: boolean;
  disabled?: boolean;
  action?: string;
}) {
  return (
    <button className="mk-row" onClick={onClick} disabled={disabled} role={on === undefined ? 'menuitem' : 'menuitemcheckbox'} aria-checked={on}>
      <span className="mk-row-ico">{icon}</span>
      <span className="mk-row-text">
        <b>{label}</b>
        {sub && <small>{sub}</small>}
      </span>
      {action ? (
        <span className="chip mk-row-action">{action}</span>
      ) : on !== undefined ? (
        <span className={`switch${on ? ' on' : ''}`} />
      ) : chevron ? (
        <ChevronRightIcon width={16} height={16} className="mk-row-chev" />
      ) : null}
    </button>
  );
}
