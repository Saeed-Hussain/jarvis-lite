import { create } from 'zustand';
import type { ChatMessage, JarvisMemory } from './types';
import { DEFAULT_MEMORY, loadMemory, saveMemory, appendLog } from './memory';
import { decide, act } from './agent';
import { uid, formatTime } from './utils';

interface PendingConfirmation {
  intentRaw: string;
}

interface PendingLearning {
  trigger: string;
}

interface JarvisState {
  messages: ChatMessage[];
  memory: JarvisMemory;
  isListening: boolean;
  isSpeaking: boolean;
  voiceEnabled: boolean;
  pendingConfirmation: PendingConfirmation | null;
  pendingLearning: PendingLearning | null;
  hydrated: boolean;

  hydrate: () => Promise<void>;
  sendMessage: (text: string) => Promise<void>;
  setListening: (v: boolean) => void;
  toggleVoice: () => void;
  speak: (text: string) => void;
}

function pushMessage(state: JarvisState, msg: ChatMessage) {
  return { messages: [...state.messages, msg] };
}

export const useJarvisStore = create<JarvisState>((set, get) => ({
  messages: [
    {
      id: uid(),
      role: 'jarvis',
      text: 'Good evening! I\'m online and ready to help. Try "open chrome" or "what time is it".',
      timestamp: Date.now(),
    },
  ],
  memory: DEFAULT_MEMORY,
  isListening: false,
  isSpeaking: false,
  voiceEnabled: true,
  pendingConfirmation: null,
  pendingLearning: null,
  hydrated: false,

  hydrate: async () => {
    const memory = await loadMemory();
    set({ memory, hydrated: true });
  },

  setListening: (v: boolean) => set({ isListening: v }),

  toggleVoice: () => set((s) => ({ voiceEnabled: !s.voiceEnabled })),

  speak: (text: string) => {
    if (!get().voiceEnabled) return;
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.rate = 1.02;
      utter.pitch = 1;
      set({ isSpeaking: true });
      utter.onend = () => set({ isSpeaking: false });
      utter.onerror = () => set({ isSpeaking: false });
      window.speechSynthesis.speak(utter);
    } catch {
      set({ isSpeaking: false });
    }
  },

  sendMessage: async (rawText: string) => {
    const text = rawText.trim();
    if (!text) return;
    const { memory, pendingConfirmation, pendingLearning } = get();

    const userMsg: ChatMessage = { id: uid(), role: 'user', text, timestamp: Date.now() };
    set((s) => pushMessage(s, userMsg));

    // ----- Handle an active learning prompt: user is teaching a new command -----
    if (pendingLearning) {
      const updatedCustom = { ...memory.custom_commands, [pendingLearning.trigger]: text };
      const updatedMemory: JarvisMemory = { ...memory, custom_commands: updatedCustom };
      await saveMemory(updatedMemory);
      const reply: ChatMessage = {
        id: uid(),
        role: 'jarvis',
        text: `Got it — I'll remember that "${pendingLearning.trigger}" means "${text}".`,
        timestamp: Date.now(),
        result: { success: true, message: 'Command learned' },
      };
      set((s) => ({ ...pushMessage(s, reply), memory: updatedMemory, pendingLearning: null }));
      get().speak(reply.text);
      return;
    }

    // ----- Handle an active confirmation prompt (e.g. shutdown, restart) -----
    if (pendingConfirmation) {
      const lower = text.toLowerCase();
      const confirmed = /^(yes|yep|yeah|confirm|sure|do it)$/.test(lower);
      const denied = /^(no|nope|cancel|don't|stop)$/.test(lower);

      if (confirmed) {
        const intent = decide(pendingConfirmation.intentRaw, memory);
        const { result, response, updatedMemory, log } = await act({ ...intent, requiresConfirmation: false }, memory);
        const finalMemory = appendLog(updatedMemory, log);
        await saveMemory(finalMemory);
        const reply: ChatMessage = { id: uid(), role: 'jarvis', text: response, timestamp: Date.now(), result };
        set((s) => ({ ...pushMessage(s, reply), memory: finalMemory, pendingConfirmation: null }));
        get().speak(response);
        return;
      }
      if (denied) {
        const reply: ChatMessage = {
          id: uid(),
          role: 'jarvis',
          text: 'Okay, action cancelled.',
          timestamp: Date.now(),
          result: { success: true, message: 'Cancelled' },
        };
        set((s) => ({ ...pushMessage(s, reply), pendingConfirmation: null }));
        get().speak(reply.text);
        return;
      }
      // Neither yes nor no — re-prompt
      const reply: ChatMessage = {
        id: uid(),
        role: 'jarvis',
        text: 'Please confirm with "yes" or "no".',
        timestamp: Date.now(),
      };
      set((s) => pushMessage(s, reply));
      return;
    }

    // ----- Normal observe -> decide -> act loop -----
    const intent = decide(text, memory);

    // Unknown command -> enter learning flow
    if (intent.type === 'unknown') {
      const { response, log } = await act(intent, memory);
      const finalMemory = appendLog(memory, log);
      await saveMemory(finalMemory);
      const reply: ChatMessage = {
        id: uid(),
        role: 'jarvis',
        text: response,
        timestamp: Date.now(),
        isLearningPrompt: response.startsWith("I don't know"),
      };
      set((s) => ({
        ...pushMessage(s, reply),
        memory: finalMemory,
        pendingLearning: response.startsWith("I don't know") ? { trigger: text } : null,
      }));
      get().speak(response);
      return;
    }

    // Dangerous action -> ask for confirmation first
    if (intent.requiresConfirmation) {
      const reply: ChatMessage = {
        id: uid(),
        role: 'jarvis',
        text: `Are you sure you want to ${intent.target}? This cannot be undone.`,
        timestamp: Date.now(),
        needsConfirmation: true,
      };
      set((s) => ({ ...pushMessage(s, reply), pendingConfirmation: { intentRaw: text } }));
      get().speak(reply.text);
      return;
    }

    // Execute normally
    const { result, response, updatedMemory, log } = await act(intent, memory);
    const finalMemory = appendLog(updatedMemory, log);
    await saveMemory(finalMemory);
    const reply: ChatMessage = { id: uid(), role: 'jarvis', text: response, timestamp: Date.now(), result };

    // A generic app launch that failed -> ask the user to teach the exact command/path
    if (intent.type === 'open_generic_app' && !result.success) {
      set((s) => ({ ...pushMessage(s, reply), memory: finalMemory, pendingLearning: { trigger: text } }));
      get().speak(response);
      return;
    }

    set((s) => ({ ...pushMessage(s, reply), memory: finalMemory }));
    get().speak(response);
  },
}));

export { formatTime };
