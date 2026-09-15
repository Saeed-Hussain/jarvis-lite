import { create } from 'zustand';
import type { ChatMessage, JarvisMemory, Plan, Task } from './types';
import { DEFAULT_MEMORY, loadMemory, saveMemory, appendLog } from './memory';
import { planUtterance } from './planner';
import { runPlan, PauseReason } from './executor';
import { uid, formatTime } from './utils';

/** What Jarvis is currently waiting for the user to answer. */
interface PendingAnswer {
  plan: Plan;
  pause: PauseReason;
  /** Tasks already approved this turn, carried across resumes. */
  approved: string[];
}

/** An unrecognised command Jarvis has offered to learn. */
interface PendingLearning {
  trigger: string;
}

interface JarvisState {
  messages: ChatMessage[];
  memory: JarvisMemory;
  isListening: boolean;
  isSpeaking: boolean;
  voiceEnabled: boolean;
  autoSendWhatsApp: boolean;
  pending: PendingAnswer | null;
  pendingLearning: PendingLearning | null;
  hydrated: boolean;

  hydrate: () => Promise<void>;
  sendMessage: (text: string) => Promise<void>;
  setListening: (v: boolean) => void;
  toggleVoice: () => void;
  toggleAutoSend: () => void;
  speak: (text: string) => void;
  clearChat: () => void;
}

