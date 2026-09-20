/**
 * Always-on listening.
 *
 * Holds the microphone open, decides which bits of it are speech, and sends
 * only those to the Whisper worker. Running the model continuously would burn
 * the GPU for nothing — almost all of any minute is silence — so a cheap
 * energy gate does the first pass and the model only ever sees an utterance.
 *
 * Two modes:
 *   armed     — waiting for the wake word, everything else is discarded
 *   listening — the wake word landed; the next utterance is a command
 *
 * "jarvis open d drive" said in one breath works too: the wake word is
 * stripped and the remainder is treated as the command, rather than making
 * the user stop and wait for an acknowledgement.
 */

// From constants, not from the worker: importing the worker module here would
// pull the entire model runtime onto the main thread.
import { SAMPLE_RATE } from './constants';
import { createWorker } from '../workerUrl';

/** 256ms at 16kHz — small enough to react, large enough to be cheap. */
const FRAME = 4096;

/** Silence this long ends an utterance. */
const SILENCE_MS = 700;

/** Nobody says a single command for longer than this. */
const MAX_UTTERANCE_MS = 15000;

/** Speech shorter than this is a cough, a door, a keyboard. */
const MIN_UTTERANCE_MS = 300;

/** How long "listening" stays open after the wake word before re-arming. */
const COMMAND_WINDOW_MS = 8000;

/** Speech must be this much louder than the running noise floor. */
const SPEECH_OVER_FLOOR = 2.5;

/** …and above this absolutely, so a silent room cannot trigger on its own. */
const ABSOLUTE_FLOOR = 0.006;

/**
 * Whisper mishears a wake word constantly, so several spellings count.
 * Being generous here costs a false wake now and then; being strict costs
 * every third genuine one, which is far more annoying.
 */
