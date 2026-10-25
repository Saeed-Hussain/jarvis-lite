'use client';

// Mark's PluginSettingsOverlay: one generic form per settings namespace that an
// enabled plugin declared (PLUGIN_SETTINGS). It knows nothing about any
// particular plugin. Field types are Mark's — choice, toggle, text, password —
// plus the aliases the jarvis-lite schema allows (select, bool, number).
//
// SAVE writes every namespace; a section's test button saves that namespace
// first (so the test sees what was typed) and reports in its status line.

import { useEffect, useState } from 'react';
import { useMarkStore } from '@/lib/mark/store';
import {
  markBridge,
  type PluginSettingsField,
  type PluginSettingsSection,
} from '@/lib/mark/types';
import { SettingsIcon } from '../../Icons';
import { Field, Group, Modal, Select, errText } from './common';

type Kind = 'choice' | 'toggle' | 'password' | 'number' | 'text';
type Status = { text: string; color: string };

function kindOf(f: PluginSettingsField): Kind {
  const t = String(f.type || 'text').toLowerCase();
  if (t === 'choice' || t === 'select') return 'choice';
  if (t === 'toggle' || t === 'bool' || t === 'boolean') return 'toggle';
  if (t === 'password') return 'password';
  if (t === 'number') return 'number';
  return 'text';
}

const nsOf = (s: PluginSettingsSection) => s.namespace || s.plugin || 'plugin';
const fk = (ns: string, key: string) => `${ns}\u0000${key}`;

function initialValue(f: PluginSettingsField, stored: unknown): string | boolean {
  const kind = kindOf(f);
  if (kind === 'toggle') return !!stored;
  if (kind === 'choice') {
    const opts = (f.options || []).map(String);
    // Qt's setCurrentText on a fixed list ignores unknown text → first item.
    const s = stored == null ? '' : String(stored);
    return opts.includes(s) ? s : opts[0] ?? '';
  }
  return stored == null ? '' : String(stored);
}

