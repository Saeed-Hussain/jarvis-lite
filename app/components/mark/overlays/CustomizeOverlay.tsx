'use client';

// Mark's CustomizeOverlay: assistant name, your name, voice and UI colour.
//
// Colour flow is Mark's: dragging the wheel only updates the hex box; letting
// go (or typing a valid hex, or DEFAULT) live-previews the whole interface
// without writing config; CANCEL puts the launch colour back; APPLY persists.
// The HUD derives its palette from config.ui_color, so the preview patches
// that in the store (not on disk) as well as calling applyAccent.

import { useEffect, useRef, useState } from 'react';
import { applyAccent, useMarkStore } from '@/lib/mark/store';
import { PaletteIcon } from '../../Icons';
import { Field, Group, Modal, errText } from './common';
import HueWheel, { hexToHue } from './HueWheel';

const DEFAULT_UI_COLOR = '#00d4ff';
const DEFAULT_VOICE = 'Charon';

/** MainWindow._preview_ui_color: repaint everything, write nothing. */
function previewColor(hex: string): void {
  const st = useMarkStore.getState();
  if (st.config && st.config.ui_color !== hex) {
    useMarkStore.setState({ config: { ...st.config, ui_color: hex } });
  }
  applyAccent(hex);
}

export default function CustomizeOverlay() {
  const cfg = useMarkStore.getState().config;
  const voices = useMarkStore((s) => s.config?.voices) || [DEFAULT_VOICE];

  const [name, setName] = useState(cfg?.assistant_name || 'JARVIS');
  const [user, setUser] = useState(cfg?.user_name || '');
  const [voice, setVoiceSel] = useState(() => {
    const v = cfg?.voice_name || DEFAULT_VOICE;
    return voices.includes(v) ? v : DEFAULT_VOICE;
  });

  const initial = useRef((cfg?.ui_color || DEFAULT_UI_COLOR).trim().toLowerCase());
  const [color, setColorState] = useState(initial.current);
  const [hexText, setHexText] = useState(initial.current);
  const [hue, setHue] = useState(() => hexToHue(initial.current) ?? 0.53);
  const selRef = useRef(initial.current);
  const closedRef = useRef(false);

  // Leaving without APPLY or CANCEL (another overlay replaced this one) must
  // not strand a previewed colour that was never saved.
  useEffect(
    () => () => {
      if (!closedRef.current && selRef.current !== initial.current) previewColor(initial.current);
    },
    [],
  );

  /** _set_color: hex box + wheel in sync, theme live-previewed. */
  const setColor = (hx: string, updateWheel = true, preview = true) => {
    const c = hx.trim().toLowerCase();
    selRef.current = c;
    setColorState(c);
    setHexText(c);
    if (updateWheel) {
      const h = hexToHue(c);
      if (h !== null) setHue(h);
    }
    if (preview) previewColor(c);
  };

  const cancel = () => {
    closedRef.current = true;
    if (selRef.current !== initial.current) previewColor(initial.current);
    useMarkStore.getState().setOverlay(null);
  };

  /** CustomizeOverlay._save → MainWindow._apply_name_update. */
  const save = async () => {
    closedRef.current = true;
    const st = useMarkStore.getState();
    st.setOverlay(null);

    const assistant = name.trim() || 'JARVIS';
    const userName = user.trim();
    const uiColor = (color || DEFAULT_UI_COLOR).trim().toLowerCase();
    const display = assistant.toUpperCase();
    const colorChanged = uiColor !== initial.current;
    const prevVoice = cfg?.voice_name || DEFAULT_VOICE;
    const voiceChanged = !!voice && voice !== prevVoice;

    try {
      const saved = await st.saveConfig({
        assistant_name: assistant,
        user_name: userName,
        ui_color: uiColor,
      });
      if (!saved) throw new Error('the settings store is unavailable');
      st.writeLog(`SYS: Identity updated — ${display}`);
      if (colorChanged) st.writeLog(`SYS: UI colour applied — ${uiColor}`);
      if (voiceChanged) st.writeLog(`SYS: Voice set — ${voice}`);
    } catch (e) {
      st.writeLog(`ERR: Config save failed — ${errText(e)}`);
      // The preview is not what is on disk any more; show what is.
      await st.refreshConfig().catch(() => null);
    }
    // Voice is fixed at connect time; setVoice persists it and rebuilds the
    // Live session only when it actually changed.
    if (voiceChanged) {
      try {
        await st.setVoice(voice);
      } catch (e) {
        st.writeLog(`ERR: Config save failed — ${errText(e)}`);
      }
    }
  };

  return (
    <Modal
      width={440}
      icon={<PaletteIcon />}
      title="Customise assistant"
      description="Its name, what it calls you, its voice and colour."
      onClose={cancel}
      footer={
        <>
          <button className="btn" onClick={cancel}>
            Cancel
          </button>
          <button className="btn primary" onClick={save}>
            Apply changes
          </button>
        </>
      }
    >
      <Group title="Identity">
        <Field label="Assistant name">
          <input className="field" value={name} spellCheck={false} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Your name" hint="Leave blank for the default — sir / efendim.">
          <input
            className="field"
            value={user}
            placeholder="e.g. Tony"
            spellCheck={false}
            onChange={(e) => setUser(e.target.value)}
          />
        </Field>
      </Group>

      <Group title="Voice">
        <div className="mko-pills" role="radiogroup" aria-label="Assistant voice">
          {voices.map((v) => (
            <button
              key={v}
              className={`mko-pill${v === voice ? ' sel' : ''}`}
              role="radio"
              aria-checked={v === voice}
              onClick={() => setVoiceSel(v)}
            >
              {v}
            </button>
          ))}
        </div>
      </Group>

      <Group
        title="Colour"
        aside={
          <button className="btn ghost sm mko-mini" onClick={() => setColor(DEFAULT_UI_COLOR)}>
            Reset to default
          </button>
        }
      >
        <div className="mko-color">
          <HueWheel
            hue={hue}
            onPick={(hx, h) => {
              // While dragging: hex box only, the theme waits for release.
              setHue(h);
              selRef.current = hx;
              setColorState(hx);
              setHexText(hx);
            }}
            onCommit={(hx) => setColor(hx, false)}
          />
          <div className="mko-color-side">
            <Field label="Hex" hint="Drag the handle round the ring, or type a colour.">
              <span className="mko-swatch-row">
                <span className="mko-swatch" style={{ background: color, color }} aria-hidden />
                <input
                  className="field mono"
                  value={hexText}
                  placeholder="#00d4ff"
                  spellCheck={false}
                  onChange={(e) => {
                    const text = e.target.value;
                    setHexText(text);
                    const t = text.trim().toLowerCase();
                    if (/^#[0-9a-f]{6}$/.test(t)) {
                      setColor(t, true, true);
                      setHexText(text);
                    }
                  }}
                />
              </span>
            </Field>
          </div>
        </div>
      </Group>
    </Modal>
  );
}