const YES = /^(?:y|yes|yep|yeah|yup|sure|ok|okay|confirm|do it|go ahead|please do)$/i;
const NO = /^(?:n|no|nope|nah|cancel|stop|don'?t|never mind|nevermind|abort)$/i;

function greeting(): string {
  const hour = new Date().getHours();
  const part = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
  return `Good ${part}. I'm online. Try "open chrome with profile saeed and search whatsapp web".`;
}

function jarvisMessage(text: string, extra: Partial<ChatMessage> = {}): ChatMessage {
  return { id: uid(), role: 'jarvis', text, timestamp: Date.now(), ...extra };
}

/** Collapse a finished plan into one readable reply. */
function summarize(transcript: string[]): string {
  if (transcript.length === 0) return 'Nothing to do.';
  if (transcript.length === 1) return transcript[0];
  return transcript.map((line, i) => `${i + 1}. ${line}`).join('\n');
}

export const useJarvisStore = create<JarvisState>((set, get) => ({
  messages: [jarvisMessage(greeting())],
  memory: DEFAULT_MEMORY,
  isListening: false,
  isSpeaking: false,
  voiceEnabled: true,
  autoSendWhatsApp: false,
  pending: null,
  pendingLearning: null,
  hydrated: false,

  hydrate: async () => {
    const memory = await loadMemory();
    set({ memory, hydrated: true });
  },

  setListening: (v) => set({ isListening: v }),
  toggleVoice: () => set((s) => ({ voiceEnabled: !s.voiceEnabled })),
  toggleAutoSend: () => set((s) => ({ autoSendWhatsApp: !s.autoSendWhatsApp })),
  clearChat: () => set({ messages: [jarvisMessage(greeting())], pending: null, pendingLearning: null }),

  speak: (text) => {
    if (!get().voiceEnabled) return;
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      // Numbered multi-step summaries read badly aloud; speak the plain lines.
      const utter = new SpeechSynthesisUtterance(text.replace(/^\d+\.\s*/gm, ''));
      utter.rate = 1.02;
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

    const { memory, pending, pendingLearning, autoSendWhatsApp } = get();
    set((s) => ({ messages: [...s.messages, { id: uid(), role: 'user', text, timestamp: Date.now() }] }));

    const reply = (message: ChatMessage, patch: Partial<JarvisState> = {}) => {
      set((s) => ({ ...patch, messages: [...s.messages, message] }));
      get().speak(message.text);
    };

    // ----- teaching a previously unknown command -----
    if (pendingLearning) {
      const updated: JarvisMemory = {
        ...memory,
        custom_commands: { ...memory.custom_commands, [pendingLearning.trigger]: text },
      };
      await saveMemory(updated);
      reply(
        jarvisMessage(`Got it — "${pendingLearning.trigger}" now means "${text}".`, {
          result: { success: true, message: 'Command learned' },
        }),
        { memory: updated, pendingLearning: null },
      );
      return;
    }

    // ----- answering a paused plan -----
    if (pending) {
      const { plan, pause, approved } = pending;
      const tasks = plan.tasks.map((t) => ({ ...t }));
      const target = tasks.find((t) => t.id === pause.task.id);

      if (!target) {
        set({ pending: null });
        return;
      }

      if (pause.type === 'confirm') {
        if (NO.test(text)) {
          target.status = 'skipped';
          target.note = 'you cancelled it';
          tasks.forEach((t) => {
            if (t.status === 'pending') {
              t.status = 'skipped';
              t.note = 'cancelled';
            }
          });
          reply(jarvisMessage('Cancelled — I left everything as it was.', { plan: { ...plan, tasks } }), {
            pending: null,
          });
          return;
        }
        if (!YES.test(text)) {
          reply(jarvisMessage('Just to be safe — reply "yes" to go ahead, or "no" to cancel.'));
          return;
        }
        target.status = 'pending';
        await resume({ ...plan, tasks }, [...approved, target.id]);
        return;
      }

      // pause.type === 'missing'
      if (NO.test(text)) {
        target.status = 'skipped';
        target.note = 'you cancelled it';
        reply(jarvisMessage("Okay, I've dropped that step.", { plan: { ...plan, tasks } }), { pending: null });
        return;
      }

      if (pause.slot === 'phone') {
        const digits = text.replace(/[^\d+]/g, '');
        if (digits.replace(/\D/g, '').length < 7) {
          reply(jarvisMessage("That doesn't look like a phone number. Include the country code, e.g. +923001234567."));
          return;
        }
        target.phone = digits;
        target.missing = undefined;
        target.status = 'pending';
      } else if (pause.slot === 'recipient') {
        const digits = text.replace(/[^\d+]/g, '');
        if (digits.replace(/\D/g, '').length >= 7) {
          target.phone = digits;
          target.recipient = digits;
        } else {
          target.recipient = text;
        }
        target.missing = target.missing?.filter((m) => m !== 'recipient');
        if (!target.missing?.length) target.missing = undefined;
        target.status = 'pending';
      } else {
        target.message = text;
        target.missing = target.missing?.filter((m) => m !== 'message');
        if (!target.missing?.length) target.missing = undefined;
        target.status = 'pending';
      }

      await resume({ ...plan, tasks }, approved);
      return;
    }

    // ----- a fresh utterance -----
    const plan = planUtterance(text, memory);
    await resume(plan, []);

    // -----------------------------------------------------------------------

    async function resume(activePlan: Plan, approvedIds: string[]) {
      const current = get().memory;
      const outcome = await runPlan(activePlan, current, {
        approved: new Set(approvedIds),
        autoSendWhatsApp,
      });

      let nextMemory = outcome.memory;
      for (const entry of outcome.logs) nextMemory = appendLog(nextMemory, entry);
      await saveMemory(nextMemory);

      const pause = outcome.pause;
      if (pause) {
        const prefix = outcome.transcript.length ? `${summarize(outcome.transcript)}\n\n` : '';
        set((s) => ({
          memory: nextMemory,
          pending: { plan: outcome.plan, pause, approved: approvedIds },
          messages: [
            ...s.messages,
            jarvisMessage(`${prefix}${pause.question}`, {
              plan: outcome.plan,
              needsConfirmation: pause.type === 'confirm',
            }),
          ],
        }));
        get().speak(pause.question);
        return;
      }

      // An entirely unresolved single step becomes a teaching opportunity.
      const onlyTask: Task | undefined = outcome.plan.tasks.length === 1 ? outcome.plan.tasks[0] : undefined;
      const teachable = onlyTask?.kind === 'unknown';

      const summary = summarize(outcome.transcript);
      set((s) => ({
        memory: nextMemory,
        pending: null,
        pendingLearning: teachable ? { trigger: text } : null,
        messages: [...s.messages, jarvisMessage(summary, { plan: outcome.plan })],
      }));
      get().speak(summary);
    }
  },
}));

export { formatTime };
