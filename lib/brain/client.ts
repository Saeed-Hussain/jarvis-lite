/**
 * Main-thread side of the local model.
 *
 * Owns the worker, tracks load state for the UI, and exposes one useful
 * operation: turn a sentence the rules could not parse into validated Tasks.
 *
 * The contract with the rest of Jarvis is narrow on purpose — `parse` returns
 * Task[] or null, and null means "fall back to asking the user". Nothing
 * outside this folder knows a model exists.
 */

import type { Task } from '../types';
import { createWorker } from '../workerUrl';
import { buildMessages } from './prompt';
import { extractJson, validatePlan } from './schema';

export type BrainStatus = 'idle' | 'loading' | 'ready' | 'unavailable';

export interface BrainState {
  status: BrainStatus;
  /** 0..100 across the whole download, for the first run. */
  percent: number;
  /** 'webgpu' or 'wasm' once loaded — worth showing, they differ hugely. */
  device: string;
  message: string;
  /** How long the last parse took, so the cost is visible rather than felt. */
  lastMs: number;
}

type Listener = (state: BrainState) => void;

/** A parse slower than this is not worth waiting for mid-conversation. */
const PARSE_TIMEOUT_MS = 20000;

class Brain {
  private worker: Worker | null = null;
  private listeners = new Set<Listener>();
  private pending = new Map<number, (text: string) => void>();
  private nextId = 1;
  private files = new Map<string, number>();

  state: BrainState = { status: 'idle', percent: 0, device: '', message: '', lastMs: 0 };

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  private set(patch: Partial<BrainState>): void {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener(this.state);
  }

  /** Start loading. Safe to call repeatedly; only the first one does work. */
  start(): void {
    if (this.worker || typeof window === 'undefined') return;

    try {
      this.worker = createWorker('brain.js');
    } catch (err) {
      this.set({
        status: 'unavailable',
        message: `Couldn't start the local model: ${err instanceof Error ? err.message : String(err)}`,
      });
      return;
    }

    this.set({ status: 'loading', percent: 0, message: 'Loading the local model…' });

    this.worker.addEventListener('message', (event: MessageEvent) => {
      const data = event.data;

      if (data.type === 'progress') {
        // The CDN reports per-file percentages; averaging them is a closer
        // approximation of "how far along is this" than showing the last one.
        this.files.set(data.stage, data.percent);
        const values = [...this.files.values()];
        const percent = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
        this.set({ percent, message: `Downloading the model — ${percent}%` });
        return;
      }

      if (data.type === 'ready') {
        this.set({
          status: 'ready',
          percent: 100,
          device: data.device,
          message: `Local model ready on ${data.device} (${(data.ms / 1000).toFixed(1)}s).`,
        });
        return;
      }

      if (data.type === 'error') {
        this.set({ status: 'unavailable', message: data.message });
        return;
      }

      if (data.type === 'result') {
        this.set({ lastMs: data.ms });
        this.pending.get(data.id)?.(data.text);
        this.pending.delete(data.id);
      }
    });

    this.worker.addEventListener('error', (event) => {
      this.set({ status: 'unavailable', message: event.message || 'The model worker crashed.' });
    });

    this.worker.postMessage({ type: 'load' });
  }

  get ready(): boolean {
    return this.state.status === 'ready';
  }

  /**
   * Ask the model for a plan.
   *
   * Returns null when the model is unavailable, times out, or produces
   * nothing that survives validation — all of which mean the same thing to
   * the caller: fall back to the "teach me" prompt.
   */
  async parse(utterance: string, context?: { workflows?: string[]; cwd?: string }): Promise<Task[] | null> {
    if (!this.worker) this.start();
    if (!this.worker || this.state.status === 'unavailable') return null;

    const id = this.nextId++;
    const messages = buildMessages(utterance, context);

    const text = await new Promise<string | null>((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        resolve(null);
      }, PARSE_TIMEOUT_MS);

      this.pending.set(id, (value) => {
        clearTimeout(timer);
        resolve(value);
      });

      this.worker!.postMessage({ type: 'parse', id, messages });
    });

    if (!text) return null;

    const tasks = validatePlan(extractJson(text));
    // An empty plan is the model correctly saying "I can't map this", which
    // is a real answer and must not be confused with a broken one.
    return tasks.length ? tasks : null;
  }
}

export const brain = new Brain();
