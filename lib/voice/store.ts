/**
 * Voice state, and the wiring between hearing something and doing it.
 *
 * Kept out of the chat store because the listener is a long-lived object with
 * a microphone attached, and because voice has to survive the window being
 * hidden to the tray — which is the whole point of a wake word.
 */

import { create } from 'zustand';
import { VoiceListener, VoiceState } from './listener';
import { useJarvisStore } from '../store';

const VOICE_KEY = 'jarvis-lite-wake-enabled';

function readPreference(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(VOICE_KEY) === 'true';
  } catch {
    return false;
  }
}

function writePreference(enabled: boolean): void {
  try {
    window.localStorage.setItem(VOICE_KEY, String(enabled));
  } catch {
    /* storage disabled - the toggle just won't survive a restart */
  }
}

interface VoiceStore {
  listener: VoiceListener | null;
  state: VoiceState;
  /** Whether always-on listening should come back on at launch. */
  wakeEnabled: boolean;

  init: () => void;
  enable: () => Promise<void>;
  disable: () => void;
  /** Mic button: capture one command without needing the wake word. */
  listenOnce: () => Promise<void>;
}

const INITIAL: VoiceState = { status: 'off', percent: 0, device: '', message: '', level: 0, heard: '' };

export const useVoiceStore = create<VoiceStore>((set, get) => ({
  listener: null,
  state: INITIAL,
  wakeEnabled: false,

  init: () => {
    if (get().listener || typeof window === 'undefined') return;

    const listener = new VoiceListener({
      onState: (state) => {
        set({ state });
        // Keep the existing chat indicator honest about what the mic is doing.
        useJarvisStore.getState().setListening(state.status === 'listening');
      },
      onWake: () => {
        // The window is probably hidden - that is why a wake word exists.
        void window.jarvis?.showWindow?.();
        useJarvisStore.getState().speak('Yes?');
      },
      onCommand: (text) => {
        void window.jarvis?.showWindow?.();
        void useJarvisStore.getState().sendMessage(text);
      },
    });

    const wakeEnabled = readPreference();
    set({ listener, wakeEnabled });
    if (wakeEnabled) void listener.start();
  },

  enable: async () => {
    get().init();
    writePreference(true);
    set({ wakeEnabled: true });
    await get().listener?.start();
  },

  disable: () => {
    writePreference(false);
    set({ wakeEnabled: false });
    get().listener?.stop();
  },

  listenOnce: async () => {
    get().init();
    const listener = get().listener;
    if (!listener) return;
    // Starting without setting the preference: one command, then it stops
    // again unless the wake word is separately switched on.
    if (!listener.running) await listener.start();
    listener.listenNow();
  },
}));
