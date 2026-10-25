/**
 * Whether the window can actually be seen.
 *
 * The window runs with background throttling off so the microphone and the
 * Live session keep working from the tray — and with it off, Chromium reports
 * a hidden window as visible and keeps animating it, at more than a core of
 * CPU and GPU for nobody. The main process says when the window hides,
 * minimises or comes back; loops ask here before drawing, and while hidden the
 * root gets `app-hidden`, which pauses every CSS animation.
 */

type Listener = (visible: boolean) => void;

let shown = true;
let watching = false;
const listeners = new Set<Listener>();

/** Start listening to the main process. Safe to call more than once. */
export function watchVisibility(): void {
  if (watching || typeof window === 'undefined') return;
  watching = true;
  window.jarvis?.onVisibility?.((visible) => {
    shown = visible;
    document.documentElement.classList.toggle('app-hidden', !visible);
    listeners.forEach((listener) => listener(visible));
  });
}

export function isVisible(): boolean {
  watchVisibility();
  return shown && !(typeof document !== 'undefined' && document.hidden);
}

/** Called with the new state whenever the window hides or shows. */
export function onVisibility(listener: Listener): () => void {
  watchVisibility();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
