# Jarvis — glass design system

Reference: Cadence (`D:\projects\cadence\apps\web\app\globals.css` and its components). Frosted panels floating over a slow field of colour. The colour is only ever *behind* the glass; the interface itself stays near-monochrome with **one accent** (the assistant's colour, user-configurable). Light and dark are one design with the light exchanged.

## Tokens (all in `app/globals.css` — never hard-code a colour)

| Token | Use |
|---|---|
| `--ink`, `--ink-2`, `--ink-3`, `--ink-4` | text: primary, secondary, tertiary/captions, disabled/hairline icons |
| `--glass`, `--glass-strong`, `--glass-soft`, `--glass-hover` | panel backgrounds |
| `--fill`, `--fill-2`, `--fill-3` | wells, hover, pressed, tracks inside glass |
| `--line`, `--line-2` | borders (hairline, stronger) |
| `--highlight` | the 1px inner top highlight on glass (`box-shadow: inset 0 1px 0 var(--highlight)`) |
| `--primary` / `--on-primary` | the strongest button (near-black in light, near-white in dark) |
| `--accent`, `--accent-rgb`, `--accent-soft`, `--accent-ink` | the one colour: focus rings, active states, selected icons. `--accent-ink` for accent-coloured *text* (readable in light theme) |
| `--good`, `--warn`, `--bad`, `--think` | status only |
| `--shadow-sm`, `--shadow`, `--shadow-lg` | depth |
| `--radius-sm` 10, `--radius` 16, `--radius-lg` 22 | corners |
| `--ease`, `--spring` | motion curves |
| `--font-sans` (Inter), `--font-mono` (JetBrains Mono) | type; numbers in `.mono .tnum` |

Legacy `--jarvis-*` names are mapped onto these, and Mark's `--mk-*` names are remapped inside `.mk-root`, but **new code uses the tokens above**.

## Utility classes (globals.css)

- `.glass` / `.glass-strong` / `.glass-soft` — blurred panel. Use **sparingly**: only top-level panels and floating things (modals, popovers). Never nest blur inside blur; inside glass use `.well` or `var(--fill)` backgrounds.
- `.well` — translucent inset surface inside glass.
- `.btn` (+ `.primary` `.accent` `.ghost` `.danger` `.sm` `.icon`) — pill buttons.
- `.chip` (+ `<i class="dot">`) — small status pill.
- `.switch` / `.switch.on` — toggle (put it inside a `<button>` row; the row is the click target).
- `.field` — text input / select.
- `.label-caps` — small uppercase section label.
- Icons: `app/components/Icons.tsx` (stroke SVGs, 1.8 width). Prefer these over emoji/glyphs like ◈ ▸ ✕ ⚙.

## Rules

1. Sentence case, plain words. No `◈ SYS MONITOR`, `[F4]`, `▸`, all-caps labels or terminal glyphs. Keep keyboard hints as `<kbd>`.
2. Type scale: page title 22–26px/620–650 weight/-0.03em; card title 14–15px/620; body 13.5–14px; captions 11.5–12.5px `--ink-3`.
3. Spacing on a 4px grid; panels pad 14–20px; gaps 8/12px.
4. Interactive things get hover (`--fill-2`), press (`scale(0.97)` with `--spring`), and `:focus-visible` (accent ring — global).
5. Motion is short and soft: enter with opacity + 6–12px translate, 0.3–0.55s `--ease`. Popovers/modals pop with `--spring`. Nothing loops except live-state indicators.
6. Both themes must look right: test against `.dark` and light (`html` without `.dark`).
7. Performance matters (modest laptop): no `backdrop-filter` on many small elements, no animating blur, no box-shadow animations on large areas, no `transition: all`.
8. Don't change behaviour, props, store calls or IPC. This is a visual pass.
