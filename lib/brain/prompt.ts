/**
 * The prompt.
 *
 * A 0.5B model will not reason its way to a good answer, so the prompt does
 * the reasoning for it: a closed list of intents, the exact JSON shape, and
 * worked examples covering the shapes that actually come up. Examples are
 * worth far more than instructions at this size.
 *
 * Kept separate from the worker so it can be edited and diffed without
 * touching the inference code.
 */

export const SYSTEM_PROMPT = `You convert a user's spoken command into JSON steps for a desktop assistant.

Reply with ONLY a JSON array. No prose, no explanation, no markdown fence.

Each step is {"intent": "...", ...fields}. Valid intents and their fields:

[{"intent":"open_app","app":"chrome|notepad|vscode|calculator|explorer|word|excel|spotify|..."}]
[{"intent":"open_site","site":"youtube.com"}]
[{"intent":"search","query":"the search text"}]
[{"intent":"open_path","path":"D:\\\\ or D:\\\\projects or downloads"}]
[{"intent":"list_path","path":"D:\\\\projects"}]
[{"intent":"send_message","recipient":"name","message":"the text"}]
[{"intent":"system","action":"shutdown|restart|lock|sleep"}]
[{"intent":"time"}]
[{"intent":"date"}]
[{"intent":"wait","seconds":5}]
[{"intent":"pilot","workflow":"a saved workflow name"}]

Rules:
- One sentence can be several steps. Keep them in the order the user said them.
- Use open_path for drives and folders. "D drive" is "D:\\\\".
- If the user names no folder for open_path, omit the step.
- Never invent an intent that is not in the list above.
- If you cannot map the command at all, reply exactly: []`;

interface Example {
  user: string;
  json: string;
}

/**
 * Worked examples, chosen to cover the failure modes a small model actually
 * has: chaining, drives and folders, a search that is not an app, and the
 * empty answer.
 */
const EXAMPLES: Example[] = [
  {
    user: 'open chrome and search for tailwind docs',
    json: '[{"intent":"open_app","app":"chrome"},{"intent":"search","query":"tailwind docs"}]',
  },
  {
    user: 'open d drive then go to the projects folder',
    json: '[{"intent":"open_path","path":"D:\\\\"},{"intent":"open_path","path":"projects"}]',
  },
  {
    user: 'pull up whatever is inside my downloads',
    json: '[{"intent":"list_path","path":"downloads"}]',
  },
  {
    user: 'whats the time and then lock the pc',
    json: '[{"intent":"time"},{"intent":"system","action":"lock"}]',
  },
  {
    user: 'text sara that I am running late',
    json: '[{"intent":"send_message","recipient":"sara","message":"I am running late"}]',
  },
  {
    user: 'sing me a song',
    json: '[]',
  },
];

/** Chat messages for the tokenizer's chat template. */
export function buildMessages(utterance: string, context?: { workflows?: string[]; cwd?: string }) {
  let system = SYSTEM_PROMPT;

  // Context is appended rather than baked in, so the cached prefix stays the
  // same shape between calls.
  if (context?.workflows?.length) {
    system += `\n\nSaved Pilot workflows: ${context.workflows.join(', ')}.`;
  }
  if (context?.cwd) {
    system += `\n\nThe user is currently looking at ${context.cwd}. A bare folder name means inside it.`;
  }

  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: system },
  ];
  for (const example of EXAMPLES) {
    messages.push({ role: 'user', content: example.user });
    messages.push({ role: 'assistant', content: example.json });
  }
  messages.push({ role: 'user', content: utterance });
  return messages;
}
