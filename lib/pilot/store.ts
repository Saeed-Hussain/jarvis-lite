/**
 * Pilot's renderer state.
 *
 * Separate from the Jarvis store on purpose: a Pilot run is long-lived,
 * emits progress many times a second and can be halted from outside the
 * window, none of which the chat store is shaped for. The two meet in
 * lib/executor.ts, where a `pilot` task calls `run` here and reports the
 * outcome back into the conversation.
 */

import { create } from 'zustand';
import type { PilotStep, RunReport, Workflow } from './types';
import { Recorder, makeStep } from './recorder';
import { runWorkflow, dryRun, DryRunReport } from './runner';

const pilot = () => (typeof window !== 'undefined' ? window.jarvis?.pilot : undefined);

export interface JournalEntry {
  id: string;
  runId?: string;
  at: number;
  op: 'create' | 'overwrite' | 'delete' | 'move';
  target: string;
  from?: string;
  undone: boolean;
}

interface PilotState {
  available: boolean;
  reason: string;
  stopShortcut: string | null;
  checked: boolean;

  workflows: Workflow[];
  selectedId: string | null;

  recorder: Recorder | null;
  recordedSteps: PilotStep[];
  recorderNote: string;

  report: RunReport | null;
  dry: DryRunReport | null;
  journal: JournalEntry[];
  busy: boolean;

  init: () => Promise<void>;
  refresh: () => Promise<void>;
  select: (id: string | null) => void;

  startRecording: (name: string) => void;
  addRecordedStep: (partial: Parameters<typeof makeStep>[0]) => void;
  removeRecordedStep: (id: string) => void;
  moveRecordedStep: (id: string, delta: number) => void;
  cancelRecording: () => void;
  saveRecording: (description?: string) => Promise<string>;

  preview: (id: string) => Promise<void>;
  run: (id: string) => Promise<RunReport | null>;
  approve: () => Promise<void>;
  stop: () => Promise<void>;
  remove: (id: string) => Promise<void>;

  loadJournal: () => Promise<void>;
  undoRun: (runId: string) => Promise<string>;
}

export const usePilotStore = create<PilotState>((set, get) => ({
  available: false,
  reason: '',
  stopShortcut: null,
  checked: false,

  workflows: [],
  selectedId: null,

  recorder: null,
  recordedSteps: [],
  recorderNote: '',

  report: null,
  dry: null,
  journal: [],
  busy: false,

  init: async () => {
    const api = pilot();
    if (!api) {
      set({
        checked: true,
        available: false,
        reason: 'Pilot needs the desktop app — a browser tab cannot see the rest of your screen.',
      });
      return;
    }

    const status = await api.available();
    set({
      checked: true,
      available: status.available,
      reason: status.reason,
      stopShortcut: status.stopShortcut ?? null,
    });

    // A stop from the global shortcut arrives unprompted: the user pressed it
    // precisely because Pilot had the mouse and the window did not have focus.
    api.onStopped(() => {
      const report = get().report;
      if (report) set({ report: { ...report, status: 'stopped', haltedBy: 'shortcut' } });
    });

    await get().refresh();
    await get().loadJournal();
  },

  refresh: async () => {
    const api = pilot();
    if (!api) return;
    const workflows = await api.workflows();
    set({ workflows });
  },

  select: (id) => set({ selectedId: id, dry: null, report: null }),

  // --- recording -----------------------------------------------------------

  startRecording: (name) => {
    const recorder = new Recorder(name.trim() || 'Untitled workflow', {
      onStep: (_step, all) => set({ recordedSteps: all, recorderNote: '' }),
      onError: (message) => set({ recorderNote: message }),
    });
    recorder.start();
    set({ recorder, recordedSteps: [], recorderNote: '', report: null, dry: null });
  },

  addRecordedStep: (partial) => {
    const recorder = get().recorder;
    if (!recorder) return;
    recorder.add(partial);
    set({ recordedSteps: recorder.recorded });
  },

  removeRecordedStep: (id) => {
    const recorder = get().recorder;
    if (!recorder) return;
    recorder.remove(id);
    set({ recordedSteps: recorder.recorded });
  },

  moveRecordedStep: (id, delta) => {
    const recorder = get().recorder;
    if (!recorder) return;
    recorder.move(id, delta);
    set({ recordedSteps: recorder.recorded });
  },

  cancelRecording: () => {
    get().recorder?.stop();
    set({ recorder: null, recordedSteps: [], recorderNote: '' });
  },

  saveRecording: async (description) => {
    const { recorder } = get();
    const api = pilot();
    if (!recorder || !api) return 'Nothing to save.';

    recorder.stop();
    const workflow = recorder.toWorkflow(description);
    if (workflow.steps.length === 0) {
      set({ recorder: null, recordedSteps: [] });
      return 'That recording had no steps, so I saved nothing.';
    }

    const saved = await api.saveWorkflow(workflow);
    set({ recorder: null, recordedSteps: [], recorderNote: '' });
    await get().refresh();
    if (saved.success && saved.workflow) set({ selectedId: saved.workflow.id });
    return saved.message;
  },

  // --- running -------------------------------------------------------------

  preview: async (id) => {
    const workflow = get().workflows.find((w) => w.id === id);
    if (!workflow) return;
    set({ busy: true, dry: null });
    const dry = await dryRun(workflow);
    set({ dry, busy: false });
  },

  run: async (id) => {
    const workflow = get().workflows.find((w) => w.id === id);
    if (!workflow) return null;

    set({ busy: true, report: null });
    const report = await runWorkflow(workflow, {
      onProgress: (snapshot) => set({ report: snapshot }),
    });
    set({ report, busy: false });
    await get().refresh();
    await get().loadJournal();
    return report;
  },

  /** Answer a guard 'confirm' and carry on from the step that asked. */
  approve: async () => {
    const { report, workflows } = get();
    if (!report?.pendingApproval) return;
    const workflow = workflows.find((w) => w.id === report.workflowId);
    if (!workflow) return;

    const index = report.pendingApproval.stepIndex;
    const step = workflow.steps[index];
    // The paused step's own row is dropped: it is about to be run for real and
    // would otherwise appear twice in the timeline.
    const prior = report.steps.filter((s) => s.index < index);

    set({ busy: true });
    const resumed = await runWorkflow(workflow, {
      runId: report.runId,
      approved: new Set([step.id]),
      priorSteps: prior,
      startAt: index,
      onProgress: (snapshot) => set({ report: snapshot }),
    });
    set({ report: resumed, busy: false });
    await get().loadJournal();
  },

  stop: async () => {
    await pilot()?.stop();
    const report = get().report;
    if (report) set({ report: { ...report, status: 'stopped', haltedBy: 'user' } });
  },

  remove: async (id) => {
    await pilot()?.deleteWorkflow(id);
    set({ selectedId: null, dry: null, report: null });
    await get().refresh();
  },

  // --- undo ----------------------------------------------------------------

  loadJournal: async () => {
    const api = pilot();
    if (!api) return;
    set({ journal: await api.journal(40) });
  },

  undoRun: async (runId) => {
    const api = pilot();
    if (!api) return 'Pilot is not available.';
    const result = await api.undoRun(runId);
    await get().loadJournal();
    return result.message;
  },
}));
