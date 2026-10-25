'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePilotStore } from '@/lib/pilot/store';
import type { PilotStep, StepRun } from '@/lib/pilot/types';
import { PilotIcon, RecordIcon, StopIcon, UndoIcon, ShieldIcon, PlayIcon, CheckIcon, ClockIcon, CloseIcon, ChevronRightIcon } from './Icons';
import { formatTime } from '@/lib/utils';
import './views.css';

const STATUS_COLOR: Record<string, string> = {
  done: 'var(--good)',
  running: 'var(--accent-ink)',
  failed: 'var(--bad)',
  blocked: 'var(--bad)',
  stopped: 'var(--bad)',
  skipped: 'var(--ink-3)',
  pending: 'var(--ink-3)',
};

function Pill({ tone, children }: { tone: string; children: React.ReactNode }) {
  return (
    <span className="v-pill" style={{ ['--tone' as string]: tone } as React.CSSProperties}>
      {children}
    </span>
  );
}

/** Confidence is the number that decides whether Pilot acts, so it is shown. */
function Confidence({ value }: { value?: number }) {
  if (typeof value !== 'number') return null;
  const pct = Math.round(value * 100);
  const tone = pct >= 70 ? 'var(--good)' : pct >= 50 ? 'var(--accent)' : 'var(--bad)';
  return (
    <span className="v-meter" style={{ ['--tone' as string]: tone } as React.CSSProperties}>
      <span className="v-meter-track">
        <i style={{ width: `${pct}%` }} />
      </span>
      <span className="v-mono">{pct}%</span>
    </span>
  );
}

function StepRow({ run }: { run: StepRun }) {
  const tone = STATUS_COLOR[run.status] ?? 'var(--ink-3)';
  return (
    <div className="v-row" style={{ alignItems: 'flex-start' }}>
      <span className="v-num" style={{ paddingTop: 2 }}>
        {run.index + 1}
      </span>
      <div className="v-row-main">
        <b style={{ fontWeight: 500 }}>{run.label}</b>
        {run.message && <small>{run.message}</small>}
      </div>
      <div className="flex items-center gap-2.5 shrink-0 pt-0.5">
        <Confidence value={run.confidence} />
        {run.ms > 0 && (
          <span className="v-mono">
            {run.ms}ms
            {typeof run.groundMs === 'number' && run.groundMs > 0 ? ` · find ${run.groundMs}ms` : ''}
          </span>
        )}
        {(run.attempts ?? 1) > 1 && <Pill tone="var(--accent-ink)">retried</Pill>}
        <Pill tone={tone}>{run.status}</Pill>
      </div>
    </div>
  );
}

/** Adding the steps the recorder deliberately does not watch for. */
function AddStep() {
  const addRecordedStep = usePilotStore((s) => s.addRecordedStep);
  const [kind, setKind] = useState<PilotStep['kind']>('type');
  const [value, setValue] = useState('');

  const submit = () => {
    const text = value.trim();
    if (kind !== 'wait' && !text) return;
    if (kind === 'type') addRecordedStep({ kind: 'type', text });
    else if (kind === 'key') addRecordedStep({ kind: 'key', keys: text });
    else if (kind === 'wait') addRecordedStep({ kind: 'wait', seconds: Number(text) || 1 });
    else if (kind === 'wait_for') addRecordedStep({ kind: 'wait_for', target: { name: text } });
    setValue('');
  };

  const placeholder =
    kind === 'type'
      ? 'text to type'
      : kind === 'key'
        ? '^s for Ctrl+S, {ENTER}, %{TAB}'
        : kind === 'wait'
          ? 'seconds'
          : 'the control to wait for';

  return (
    <div className="flex gap-2 px-[18px] py-3" style={{ borderTop: '1px solid var(--line)' }}>
      <select
        value={kind}
        onChange={(e) => setKind(e.target.value as PilotStep['kind'])}
        className="field sm"
        style={{ width: 'auto' }}
      >
        <option value="type">Type</option>
        <option value="key">Press keys</option>
        <option value="wait">Wait</option>
        <option value="wait_for">Wait for</option>
      </select>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        placeholder={placeholder}
        className="field sm flex-1"
      />
      <button onClick={submit} className="btn accent sm">
        Add
      </button>
    </div>
  );
}

