/**
 * The local language model, in a worker.
 *
 * It runs inside Jarvis — no Ollama, no server, no API key. transformers.js
 * executes an ONNX build of the model on WebGPU where the machine has it, and
 * falls back to WASM where it doesn't. The weights download once from the
 * Hugging Face CDN and are cached by the browser engine; every run after that
 * is offline.
 *
 * It lives in a worker because generation is a long synchronous grind. On the
 * main thread it would freeze the window for the whole of every reply, which
 * on a 0.5B model is a second or two of a dead UI.
 *
 * The worker only ever produces text. Deciding what that text is permitted to
 * mean happens in schema.ts, on the other side of this boundary.
 */

import { pipeline, TextGenerationPipeline } from '@huggingface/transformers';
import { configureRuntime } from '../runtime';

configureRuntime();

/**
 * Qwen2.5 0.5B Instruct, 4-bit.
 *
 * Chosen for size over cleverness: roughly 400MB, loads in seconds, and the
 * job here is filling a fixed JSON schema rather than reasoning. A larger
 * model parses marginally better and costs several gigabytes and a much
 * longer first run, which is the wrong trade for an assistant that must feel
 * instant.
 */
const MODEL_ID = 'onnx-community/Qwen2.5-0.5B-Instruct';

type Status =
  | { type: 'progress'; stage: string; percent: number }
  | { type: 'ready'; device: string; ms: number }
  | { type: 'error'; message: string }
  | { type: 'result'; id: number; text: string; ms: number };

const post = (message: Status) => self.postMessage(message);

/**
 * `pipeline` is overloaded across every task the library supports, and asking
 * TypeScript to represent that union exceeds its limits ("union type that is
 * too complex"). Narrowing it to the one task this worker uses keeps the
 * checker inside them without loosening anything we actually rely on.
 */
type LoadPipeline<T> = (task: string, model: string, options?: Record<string, unknown>) => Promise<T>;
const loadPipeline = pipeline as unknown as LoadPipeline<TextGenerationPipeline>;

let generator: TextGenerationPipeline | null = null;
let loading: Promise<TextGenerationPipeline> | null = null;
let device = 'unknown';

async function hasWebGPU(): Promise<boolean> {
  const gpu = (navigator as Navigator & { gpu?: { requestAdapter: () => Promise<unknown> } }).gpu;
  if (!gpu) return false;
  try {
    return (await gpu.requestAdapter()) !== null;
  } catch {
    return false;
  }
}

async function load(): Promise<TextGenerationPipeline> {
  if (generator) return generator;
  if (loading) return loading;

  loading = (async () => {
    const started = Date.now();
    const webgpu = await hasWebGPU();

    // q4f16 needs WebGPU; the WASM path takes q8, which is slower but works
    // on a machine with no usable adapter rather than failing outright.
    device = webgpu ? 'webgpu' : 'wasm';
    const dtype = webgpu ? 'q4f16' : 'q8';

    try {
      const instance = await loadPipeline('text-generation', MODEL_ID, {
        device,
        dtype,
        progress_callback: (progress: { status?: string; file?: string; progress?: number }) => {
          if (progress.status === 'progress' && typeof progress.progress === 'number') {
            post({
              type: 'progress',
              stage: progress.file ?? 'model',
              percent: Math.round(progress.progress),
            });
          }
        },
      });

      generator = instance;
      post({ type: 'ready', device, ms: Date.now() - started });
      return instance;
    } catch (err) {
      loading = null;
      const message = err instanceof Error ? err.message : String(err);
      post({ type: 'error', message });
      throw err;
    }
  })();

  return loading;
}

interface ParseRequest {
  type: 'parse';
  id: number;
  messages: Array<{ role: string; content: string }>;
}

type Incoming = { type: 'load' } | ParseRequest;

self.addEventListener('message', async (event: MessageEvent<Incoming>) => {
  const data = event.data;

  if (data.type === 'load') {
    try {
      await load();
    } catch {
      /* the error was already posted */
    }
    return;
  }

  if (data.type === 'parse') {
    const started = Date.now();
    try {
      const model = await load();
      const output = await model(data.messages as never, {
        max_new_tokens: 160,
        // Greedy. This is structured extraction, not writing - sampling here
        // buys nothing and costs determinism, which is the whole point of
        // being able to reproduce a bad plan.
        do_sample: false,
        return_full_text: false,
      });

      const first = Array.isArray(output) ? output[0] : output;
      const generated = (first as { generated_text?: unknown })?.generated_text;
      // With return_full_text: false the chat pipeline still hands back the
      // message list, so the assistant's turn has to be dug out of it.
      const text = Array.isArray(generated)
        ? String((generated[generated.length - 1] as { content?: string })?.content ?? '')
        : String(generated ?? '');

      post({ type: 'result', id: data.id, text, ms: Date.now() - started });
    } catch (err) {
      post({ type: 'error', message: err instanceof Error ? err.message : String(err) });
      post({ type: 'result', id: data.id, text: '[]', ms: Date.now() - started });
    }
  }
});