export default function PluginSettingsOverlay() {
  const [sections, setSections] = useState<PluginSettingsSection[] | null>(null);
  const [values, setValues] = useState<Record<string, string | boolean>>({});
  const [status, setStatus] = useState<Record<string, Status>>({});

  useEffect(() => {
    let alive = true;
    const bridge = markBridge();
    const load = bridge ? bridge.pluginSettings() : Promise.resolve([]);
    load
      .then((secs) => {
        if (!alive) return;
        const list = (secs || []).filter(Boolean);
        const v: Record<string, string | boolean> = {};
        for (const sec of list) {
          const ns = nsOf(sec);
          for (const f of sec.fields || []) {
            if (!f || typeof f !== 'object' || !f.key) continue;
            const stored = sec.values && f.key in sec.values ? sec.values[f.key] : f.default;
            v[fk(ns, f.key)] = initialValue(f, stored);
          }
        }
        setValues(v);
        setSections(list);
      })
      .catch(() => alive && setSections([]));
    return () => {
      alive = false;
    };
  }, []);

  const gather = (ns: string): Record<string, unknown> => {
    const out: Record<string, unknown> = {};
    const sec = sections?.find((s) => nsOf(s) === ns);
    for (const f of sec?.fields || []) {
      if (!f || !f.key) continue;
      const v = values[fk(ns, f.key)];
      const kind = kindOf(f);
      if (kind === 'toggle') out[f.key] = !!v;
      else if (kind === 'choice') out[f.key] = String(v ?? '');
      else {
        const t = String(v ?? '').trim();
        // A number field keeps a number when it is one, text otherwise.
        out[f.key] = kind === 'number' && t !== '' && Number.isFinite(Number(t)) ? Number(t) : t;
      }
    }
    return out;
  };

  const saveNs = async (ns: string) => {
    await markBridge()?.pluginSettingsSave(ns, gather(ns));
  };

  const saveAll = async () => {
    for (const sec of sections || []) {
      const ns = sec.namespace || sec.plugin;
      if (!ns) continue;
      try {
        await saveNs(ns);
        setStatus((s) => ({ ...s, [ns]: { text: 'Saved ✓', color: 'var(--good)' } }));
      } catch (e) {
        setStatus((s) => ({ ...s, [ns]: { text: errText(e), color: 'var(--bad)' } }));
      }
    }
  };

  const runAction = async (ns: string) => {
    const bridge = markBridge();
    if (!bridge) return;
    setStatus((s) => ({ ...s, [ns]: { text: 'Testing…', color: 'var(--ink-3)' } }));
    let ok = false;
    let msg = '';
    try {
      await saveNs(ns); // persist what the user typed before testing
      const res = await bridge.pluginSettingsAction(ns, gather(ns));
      if (Array.isArray(res) && res.length === 2) {
        ok = !!res[0];
        msg = String(res[1]);
      } else {
        ok = !!res;
        msg = String(res);
      }
    } catch (e) {
      ok = false;
      msg = errText(e);
    }
    setStatus((s) => ({ ...s, [ns]: { text: msg, color: ok ? 'var(--good)' : 'var(--bad)' } }));
  };

  const set = (k: string, v: string | boolean) => setValues((s) => ({ ...s, [k]: v }));

  const renderField = (ns: string, f: PluginSettingsField) => {
    const k = fk(ns, f.key);
    const kind = kindOf(f);
    const v = values[k];
    const label = String(f.label || f.key);
    if (kind === 'toggle') {
      const on = !!v;
      return (
        <button
          key={f.key}
          className="mko-toggle-row"
          role="switch"
          aria-checked={on}
          onClick={() => set(k, !on)}
        >
          <span className="mko-toggle-text">
            <span className="mko-label">{label}</span>
            {f.help && <span className="mko-hint">{f.help}</span>}
          </span>
          <span className={`switch${on ? ' on' : ''}`} />
        </button>
      );
    }
    return (
      <Field key={f.key} label={label} hint={f.help || undefined}>
        {kind === 'choice' ? (
          <Select value={String(v ?? '')} onChange={(e) => set(k, e.target.value)}>
            {(f.options || []).map((o) => (
              <option key={String(o)} value={String(o)}>
                {String(o)}
              </option>
            ))}
          </Select>
        ) : (
          <input
            className={`field${kind === 'password' ? ' mono' : ''}`}
            type={kind === 'password' ? 'password' : 'text'}
            inputMode={kind === 'number' ? 'decimal' : undefined}
            placeholder={f.placeholder ? String(f.placeholder) : undefined}
            value={String(v ?? '')}
            spellCheck={false}
            onChange={(e) => set(k, e.target.value)}
          />
        )}
      </Field>
    );
  };

  const has = !!sections && sections.length > 0;
  const close = () => useMarkStore.getState().setOverlay(null);

  return (
    <Modal
      width={480}
      icon={<SettingsIcon />}
      title="Plugin settings"
      description="Tokens and connections for the plugins you have turned on."
      onClose={close}
      style={{ maxHeight: 'min(640px, 100%)' }}
      footer={
        <>
          <button className="btn" onClick={close}>
            Close
          </button>
          {has && (
            <button className="btn primary" onClick={saveAll}>
              Save
            </button>
          )}
        </>
      }
    >
      {sections === null && (
        <div className="mko-well">
          <div className="mko-empty">Loading…</div>
        </div>
      )}
      {sections !== null && !has && (
        <div className="mko-well">
          <div className="mko-empty">
            <span className="mko-empty-ico">
              <SettingsIcon />
            </span>
            <b>No configurable plugins are installed</b>
            <span style={{ maxWidth: '38ch' }}>
              Drop a plugin that needs settings (like the 3D-printer suite) into the plugins folder and it will show
              up here.
            </span>
          </div>
        </div>
      )}

      {has &&
        sections!.map((sec) => {
          const ns = nsOf(sec);
          const st = status[ns];
          return (
            <Group
              key={ns}
              title={sec.title || ns}
              aside={
                sec.action ? (
                  <button className="btn sm mko-mini mko-test" onClick={() => runAction(ns)}>
                    {String(sec.action.label || 'Test')}
                  </button>
                ) : undefined
              }
            >
              {(sec.fields || []).filter((f) => f && typeof f === 'object' && f.key).map((f) => renderField(ns, f))}
              {st?.text && (
                <div className="mko-status" style={{ color: st.color }}>
                  {st.text}
                </div>
              )}
            </Group>
          );
        })}
    </Modal>
  );
}
