import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        jarvis: {
          bg: 'var(--jarvis-bg)',
          panel: 'var(--jarvis-panel)',
          panel2: 'var(--jarvis-panel-2)',
          border: 'var(--jarvis-border)',
          text: 'var(--jarvis-text)',
          subtext: 'var(--jarvis-subtext)',
          accent: 'var(--jarvis-accent)',
          accent2: 'var(--jarvis-accent-2)',
          success: 'var(--jarvis-success)',
          danger: 'var(--jarvis-danger)',
          purple: 'var(--jarvis-purple)',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 24px -6px var(--jarvis-accent)',
        card: '0 4px 24px -8px rgba(0,0,0,0.4)',
      },
      keyframes: {
        pulseRing: {
          '0%': { transform: 'scale(0.9)', opacity: '0.6' },
          '70%': { transform: 'scale(1.4)', opacity: '0' },
          '100%': { transform: 'scale(1.4)', opacity: '0' },
        },
        wave: {
          '0%, 100%': { transform: 'scaleY(0.3)' },
          '50%': { transform: 'scaleY(1)' },
        },
      },
      animation: {
        pulseRing: 'pulseRing 2s cubic-bezier(0.4,0,0.6,1) infinite',
        wave: 'wave 1s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