const WAKE_PATTERN = /\b(?:jarvis|jarviss|jarvus|jervis|jarves|jarv is|java's|drivers)\b/i;

/** "wake up jarvis" / "hey jarvis" — the lead-in is stripped with the name. */
const WAKE_PREFIX = /^.*?\b(?:wake\s+up\s+)?(?:hey\s+|hi\s+|ok\s+|okay\s+)?(?:jarvis|jarviss|jarvus|jervis|jarves|java's|drivers)\b[\s,.!?:-]*/i;

export type VoiceStatus = 'off' | 'loading' | 'armed' | 'listening' | 'thinking' | 'error';

export interface VoiceState {
  status: VoiceStatus;
  percent: number;
  device: string;
  message: string;
  /** 0..1 mic level, for the meter. */
  level: number;
  /** Last thing heard, whether or not it was acted on. */
  heard: string;
}

export interface VoiceHandlers {
  onState: (state: VoiceState) => void;
  /** The wake word landed with no command attached. */
  onWake: () => void;
  /** A complete command, wake word already stripped. */
  onCommand: (text: string) => void;
}

export class VoiceListener {
  private worker: Worker | null = null;
  private audio: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private node: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;

  private buffer: Float32Array[] = [];
  private speaking = false;
  private speechStartedAt = 0;
  private lastLoudAt = 0;
  private noiseFloor = 0.01;
  private nextId = 1;
  private pending = new Map<number, (text: string) => void>();
  private commandUntil = 0;
  private files = new Map<string, number>();

  state: VoiceState = { status: 'off', percent: 0, device: '', message: '', level: 0, heard: '' };

  constructor(private handlers: VoiceHandlers) {}

  private set(patch: Partial<VoiceState>): void {
    this.state = { ...this.state, ...patch };
    this.handlers.onState(this.state);
  }

  get running(): boolean {
    return this.audio !== null;
  }

  // -------------------------------------------------------------------------

  async start(): Promise<void> {
    if (this.audio) return;
    this.set({ status: 'loading', message: 'Loading the speech model…' });

    try {
      this.startWorker();
      await this.startMic();
      this.set({ status: 'armed', message: 'Listening for “Jarvis”.' });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.set({
        status: 'error',
        message:
          message.includes('Permission') || message.includes('NotAllowed')
            ? 'Microphone permission was denied. Allow it and try again.'
            : `Could not start listening: ${message}`,
      });
      this.stop();
    }
  }

  stop(): void {
    this.node?.disconnect();
    this.source?.disconnect();
    this.stream?.getTracks().forEach((track) => track.stop());
    void this.audio?.close();

    this.node = null;
    this.source = null;
    this.stream = null;
    this.audio = null;
    this.buffer = [];
    this.speaking = false;
    this.set({ status: 'off', level: 0, message: '' });
  }

  /** Skip the wake word for one utterance — what the mic button does. */
  listenNow(): void {
    this.commandUntil = Date.now() + COMMAND_WINDOW_MS;
    this.set({ status: 'listening', message: 'Listening…' });
  }

  // -------------------------------------------------------------------------

  private startWorker(): void {
    this.worker = createWorker('voice.js');

    this.worker.addEventListener('message', (event: MessageEvent) => {
      const data = event.data;

      if (data.type === 'progress') {
        this.files.set(data.stage, data.percent);
        const values = [...this.files.values()];
        const percent = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
        this.set({ percent, message: `Downloading the speech model — ${percent}%` });
        return;
      }
      if (data.type === 'ready') {
        this.set({ device: data.device, percent: 100 });
        return;
      }
      if (data.type === 'error') {
        this.set({ status: 'error', message: data.message });
        return;
      }
      if (data.type === 'transcript') {
        this.pending.get(data.id)?.(data.text);
        this.pending.delete(data.id);
      }
    });

    this.worker.postMessage({ type: 'load' });
  }

  private async startMic(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        // The browser's own cleanup is better than anything done here, and it
        // runs before the energy gate sees the signal.
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    // Asking for 16kHz up front avoids resampling every frame by hand, since
    // that is exactly what Whisper wants.
    this.audio = new AudioContext({ sampleRate: SAMPLE_RATE });
    this.source = this.audio.createMediaStreamSource(this.stream);

    // ScriptProcessorNode is deprecated in favour of AudioWorklet, but a
    // worklet has to load its module from a URL, which is awkward under the
    // file:// origin the packaged app runs from. The work done per frame here
    // is a sum and a copy, so the main-thread cost is negligible.
    this.node = this.audio.createScriptProcessor(FRAME, 1, 1);
    this.node.onaudioprocess = (event) => this.onFrame(event.inputBuffer.getChannelData(0));

    this.source.connect(this.node);
    // Connecting to the destination keeps the node pulling. Gain is zeroed so
    // nothing is actually played back.
    const mute = this.audio.createGain();
    mute.gain.value = 0;
    this.node.connect(mute);
    mute.connect(this.audio.destination);
  }

  // -------------------------------------------------------------------------

  private onFrame(input: Float32Array): void {
    let sum = 0;
    for (let i = 0; i < input.length; i++) sum += input[i] * input[i];
    const rms = Math.sqrt(sum / input.length);

    // The floor tracks the room: it falls quickly towards quiet and rises
    // slowly, so a fan that starts up does not permanently deafen the gate.
    this.noiseFloor = rms < this.noiseFloor ? this.noiseFloor * 0.9 + rms * 0.1 : this.noiseFloor * 0.995 + rms * 0.005;

    const loud = rms > Math.max(this.noiseFloor * SPEECH_OVER_FLOOR, ABSOLUTE_FLOOR);
    const now = Date.now();
    this.set({ level: Math.min(1, rms * 12) });

    if (loud) {
      if (!this.speaking) {
        this.speaking = true;
        this.speechStartedAt = now;
        this.buffer = [];
      }
      this.lastLoudAt = now;
    }

    if (this.speaking) {
      // Copy: the buffer the audio thread hands over is reused next frame.
      this.buffer.push(new Float32Array(input));

      const silentFor = now - this.lastLoudAt;
      const speechFor = now - this.speechStartedAt;
      if (silentFor > SILENCE_MS || speechFor > MAX_UTTERANCE_MS) {
        this.speaking = false;
        if (speechFor >= MIN_UTTERANCE_MS) void this.flush();
        this.buffer = [];
      }
    }
  }

  private async flush(): Promise<void> {
    if (!this.worker || this.buffer.length === 0) return;

    const total = this.buffer.reduce((n, chunk) => n + chunk.length, 0);
    const audio = new Float32Array(total);
    let offset = 0;
    for (const chunk of this.buffer) {
      audio.set(chunk, offset);
      offset += chunk.length;
    }

    const listening = Date.now() < this.commandUntil;
    this.set({ status: 'thinking', message: 'Transcribing…' });

    const id = this.nextId++;
    const text = await new Promise<string>((resolve) => {
      this.pending.set(id, resolve);
      // Transferred, not copied - this is up to a megabyte of audio.
      this.worker!.postMessage({ type: 'transcribe', id, audio }, [audio.buffer]);
    });

    this.handle(text.trim(), listening);
  }

  private handle(text: string, wasListening: boolean): void {
    if (!text) {
      this.rearm();
      return;
    }
    this.set({ heard: text });

    // Whisper hallucinates these on silence and near-silence.
    if (/^(?:you|thank you\.?|thanks for watching[.!]?|bye[.!]?|\.|\s*)$/i.test(text)) {
      this.rearm();
      return;
    }

    if (wasListening) {
      this.commandUntil = 0;
      this.set({ status: 'armed', message: 'Listening for “Jarvis”.' });
      this.handlers.onCommand(text);
      return;
    }

    if (!WAKE_PATTERN.test(text)) {
      this.rearm();
      return;
    }

    // The wake word landed. Anything after it in the same breath is already
    // the command - making the user pause and repeat themselves would be
    // worse than acting on what they just said.
    const remainder = text.replace(WAKE_PREFIX, '').trim();
    if (remainder.length > 2) {
      this.set({ status: 'armed', message: 'Listening for “Jarvis”.' });
      this.handlers.onCommand(remainder);
      return;
    }

    this.commandUntil = Date.now() + COMMAND_WINDOW_MS;
    this.set({ status: 'listening', message: 'Yes? Listening…' });
    this.handlers.onWake();
  }

  private rearm(): void {
    const listening = Date.now() < this.commandUntil;
    this.set({
      status: listening ? 'listening' : 'armed',
      message: listening ? 'Listening…' : 'Listening for “Jarvis”.',
    });
  }
}
