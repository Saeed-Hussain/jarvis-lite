'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePilotStore } from '@/lib/pilot/store';
import type { PilotStep, StepRun } from '@/lib/pilot/types';
import { PilotIcon, RecordIcon, StopIcon, UndoIcon, ShieldIcon, PlayIcon, CheckIcon, ClockIcon } from './Icons';
import { formatTime } from '@/lib/utils';

const STATUS_COLOR: Record<string, string> = {
  done: 'var(--jarvis-success)',
  running: 'var(--jarvis-accent)',
  failed: 'var(--jarvis-danger)',
  blocked: 'var(--jarvis-danger)',
  stopped: 'var(--jarvis-danger)',
  skipped: 'var(--jarvis-subtext)',
  pending: 'var(--jarvis-subtext)',
};

function Pill({ tone, children }: { tone: string; children: React.ReactNode }) {
  return (
    <span
      className="px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap"
      style={{ backgroundColor: `color-mix(in srgb, ${tone} 18%, transparent)`, color: tone }}
    >
      {children}
    </span>
  );
}

/** Confidence is the number that decides whether Pilot acts, so it is shown. */
function Confidence({ value }: { value?: number }) {
  if (typeof value !== 'number') return null;
  const pct = Math.round(value * 100);
  const tone = pct >= 70 ? 'var(--jarvis-success)' : pct >= 50 ? 'var(--jarvis-accent)' : 'var(--jarvis-danger)';
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="w-10 h-1 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--jarvis-border)' }}>
        <span className="block h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: tone }} />
      </span>
      <span className="font-mono text-[11px]" style={{ color: 'var(--jarvis-subtext)' }}>
        {pct}%
      </span>
    </span>
  );
}

