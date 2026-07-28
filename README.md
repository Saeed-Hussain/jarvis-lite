# Jarvis Lite — Rule-Based Desktop Assistant

A lightweight "Jarvis"-style desktop assistant built with **Next.js + Electron**.
No heavy AI/ML, no cloud APIs — intent detection is pure rule-based keyword
matching, running fully offline.

## Features

- **Text + voice input** (Web Speech API), **voice output** (SpeechSynthesis)
- **Agent loop**: Observe → Decide → Act → Learn (see `lib/agent.ts`)
- **System actions**: open Chrome/VS Code/Notepad/Explorer/Calculator, open
  websites, shutdown/restart/lock (with confirmation), time/date
- **Context awareness**: "open chrome" → "open it" reuses the last app
- **Command learning**: unknown input → Jarvis asks what to do → saved to
  `memory.json` and reused next time
- **Confirmation system** for destructive actions
- **Decision logging** with a full log view
- **Dark & light mode**, matches the reference dashboard UI exactly
- **10-page nav**: Dashboard, Chat, Commands, System Control, Files &
  Folders, Apps, Settings, Memory, Logs, About

## Project Structure

```
jarvis-lite/
├── electron/
│   ├── main.js          # Electron main process (IPC, fs, child_process, os)
│   └── preload.js        # Secure contextBridge API exposed as window.jarvis
├── app/
│   ├── page.tsx           # View router / main layout
│   ├── layout.tsx
│   ├── globals.css        # Theme tokens (dark + light)
│   ├── context/ThemeContext.tsx
│   └── components/        # Sidebar, TopBar, Chat, InputBar, StatusPanel, views...
├── lib/
│   ├── agent.ts            # Decision engine (decide + act)
│   ├── commands.ts         # Known apps / sites / dangerous actions
│   ├── memory.ts            # Memory persistence wrapper
│   ├── store.ts              # Zustand state store
│   ├── types.ts
│   └── utils.ts
├── memory.json             # Seed memory file (runtime copy lives in Electron userData)
└── package.json
```

## Getting Started

Requires Node.js 18+.

```bash
npm install

# Run in the browser only (no system actions, simulated responses)
npm run dev

# Run as a real desktop app (Next.js dev server + Electron window)
npm run electron:dev
```

Try commands like:

- `open chrome`
- `open youtube`
- `what time is it`
- `shutdown pc` (asks for confirmation)
- `open it` (repeats your last app/command)
- anything unrecognized → Jarvis asks what to do and remembers it

## Building a Desktop Executable

```bash
npm run dist
```

This runs `next build` (static export to `out/`) and then `electron-builder`,
producing an installer in `dist/` for your OS (`.exe` on Windows, `.dmg` on
macOS, `.AppImage` on Linux).

## Notes

- When running with `npm run dev` in a plain browser tab (not inside
  Electron), system actions are **simulated** — there's no `window.jarvis`
  bridge available outside Electron, so opening apps/shutdown just show a
  simulated response instead of touching your OS.
- Memory persists to a JSON file in Electron's `userData` directory when
  running as a desktop app, or to `localStorage` when running in a plain
  browser tab.
- Extend the assistant by adding entries to `lib/commands.ts` (new apps/sites)
  and rules to `lib/agent.ts` (new intents).
