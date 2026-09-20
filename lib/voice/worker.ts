/**
 * Speech to text, locally.
 *
 * The Web Speech API that Jarvis used before does not work in Electron and
 * cannot be made to: Chromium's implementation posts audio to Google's speech
 * service using an API key compiled into official Chrome builds, which
 * Electron does not ship. It fails with a `network` error every time.
 *
 * So transcription happens here instead, on a Whisper model running in this
 * worker. It downloads once and then works with the network unplugged, which
 * is what the rest of this app already promises.
 */

import { pipeline, AutomaticSpeechRecognitionPipeline } from '@huggingface/transformers';
import { configureRuntime } from '../runtime';
import { SAMPLE_RATE } from './constants';

configureRuntime();

/** See the note in brain/worker.ts: the overload union is too complex for TS. */
type LoadPipeline<T> = (task: string, model: string, options?: Record<string, unknown>) => Promise<T>;
const loadPipeline = pipeline as unknown as LoadPipeline<AutomaticSpeechRecognitionPipeline>;

/**
 * whisper-base.en: about 40MB quantised, and noticeably better than tiny on
 * the thing that matters most here — catching the wake word in a sentence
 * spoken at normal speed, across a room.
 */
const MODEL_ID = 'onnx-community/whisper-base.en_timestamped';

type Outgoing =
  | { type: 'progress'; stage: string; percent: number }
  | { type: 'ready'; device: string; ms: number }
  | { type: 'error'; message: string }
  | { type: 'transcript'; id: number; text: string; ms: number };

const post = (message: Outgoing) => self.postMessage(message);

let recogniser: AutomaticSpeechRecognitionPipeline | null = null;
let loading: Promise<AutomaticSpeechRecognitionPipeline> | null = null;

async function hasWebGPU(): Promise<boolean> {
  const gpu = (navigator as Navigator & { gpu?: { requestAdapter: () => Promise<unknown> } }).gpu;
  if (!gpu) return false;
  try {
    return (await gpu.requestAdapter()) !== null;
  } catch {
    return false;
  }
}

async function load(): Promise<AutomaticSpeechRecognitionPipeline> {
  if (recogniser) return recogniser;
  if (loading) return loading;

  loading = (async () => {
    const started = Date.now();
    const webgpu = await hasWebGPU();
    const device = webgpu ? 'webgpu' : 'wasm';

    try {
      const instance = await loadPipeline('automatic-speech-recognition', MODEL_ID, {
        device,
        dtype: webgpu ? { encoder_model: 'fp16', decoder_model_merged: 'q4' } : 'q8',
        progress_callback: (progress: { status?: string; file?: string; progress?: number }) => {
          if (progress.status === 'progress' && typeof progress.progress === 'number') {
            post({ type: 'progress', stage: progress.file ?? 'model', percent: Math.round(progress.progress) });
          }
        },
      });

      recogniser = instance;
      post({ type: 'ready', device, ms: Date.now() - started });
      return instance;
    } catch (err) {
      loading = null;
      post({ type: 'error', message: err instanceof Error ? err.message : String(err) });
      throw err;
    }
  })();

  return loading;
}

interface TranscribeRequest {
  type: 'transcribe';
  id: number;
  /** Mono float32 PCM at SAMPLE_RATE. */
  audio: Float32Array;
}

type Incoming = { type: 'load' } | TranscribeRequest;

self.addEventListener('message', async (event: MessageEvent<Incoming>) => {
  const data = event.data;

  if (data.type === 'load') {
    try {
      await load();
    } catch {
      /* already reported */
    }
    return;
  }

  if (data.type === 'transcribe') {
    const started = Date.now();
    try {
      const model = await load();
      const output = await model(data.audio, {
        language: 'en',
        task: 'transcribe',
        // One chunk: these are short utterances, and chunking adds latency
        // that matters far more here than on a long recording.
        chunk_length_s: 30,
        return_timestamps: false,
      });

      const text = Array.isArray(output)
        ? output.map((o) => (o as { text?: string }).text ?? '').join(' ')
        : ((output as { text?: string }).text ?? '');

      post({ type: 'transcript', id: data.id, text: text.trim(), ms: Date.now() - started });
    } catch (err) {
      post({ type: 'error', message: err instanceof Error ? err.message : String(err) });
      post({ type: 'transcript', id: data.id, text: '', ms: Date.now() - started });
    }
  }
});
