# Jarvis Lite — Agentic Desktop Assistant

A "Jarvis"-style desktop assistant built with **Next.js + Electron**.

It is **agentic but not an LLM**: no model, no API key, no network calls, no
cost. A hand-written planner turns one spoken or typed sentence into an ordered
plan of steps, then an executor runs them, pausing to ask you only about the
parts it genuinely cannot infer.

```
hey jarvis, open chrome with profile saeed and search whatsapp web
                         and text someone a message

  1. ✓ Open Google Chrome (profile: saeed)
  2. ✓ Open WhatsApp Web
  3. ? Send a WhatsApp message
     → "Who should I send it to?"
```

## What it does

- **Chained commands.** One sentence, many steps. `and`, `then`, `after that`
  and commas separate instructions — but only when a real action follows, so
  "search for cats and dogs" stays a single search.
- **Slot extraction.** Pulls browser profiles (`with profile saeed`), phone
  numbers, quoted message bodies (`saying "running late"`), and wait durations
  out of plain language.
- **Chrome / Edge / Firefox profiles.** Says a display name, launches the right
  profile — Jarvis reads Chrome's `Local State` to map "saeed" to its on-disk
  profile directory.
- **WhatsApp messaging.** Opens the chat with your message pre-filled. Contacts
  are learned: the first time you name someone it asks for the number, then
  remembers it.
- **Asks instead of failing.** A half-specified step pauses the plan and asks
  for the missing piece, then resumes where it left off — completed steps are
  never re-run.
- **Confirms destructive actions.** Shutdown, restart, lock and sleep need an
  explicit yes.
- **Stops on failure.** If step 2 fails, steps 3+ are skipped rather than run
  against a state that never happened.
- **Learns unknown commands.** An unrecognised phrase becomes a question, and
  your answer is saved to memory and reused.
- Voice in (Web Speech API) and out (SpeechSynthesis), dark/light themes, and a
  10-page dashboard.

## Architecture

The agent loop is split so that planning is pure and testable — the planner
never touches the OS, and the executor owns every side effect.

```
lib/nlu.ts        Wake word, compound splitting, slot extraction   (pure)
lib/planner.ts    Utterance -> Plan { Task[] }                     (pure)
lib/executor.ts   Runs tasks in order, pauses for input            (effects via IPC)
lib/store.ts      Zustand state; owns the pause/resume conversation
electron/main.js  Privileged actions: launching, URLs, system, WhatsApp
electron/preload.js  contextBridge surface exposed as window.jarvis
```

Because the planner is pure, you can exercise it in plain Node without Electron:

```js
const { planUtterance } = require('./lib/planner');
planUtterance('open chrome with profile saeed then lock pc', memory).tasks;
```

## Getting started

Requires Node.js 18+.

```bash
npm install

# Browser only - system actions are simulated, nothing touches your OS
npm run dev

# Real desktop app (Next dev server + Electron)
npm run electron:dev

# Typecheck
npm run typecheck
```

## Building an installer

```bash
npm run dist
```

`next build` statically exports to `out/` (via `output: 'export'`), then
electron-builder packages it into `dist/` — `.exe` on Windows, `.dmg` on macOS,
`.AppImage` on Linux.

To ship custom icons, drop `icon.ico` / `icon.icns` / `icon.png` into a `build/`
directory; electron-builder picks them up automatically.

## Security notes

- Every OS call uses `spawn`/`execFile` with an **argument array** and
  `shell: false`. User text can never inject a second command — asking to open
  `a & calc` looks for an app literally named `a & calc` and fails.
- `openUrl` only accepts `http(s)`, so a crafted `file://` or custom scheme
  can't be handed to the shell.
- The renderer runs with `contextIsolation: true` and `nodeIntegration: false`;
  all privilege lives behind the narrow `window.jarvis` bridge.
- In-app navigation and popups are denied — external links open in your real
  browser.

## Limits worth knowing

- **WhatsApp auto-send is off by default.** WhatsApp has no supported API for
  sending from a link; the click-to-chat URL can only *pre-fill* a message. The
  optional auto-send (Settings) waits a few seconds and sends a synthetic Enter
  to the foreground window — if you click elsewhere during that pause, the
  keystroke goes to the wrong window. It's Windows-only.
- **Contacts are addressed by number.** WhatsApp links can't target a display
  name, which is why Jarvis asks for a number the first time it meets a name.
- **Profile names need Chrome's `Local State`** to be readable. If it isn't,
  Jarvis passes your text through as the literal directory name and tells you
  when it couldn't apply the profile rather than silently ignoring it.
- **It is not a language model.** It understands the patterns in `lib/nlu.ts`
  and the vocabulary in `lib/commands.ts`. Phrasing far outside those becomes a
  "teach me" prompt rather than a guess.

## Extending it

- New apps/sites → add an entry to `KNOWN_APPS` / `KNOWN_SITES` in
  `lib/commands.ts`. Aliases are matched longest-first, so `whatsapp web`
  correctly beats `whatsapp`.
- New action types → add a `TaskKind` in `lib/types.ts`, plan it in
  `lib/planner.ts`, execute it in `lib/executor.ts`.
- New phrasings → extend the patterns in `lib/nlu.ts`.