function RecordingPanel() {
  const { recordedSteps, recorderNote, saveRecording, cancelRecording, removeRecordedStep, moveRecordedStep, recorder } =
    usePilotStore();
  const [message, setMessage] = useState('');

  return (
    <div className="glass v-card flush">
      <div className="v-card-head">
        <span className="v-rec-dot" />
        <h2 className="v-card-title flex-1 min-w-0">
          <span className="truncate">Recording “{recorder?.name}”</span>
        </h2>
        <button onClick={cancelRecording} className="btn ghost sm">
          Discard
        </button>
        <button onClick={async () => setMessage(await saveRecording())} className="btn solid-good sm">
          Save workflow
        </button>
      </div>

      <p className="v-caption px-[18px] py-3" style={{ borderBottom: '1px solid var(--line)' }}>
        Go and do the task. Every click is recorded as the control you clicked, not as a coordinate, so it will replay
        after the window moves. Typing is not watched — add those steps below.
      </p>

      {recorderNote && (
        <p className="v-caption px-[18px] py-2.5" style={{ color: 'var(--bad)', borderBottom: '1px solid var(--line)' }}>
          {recorderNote}
        </p>
      )}

      {recordedSteps.length === 0 ? (
        <p className="v-empty">No steps yet — click something.</p>
      ) : (
        <div className="v-list bare">
          {recordedSteps.map((step, i) => (
            <div key={step.id} className="v-row" style={{ minHeight: 40, paddingTop: 6, paddingBottom: 6 }}>
              <span className="v-num">{i + 1}</span>
              <p className="flex-1 min-w-0 truncate" style={{ margin: 0 }}>
                {step.label}
              </p>
              <button onClick={() => moveRecordedStep(step.id, -1)} className="v-icon-btn" aria-label="Move up" title="Move up">
                <ChevronRightIcon width={14} height={14} style={{ transform: 'rotate(-90deg)' }} />
              </button>
              <button onClick={() => moveRecordedStep(step.id, 1)} className="v-icon-btn" aria-label="Move down" title="Move down">
                <ChevronRightIcon width={14} height={14} style={{ transform: 'rotate(90deg)' }} />
              </button>
              <button onClick={() => removeRecordedStep(step.id)} className="v-icon-btn bad" aria-label="Remove step" title="Remove">
                <CloseIcon width={14} height={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      <AddStep />
      {message && (
        <p className="v-caption px-[18px] py-2.5" style={{ borderTop: '1px solid var(--line)' }}>
          {message}
        </p>
      )}
    </div>
  );
}

export default function PilotView() {
  const {
    init,
    checked,
    available,
    reason,
    stopShortcut,
    workflows,
    selectedId,
    select,
    startRecording,
    recorder,
    preview,
    dry,
    run,
    report,
    approve,
    stop,
    remove,
    journal,
    undoRun,
    busy,
  } = usePilotStore();

  const [name, setName] = useState('');
  const [undoNote, setUndoNote] = useState('');

  useEffect(() => {
    init();
  }, [init]);

  const selected = useMemo(() => workflows.find((w) => w.id === selectedId) ?? null, [workflows, selectedId]);
  const running = report?.status === 'running';
  const awaiting = report?.status === 'awaiting-approval';

  return (
    <div className="v-page">
      <div className="v-page-inner">
        <header className="v-head">
          <div>
            <h1 className="flex items-center gap-2.5">
              Pilot
              <PilotIcon width={20} height={20} style={{ color: 'var(--accent-ink)' }} />
            </h1>
            <p className="sub">
              Jarvis follows rules. Pilot looks at the screen: it reads the accessibility tree of whatever is in front,
              finds the control you named, and clicks it. Record a task once, replay it with no model in the loop.
            </p>
          </div>
        </header>

        {/* --- availability ---------------------------------------------- */}
        {checked && !available && (
          <div className="glass v-card" style={{ padding: '14px 18px' }}>
            <p className="v-caption" style={{ color: 'var(--ink-2)' }}>
              <span style={{ color: 'var(--bad)', fontWeight: 580 }}>Pilot is not available here. </span>
              {reason}
            </p>
          </div>
        )}

        {/* --- the stop control ------------------------------------------- */}
        {(running || awaiting) && (
          <div className="v-banner">
            <button onClick={stop} className="btn solid-bad">
              <StopIcon width={14} height={14} />
              Stop
            </button>
            <p className="v-caption flex-1" style={{ color: 'var(--ink-2)' }}>
              {stopShortcut
                ? `Pilot has the mouse while it runs — ${stopShortcut} stops it from anywhere, even when this window isn't focused.`
                : 'The global stop shortcut is taken by another app, so this button is the only stop. Keep this window reachable.'}
            </p>
          </div>
        )}

        {/* --- approval --------------------------------------------------- */}
        {awaiting && report?.pendingApproval && (
          <div className="glass v-card flex items-center gap-3" style={{ padding: '12px 14px 12px 18px' }}>
            <ShieldIcon width={18} height={18} style={{ color: 'var(--accent-ink)', flex: 'none' }} />
            <p className="flex-1" style={{ margin: 0, fontSize: 13.5 }}>
              {report.pendingApproval.question}
            </p>
            <button onClick={approve} className="btn accent sm">
              Yes, go ahead
            </button>
          </div>
        )}

        {/* --- record ------------------------------------------------------ */}
        {recorder ? (
          <RecordingPanel />
        ) : (
          <div className="glass v-card flex items-center gap-2" style={{ padding: 10, borderRadius: 999 }}>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && available && name.trim() && (startRecording(name), setName(''))}
              placeholder="Name a new workflow, e.g. “enter one invoice”"
              className="field flex-1"
              style={{ borderRadius: 999 }}
            />
            <button
              disabled={!available || !name.trim()}
              onClick={() => {
                startRecording(name);
                setName('');
              }}
              className="btn solid-bad"
            >
              <RecordIcon width={14} height={14} />
              Record
            </button>
          </div>
        )}

        {/* --- saved workflows --------------------------------------------- */}
        <div className="v-pilot-split">
          <div className="glass v-card flush">
            <div className="v-card-head">
              <h2 className="v-card-title">Saved workflows</h2>
              <span className="v-mono">{workflows.length}</span>
            </div>
            {workflows.length === 0 ? (
              <p className="v-empty">None yet.</p>
            ) : (
              <div className="v-list bare">
                {workflows.map((w) => (
                  <button key={w.id} onClick={() => select(w.id)} className={`v-row${selectedId === w.id ? ' selected' : ''}`}>
                    <span className="v-row-main">
                      <b className="truncate">{w.name}</b>
                      <small>
                        {w.steps.length} steps
                        {w.app ? ` · ${w.app}` : ''}
                        {w.lastRun ? ` · last ${(w.lastRun.ms / 1000).toFixed(1)}s` : ''}
                      </small>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="min-w-0 flex flex-col gap-3.5">
            {!selected ? (
              <div className="glass v-card">
                <p className="v-caption">
                  Pick a workflow to preview or run it. You can also say “pilot run {workflows[0]?.name ?? 'invoices'}” in chat.
                </p>
              </div>
            ) : (
              <>
                <div className="glass v-card flex items-center gap-2" style={{ padding: '12px 12px 12px 18px' }}>
                  <div className="flex-1 min-w-0">
                    <p className="v-card-title truncate">{selected.name}</p>
                    <p className="v-card-sub">
                      {selected.steps.length} steps · run {selected.runCount ?? 0}×
                    </p>
                  </div>
                  <button disabled={busy} onClick={() => preview(selected.id)} className="btn sm">
                    <ShieldIcon width={14} height={14} />
                    Dry run
                  </button>
                  <button disabled={busy || !available} onClick={() => run(selected.id)} className="btn accent sm">
                    <PlayIcon width={14} height={14} />
                    Run
                  </button>
                  <button onClick={() => remove(selected.id)} className="btn ghost danger sm">
                    Delete
                  </button>
                </div>

                {/* --- dry run ------------------------------------------- */}
                {dry && dry.workflowId === selected.id && (
                  <div className="glass v-card flush">
                    <div className="v-card-head">
                      <div>
                        <h3 className="v-card-title">The plan — nothing was done</h3>
                        <p className="v-card-sub">
                          Checked against “{dry.window || 'the foreground window'}” in {dry.ms}ms.
                          {!dry.runnable && <span style={{ color: 'var(--bad)' }}> A step is blocked outright.</span>}
                        </p>
                      </div>
                    </div>
                    <div className="v-list bare">
                      {dry.rows.map((row) => (
                        <div key={row.index} className="v-row" style={{ alignItems: 'flex-start' }}>
                          <span className="v-num" style={{ paddingTop: 2 }}>
                            {row.index + 1}
                          </span>
                          <div className="v-row-main">
                            <b style={{ fontWeight: 500 }}>{row.label}</b>
                            {(row.reason || row.detail) && <small>{row.reason ?? row.detail}</small>}
                          </div>
                          <Confidence value={row.confidence} />
                          {row.found === true && <Pill tone="var(--good)">on screen</Pill>}
                          {row.found === false && <Pill tone="var(--bad)">not found</Pill>}
                          {row.verdict !== 'allow' && (
                            <Pill tone={row.verdict === 'block' ? 'var(--bad)' : 'var(--accent-ink)'}>
                              {row.verdict === 'block' ? 'blocked' : 'needs a yes'}
                            </Pill>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* --- live run ------------------------------------------ */}
                {report && report.workflowId === selected.id && (
                  <div className="glass v-card flush">
                    <div className="v-card-head">
                      <div className="flex-1 min-w-0">
                        <h3 className="v-card-title">Run</h3>
                        <p className="v-card-sub tnum">
                          {report.steps.filter((s) => s.status === 'done').length}/{selected.steps.length} steps ·{' '}
                          {(report.ms / 1000).toFixed(1)}s
                          {report.steps.some((s) => s.status === 'done') &&
                            ` · ${Math.round(report.ms / Math.max(1, report.steps.filter((s) => s.status === 'done').length))}ms a step`}
                        </p>
                      </div>
                      <Pill tone={STATUS_COLOR[report.status] ?? 'var(--accent-ink)'}>{report.status}</Pill>
                    </div>
                    <div className="v-list bare">
                      {report.steps.map((s) => (
                        <StepRow key={`${s.stepId}-${s.index}`} run={s} />
                      ))}
                    </div>
                    {report.message && (
                      <p className="v-caption px-[18px] py-2.5" style={{ borderTop: '1px solid var(--line)' }}>
                        {report.message}
                      </p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* --- undo journal ------------------------------------------------ */}
        <div className="glass v-card flush">
          <div className="v-card-head">
            <h2 className="v-card-title flex-1">
              <UndoIcon width={16} height={16} /> Undo journal
            </h2>
            {report?.runId && journal.some((e) => e.runId === report.runId && !e.undone) && (
              <button onClick={async () => setUndoNote(await undoRun(report.runId))} className="btn sm">
                Undo this run
              </button>
            )}
          </div>
          {journal.length === 0 ? (
            <p className="v-empty">Pilot has not changed any files. Every file it touches is backed up first and listed here.</p>
          ) : (
            <div className="v-list bare">
              {journal.map((entry) => (
                <div key={entry.id} className="v-row" style={{ minHeight: 40 }}>
                  <ClockIcon width={14} height={14} style={{ color: 'var(--ink-3)', flex: 'none' }} />
                  <span className="v-mono">{formatTime(new Date(entry.at))}</span>
                  <Pill tone="var(--accent-ink)">{entry.op}</Pill>
                  <p className="v-mono flex-1 truncate" style={{ margin: 0, color: 'var(--ink-2)' }}>
                    {entry.target}
                  </p>
                  {entry.undone && (
                    <span className="flex items-center gap-1 text-[12px]" style={{ color: 'var(--good)' }}>
                      <CheckIcon width={12} height={12} /> undone
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
          {undoNote && (
            <p className="v-caption px-[18px] py-2.5" style={{ borderTop: '1px solid var(--line)' }}>
              {undoNote}
            </p>
          )}
        </div>

        {/* --- what this does not do yet ------------------------------------ */}
        <p className="v-caption" style={{ padding: '0 4px', lineHeight: 1.6 }}>
          <strong>What this can&apos;t do yet.</strong> Pilot grounds through the accessibility tree, which is fast and
          exact when an app exposes one. An app that draws its own interface — a canvas, a remote desktop, a game —
          reports nothing addressable, and Pilot says so and stops rather than guessing at a coordinate. Answering those
          cases needs a small vision model running locally on your own GPU, under a second per step. That is the open
          problem, and it is not built.
        </p>
      </div>
    </div>
  );
}
