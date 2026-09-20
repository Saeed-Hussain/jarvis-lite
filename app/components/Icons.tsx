import { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

const base = (props: IconProps) => ({
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  ...props,
});

export const HomeIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="M3 11.5 12 4l9 7.5" /><path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9" /></svg>
);
export const ChatIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="M4 4h16v12H8l-4 4V4Z" /></svg>
);
export const CommandIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="m6 8 6 4-6 4" /><path d="M13 16h6" /></svg>
);
export const SystemIcon = (p: IconProps) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" /></svg>
);
export const FolderIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="M4 6h5l2 2h9v11H4V6Z" /></svg>
);
export const AppsIcon = (p: IconProps) => (
  <svg {...base(p)}><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><rect x="14" y="14" width="6" height="6" rx="1" /></svg>
);
export const SettingsIcon = (p: IconProps) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.9 2.9l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21a2 2 0 1 1-4 0v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.9-2.9l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H3a2 2 0 1 1 0-4h.2a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1A2 2 0 1 1 7.2 3.5l.1.1a1.7 1.7 0 0 0 1.9.3H9.3a1.7 1.7 0 0 0 1-1.6V2a2 2 0 1 1 4 0v.2a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.9 2.9l-.1.1a1.7 1.7 0 0 0-.3 1.9V8.3a1.7 1.7 0 0 0 1.6 1H21a2 2 0 1 1 0 4h-.2a1.7 1.7 0 0 0-1.5 1Z" /></svg>
);
export const MemoryIcon = (p: IconProps) => (
  <svg {...base(p)}><ellipse cx="12" cy="6" rx="8" ry="3" /><path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6" /><path d="M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" /></svg>
);
export const LogsIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="M6 3h9l5 5v13H6V3Z" /><path d="M14 3v5h5" /><path d="M9 13h6M9 17h6" /></svg>
);
export const InfoIcon = (p: IconProps) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.5v.01" /></svg>
);
export const MicIcon = (p: IconProps) => (
  <svg {...base(p)}><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6" /></svg>
);
export const SendIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="m3 12 18-8-8 18-2-8-8-2Z" /></svg>
);
export const SunIcon = (p: IconProps) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
);
export const MoonIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" /></svg>
);
export const MinimizeIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="M5 12h14" /></svg>
);
export const MaximizeIcon = (p: IconProps) => (
  <svg {...base(p)}><rect x="5" y="5" width="14" height="14" rx="1.5" /></svg>
);
export const CloseIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="m6 6 12 12M18 6 6 18" /></svg>
);
export const CheckIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="m5 12 4 4 10-10" /></svg>
);
export const ClockIcon = (p: IconProps) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
);
export const PowerIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="M12 2v9" /><path d="M6.3 6.3a9 9 0 1 0 11.4 0" /></svg>
);
export const ChromeIcon = (p: IconProps) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="3.2" /><path d="M12 3v6M5 8.5l5.2 3M18.9 15.5 12 15" /></svg>
);
export const CodeIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="m8 8-4 4 4 4M16 8l4 4-4 4M13 5l-2 14" /></svg>
);
export const NoteIcon = (p: IconProps) => (
  <svg {...base(p)}><rect x="4" y="3" width="16" height="18" rx="1.5" /><path d="M8 8h8M8 12h8M8 16h5" /></svg>
);
export const PlayIcon = (p: IconProps) => (
  <svg {...base(p)}><rect x="3" y="5" width="18" height="14" rx="3" /><path d="m10 9 5 3-5 3V9Z" fill="currentColor" stroke="none" /></svg>
);
export const UserIcon = (p: IconProps) => (
  <svg {...base(p)}><circle cx="12" cy="8" r="3.5" /><path d="M4.5 20a7.5 7.5 0 0 1 15 0" /></svg>
);
export const BotIcon = (p: IconProps) => (
  <svg {...base(p)}><rect x="4" y="7" width="16" height="12" rx="3" /><path d="M12 3v4M9 12v1M15 12v1" /></svg>
);
export const ChevronRightIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="m9 6 6 6-6 6" /></svg>
);
export const PilotIcon = (p: IconProps) => (
  <svg {...base(p)}><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M9 21h6M12 17v4" /><path d="m10 9 4 2.5-4 2.5V9Z" fill="currentColor" stroke="none" /></svg>
);
export const RecordIcon = (p: IconProps) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4" fill="currentColor" stroke="none" /></svg>
);
export const StopIcon = (p: IconProps) => (
  <svg {...base(p)}><rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none" /></svg>
);
export const UndoIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="M3 10h11a5 5 0 0 1 0 10h-3" /><path d="m7 6-4 4 4 4" /></svg>
);
export const ShieldIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="M12 3 5 6v6c0 4 3 7.5 7 9 4-1.5 7-5 7-9V6l-7-3Z" /><path d="m9 12 2 2 4-4" /></svg>
);

export const APP_ICON_MAP: Record<string, (p: IconProps) => JSX.Element> = {
  chrome: ChromeIcon,
  vscode: CodeIcon,
  notepad: NoteIcon,
  folder: FolderIcon,
  calculator: AppsIcon,
  youtube: PlayIcon,
  google: ChromeIcon,
  mail: NoteIcon,
  github: CodeIcon,
};
