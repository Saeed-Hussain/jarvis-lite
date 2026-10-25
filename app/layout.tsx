import type { Metadata } from 'next';
// Self-hosted variable fonts, bundled with the app: the desktop build renders
// the same type with the network unplugged. (next/font cannot be used here —
// it rejects the relative assetPrefix that file:// loading needs.)
import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import './globals.css';
import { ThemeProvider } from './context/ThemeContext';

export const metadata: Metadata = {
  title: 'Jarvis',
  description: 'Voice assistant for the desktop',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
