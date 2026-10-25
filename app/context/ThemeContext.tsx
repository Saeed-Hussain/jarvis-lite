'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { reapplyAccent } from '@/lib/mark/store';
import { watchVisibility } from '@/lib/visibility';

type Theme = 'dark' | 'light';
/** 'full' lets the colour field drift; 'lite' holds it still (cheapest glass). */
type Effects = 'full' | 'lite';

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
  effects: Effects;
  toggleEffects: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'dark',
  toggleTheme: () => {},
  effects: 'full',
  toggleEffects: () => {},
});

const STORAGE_KEY = 'jarvis-lite-theme';
// Lite is the default: the drifting field re-blurs every glass panel on every
// frame, the single largest idle cost in the app. The key is new so earlier
// installs, which all started on 'full', start lite once too.
const FX_KEY = 'jarvis-lite-effects-v2';

function read<T extends string>(key: string, fallback: T): T {
  try {
    return (window.localStorage.getItem(key) as T | null) ?? fallback;
  } catch {
    return fallback;
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>('dark');
  const [effects, setEffects] = useState<Effects>('lite');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setTheme(read<Theme>(STORAGE_KEY, 'dark'));
    setEffects(read<Effects>(FX_KEY, 'lite'));
    watchVisibility();
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    root.classList.toggle('fx-lite', effects === 'lite');
    reapplyAccent(); // the field's colours differ per theme
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
      window.localStorage.setItem(FX_KEY, effects);
    } catch {
      /* storage disabled — the choice just won't survive a restart */
    }
  }, [theme, effects, mounted]);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    // A circle of the new theme grows from the corner, where supported.
    const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
    if (doc.startViewTransition && effects === 'full') doc.startViewTransition(() => setTheme(next));
    else setTheme(next);
  };
  const toggleEffects = () => setEffects((e) => (e === 'full' ? 'lite' : 'full'));

  return <ThemeContext.Provider value={{ theme, toggleTheme, effects, toggleEffects }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