function StepRow({ run }: { run: StepRun }) {
  const tone = STATUS_COLOR[run.status] ?? 'var(--jarvis-subtext)';
  return (
    <div className="flex items-start gap-3 px-4 py-2.5 border-b last:border-0" style={{ borderColor: 'var(--jarvis-border)' }}>
      <span className="font-mono text-[11px] w-6 shrink-0 pt-0.5" style={{ color: 'var(--jarvis-subtext)' }}>
        {run.index + 1}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm">{run.label}</p>
        {run.message && (
          <p className="text-xs mt-0.5" style={{ color: 'var(--jarvis-subtext)' }}>
            {run.message}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2.5 shrink-0 pt-0.5">
        <Confidence value={run.confidence} />
        {run.ms > 0 && (
          <span className="font-mono text-[11px]" style={{ color: 'var(--jarvis-subtext)' }}>
            {run.ms}ms
            {typeof run.groundMs === 'number' && run.groundMs > 0 ? ` · find ${run.groundMs}ms` : ''}
          </span>
        )}
        {(run.attempts ?? 1) > 1 && <Pill tone="var(--jarvis-accent)">retried</Pill>}
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
    <div className="flex gap-2 px-4 py-3 border-t" style={{ borderColor: 'var(--jarvis-border)' }}>
      <select
        value={kind}
        onChange={(e) => setKind(e.target.value as PilotStep['kind'])}
        className="text-xs rounded-lg px-2 py-1.5 border bg-transparent"
        style={{ borderColor: 'var(--jarvis-border)', color: 'var(--jarvis-text)' }}
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
        className="flex-1 text-xs rounded-lg px-3 py-1.5 border bg-transparent"
        style={{ borderColor: 'var(--jarvis-border)', color: 'var(--jarvis-text)' }}
      />
      <button
        onClick={submit}
        className="text-xs px-3 py-1.5 rounded-lg font-medium active:scale-[0.98]"
        style={{ backgroundColor: 'var(--jarvis-accent)', color: '#fff' }}
      >
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
    <div className="glass-panel rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b flex items-center gap-2" style={{ borderColor: 'var(--jarvis-border)' }}>
        <span className="w-2 h-2 rounded-full animate-pulseRing" style={{ backgroundColor: 'var(--jarvis-danger)' }} />
        <p className="text-sm font-semibold flex-1">Recording “{recorder?.name}”</p>
        <button
          onClick={cancelRecording}
          className="text-xs px-3 py-1.5 rounded-lg border"
          style={{ borderColor: 'var(--jarvis-border)' }}
        >
          Discard
        </button>
        <button
          onClick={async () => setMessage(await saveRecording())}
          className="text-xs px-3 py-1.5 rounded-lg font-medium active:scale-[0.98]"
          style={{ backgroundColor: 'var(--jarvis-success)', color: '#fff' }}
        >
          Save workflow
        </button>
      </div>

      <p className="px-4 py-2.5 text-xs border-b" style={{ color: 'var(--jarvis-subtext)', borderColor: 'var(--jarvis-border)' }}>
        Go and do the task. Every click is recorded as the control you clicked, not as a coordinate, so it will replay
        after the window moves. Typing is not watched — add those steps below.
      </p>

      {recorderNote && (
        <p className="px-4 py-2 text-xs border-b" style={{ color: 'var(--jarvis-danger)', borderColor: 'var(--jarvis-border)' }}>
          {recorderNote}
        </p>
      )}

      {recordedSteps.length === 0 ? (
        <p className="px-4 py-6 text-sm text-center" style={{ color: 'var(--jarvis-subtext)' }}>
          No steps yet — click something.
        </p>
      ) : (
        recordedSteps.map((step, i) => (
          <div key={step.id} className="flex items-center gap-3 px-4 py-2 border-b last:border-0" style={{ borderColor: 'var(--jarvis-border)' }}>
            <span className="font-mono text-[11px] w-6" style={{ color: 'var(--jarvis-subtext)' }}>{i + 1}</span>
            <p className="text-sm flex-1 min-w-0 truncate">{step.label}</p>
            <button onClick={() => moveRecordedStep(step.id, -1)} className="text-xs px-1.5 opacity-60 hover:opacity-100">↑</button>
            <button onClick={() => moveRecordedStep(step.id, 1)} className="text-xs px-1.5 opacity-60 hover:opacity-100">↓</button>
            <button
              onClick={() => removeRecordedStep(step.id)}
              className="text-xs px-1.5 opacity-60 hover:opacity-100"
              style={{ color: 'var(--jarvis-danger)' }}
            >
              ✕
            </button>
          </div>
        ))
      )}

      <AddStep />
      {message && (
        <p className="px-4 py-2 text-xs border-t" style={{ color: 'var(--jarvis-subtext)', borderColor: 'var(--jarvis-border)' }}>
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
    <div className="flex-1 overflow-y-auto p-5">
      <div className="flex items-start gap-3 mb-1">
        <PilotIcon width={20} height={20} style={{ color: 'var(--jarvis-accent)' }} />
        <div className="flex-1">
          <h2 className="text-[15px] font-semibold">Pilot</h2>
          <p className="text-sm" style={{ color: 'var(--jarvis-subtext)' }}>
            Jarvis follows rules. Pilot looks at the screen: it reads the accessibility tree of whatever is in front,
            finds the control you named, and clicks it. Record a task once, replay it with no model in the loop.
          </p>
        </div>
      </div>

      {/* --- availability ---------------------------------------------- */}
      {checked && !available && (
        <div className="glass-panel rounded-xl px-4 py-3 mt-4 text-sm" style={{ color: 'var(--jarvis-subtext)' }}>
          <span style={{ color: 'var(--jarvis-danger)' }}>Pilot is not available here. </span>
          {reason}
        </div>
      )}

      {/* --- the stop control ------------------------------------------- */}
      {(running || awaiting) && (
        <div
          className="rounded-xl px-4 py-3 mt-4 flex items-center gap-3"
          style={{ backgroundColor: 'color-mix(in srgb, var(--jarvis-danger) 12%, transparent)' }}
        >
          <button
            onClick={stop}
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm active:scale-[0.98]"
            style={{ backgroundColor: 'var(--jarvis-danger)', color: '#fff' }}
          >
            <StopIcon width={14} height={14} />
            Stop
          </button>
          <p className="text-xs flex-1" style={{ color: 'var(--jarvis-subtext)' }}>
            {stopShortcut
              ? `Pilot has the mouse while it runs — ${stopShortcut} stops it from anywhere, even when this window isn't focused.`
              : 'The global stop shortcut is taken by another app, so this button is the only stop. Keep this window reachable.'}
          </p>
        </div>
      )}

      {/* --- approval --------------------------------------------------- */}
      {awaiting && report?.pendingApproval && (
        <div className="glass-panel rounded-xl px-4 py-3 mt-3 flex items-center gap-3">
          <ShieldIcon width={18} height={18} style={{ color: 'var(--jarvis-accent)' }} />
          <p className="text-sm flex-1">{report.pendingApproval.question}</p>
          <button
            onClick={approve}
            className="text-xs px-3 py-1.5 rounded-lg font-medium"
            style={{ backgroundColor: 'var(--jarvis-accent)', color: '#fff' }}
          >
            Yes, go ahead
          </button>
        </div>
      )}

      {/* --- record ------------------------------------------------------ */}
      <div className="mt-4">
        {recorder ? (
          <RecordingPanel />
        ) : (
          <div className="glass-panel rounded-xl px-4 py-3 flex items-center gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && available && name.trim() && (startRecording(name), setName(''))}
              placeholder="Name a new workflow, e.g. “enter one invoice”"
              className="flex-1 text-sm rounded-lg px-3 py-2 border bg-transparent"
              style={{ borderColor: 'var(--jarvis-border)', color: 'var(--jarvis-text)' }}
            />
            <button
              disabled={!available || !name.trim()}
              onClick={() => {
                startRecording(name);
                setName('');
              }}
              className="flex items-center gap-2 text-sm px-4 py-2 rounded-lg font-medium disabled:opacity-40 active:scale-[0.98]"
              style={{ backgroundColor: 'var(--jarvis-danger)', color: '#fff' }}
            >
              <RecordIcon width={14} height={14} />
              Record
            </button>
          </div>
        )}
      </div>

      {/* --- saved workflows --------------------------------------------- */}
      <div className="grid grid-cols-[260px_1fr] gap-4 mt-4 items-start">
        <div className="glass-panel rounded-xl overflow-hidden">
          <p className="px-4 py-2.5 text-xs font-semibold border-b" style={{ borderColor: 'var(--jarvis-border)', color: 'var(--jarvis-subtext)' }}>
            SAVED WORKFLOWS
          </p>
          {workflows.length === 0 ? (
            <p className="px-4 py-5 text-sm" style={{ color: 'var(--jarvis-subtext)' }}>
              None yet.
            </p>
          ) : (
            workflows.map((w) => (
              <button
                key={w.id}
                onClick={() => select(w.id)}
                className="w-full text-left px-4 py-2.5 border-b last:border-0 hover:bg-black/5 dark:hover:bg-white/5"
                style={{
                  borderColor: 'var(--jarvis-border)',
                  backgroundColor: selectedId === w.id ? 'color-mix(in srgb, var(--jarvis-accent) 12%, transparent)' : undefined,
                }}
              >
                <p className="text-sm font-medium truncate">{w.name}</p>
                <p className="text-xs" style={{ color: 'var(--jarvis-subtext)' }}>
                  {w.steps.length} steps
                  {w.app ? ` · ${w.app}` : ''}
                  {w.lastRun ? ` · last ${(w.lastRun.ms / 1000).toFixed(1)}s` : ''}
                </p>
              </button>
            ))
          )}
        </div>

        <div className="min-w-0">
          {!selected ? (
            <div className="glass-panel rounded-xl px-4 py-6 text-sm" style={{ color: 'var(--jarvis-subtext)' }}>
              Pick a workflow to preview or run it. You can also say “pilot run {workflows[0]?.name ?? 'invoices'}” in chat.
            </div>
          ) : (
            <>
              <div className="glass-panel rounded-xl px-4 py-3 flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{selected.name}</p>
                  <p className="text-xs" style={{ color: 'var(--jarvis-subtext)' }}>
                    {selected.steps.length} steps · run {selected.runCount ?? 0}×
                  </p>
                </div>
                <button
                  disabled={busy}
                  onClick={() => preview(selected.id)}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border disabled:opacity-40"
                  style={{ borderColor: 'var(--jarvis-border)' }}
                >
                  <ShieldIcon width={13} height={13} />
                  Dry run
                </button>
                <button
                  disabled={busy || !available}
                  onClick={() => run(selected.id)}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium disabled:opacity-40"
                  style={{ backgroundColor: 'var(--jarvis-accent)', color: '#fff' }}
                >
                  <PlayIcon width={13} height={13} />
                  Run
                </button>
                <button
                  onClick={() => remove(selected.id)}
                  className="text-xs px-2 py-1.5 rounded-lg"
                  style={{ color: 'var(--jarvis-danger)' }}
                >
                  Delete
                </button>
              </div>

              {/* --- dry run ------------------------------------------- */}
              {dry && dry.workflowId === selected.id && (
                <div className="glass-panel rounded-xl overflow-hidden mt-3">
                  <div className="px-4 py-2.5 border-b" style={{ borderColor: 'var(--jarvis-border)' }}>
                    <p className="text-xs font-semibold" style={{ color: 'var(--jarvis-subtext)' }}>
                      THE PLAN — NOTHING WAS DONE
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--jarvis-subtext)' }}>
                      Checked against “{dry.window || 'the foreground window'}” in {dry.ms}ms.
                      {!dry.runnable && <span style={{ color: 'var(--jarvis-danger)' }}> A step is blocked outright.</span>}
                    </p>
                  </div>
                  {dry.rows.map((row) => (
                    <div key={row.index} className="flex items-start gap-3 px-4 py-2 border-b last:border-0" style={{ borderColor: 'var(--jarvis-border)' }}>
                      <span className="font-mono text-[11px] w-6 pt-0.5" style={{ color: 'var(--jarvis-subtext)' }}>{row.index + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm">{row.label}</p>
                        {(row.reason || row.detail) && (
                          <p className="text-xs mt-0.5" style={{ color: 'var(--jarvis-subtext)' }}>
                            {row.reason ?? row.detail}
                          </p>
                        )}
                      </div>
                      <Confidence value={row.confidence} />
                      {row.found === true && <Pill tone="var(--jarvis-success)">on screen</Pill>}
                      {row.found === false && <Pill tone="var(--jarvis-danger)">not found</Pill>}
                      {row.verdict !== 'allow' && (
                        <Pill tone={row.verdict === 'block' ? 'var(--jarvis-danger)' : 'var(--jarvis-accent)'}>
                          {row.verdict === 'block' ? 'blocked' : 'needs a yes'}
                        </Pill>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* --- live run ------------------------------------------ */}
              {report && report.workflowId === selected.id && (
                <div className="glass-panel rounded-xl overflow-hidden mt-3">
                  <div className="px-4 py-2.5 border-b flex items-center gap-2" style={{ borderColor: 'var(--jarvis-border)' }}>
                    <p className="text-xs font-semibold flex-1" style={{ color: 'var(--jarvis-subtext)' }}>
                      RUN · {report.steps.filter((s) => s.status === 'done').length}/{selected.steps.length} steps ·{' '}
                      {(report.ms / 1000).toFixed(1)}s
                      {report.steps.some((s) => s.status === 'done') &&
                        ` · ${Math.round(report.ms / Math.max(1, report.steps.filter((s) => s.status === 'done').length))}ms a step`}
                    </p>
                    <Pill tone={STATUS_COLOR[report.status] ?? 'var(--jarvis-accent)'}>{report.status}</Pill>
                  </div>
                  {report.steps.map((s) => (
                    <StepRow key={`${s.stepId}-${s.index}`} run={s} />
                  ))}
                  {report.message && (
                    <p className="px-4 py-2.5 text-xs border-t" style={{ borderColor: 'var(--jarvis-border)', color: 'var(--jarvis-subtext)' }}>
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
      <div className="glass-panel rounded-xl overflow-hidden mt-4">
        <div className="px-4 py-2.5 border-b flex items-center gap-2" style={{ borderColor: 'var(--jarvis-border)' }}>
          <UndoIcon width={14} height={14} style={{ color: 'var(--jarvis-subtext)' }} />
          <p className="text-xs font-semibold flex-1" style={{ color: 'var(--jarvis-subtext)' }}>
            UNDO JOURNAL
          </p>
          {report?.runId && journal.some((e) => e.runId === report.runId && !e.undone) && (
            <button
              onClick={async () => setUndoNote(await undoRun(report.runId))}
              className="text-xs px-3 py-1 rounded-lg border"
              style={{ borderColor: 'var(--jarvis-border)' }}
            >
              Undo this run
            </button>
          )}
        </div>
        {journal.length === 0 ? (
          <p className="px-4 py-4 text-sm" style={{ color: 'var(--jarvis-subtext)' }}>
            Pilot has not changed any files. Every file it touches is backed up first and listed here.
          </p>
        ) : (
          journal.map((entry) => (
            <div key={entry.id} className="flex items-center gap-3 px-4 py-2 border-b last:border-0" style={{ borderColor: 'var(--jarvis-border)' }}>
              <ClockIcon width={13} height={13} style={{ color: 'var(--jarvis-subtext)' }} />
              <span className="font-mono text-[11px]" style={{ color: 'var(--jarvis-subtext)' }}>
                {formatTime(new Date(entry.at))}
              </span>
              <Pill tone="var(--jarvis-accent)">{entry.op}</Pill>
              <p className="text-xs flex-1 truncate font-mono" style={{ color: 'var(--jarvis-subtext)' }}>
                {entry.target}
              </p>
              {entry.undone && (
                <span className="flex items-center gap-1 text-[11px]" style={{ color: 'var(--jarvis-success)' }}>
                  <CheckIcon width={12} height={12} /> undone
                </span>
              )}
            </div>
          ))
        )}
        {undoNote && (
          <p className="px-4 py-2 text-xs border-t" style={{ borderColor: 'var(--jarvis-border)', color: 'var(--jarvis-subtext)' }}>
            {undoNote}
          </p>
        )}
      </div>

      {/* --- what this does not do yet ------------------------------------ */}
      <p className="text-xs mt-4 leading-relaxed" style={{ color: 'var(--jarvis-subtext)' }}>
        <strong style={{ color: 'var(--jarvis-text)' }}>What this can&apos;t do yet.</strong> Pilot grounds through the
        accessibility tree, which is fast and exact when an app exposes one. An app that draws its own interface — a
        canvas, a remote desktop, a game — reports nothing addressable, and Pilot says so and stops rather than guessing
        at a coordinate. Answering those cases needs a small vision model running locally on your own GPU, under a
        second per step. That is the open problem, and it is not built.
      </p>
    </div>
  );
}
