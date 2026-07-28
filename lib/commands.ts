export interface AppDef {
  key: string;
  label: string;
  icon: string; // maps to APP_ICON_MAP in Icons.tsx, falls back to a generic icon
  aliases: string[];
}

export interface SiteDef {
  key: string;
  label: string;
  url: string;
  icon: string;
  aliases: string[];
}

// Curated, high-confidence entries — these get a nice label + icon + guaranteed launch command.
// Anything NOT in these two lists still works via the generic resolver in lib/agent.ts.
export const KNOWN_APPS: AppDef[] = [
  { key: 'chrome', label: 'Google Chrome', icon: 'chrome', aliases: ['chrome', 'google chrome', 'browser'] },
  { key: 'firefox', label: 'Firefox', icon: 'chrome', aliases: ['firefox', 'mozilla'] },
  { key: 'edge', label: 'Microsoft Edge', icon: 'chrome', aliases: ['edge', 'microsoft edge'] },
  { key: 'vscode', label: 'VS Code', icon: 'vscode', aliases: ['vs code', 'vscode', 'code editor', 'visual studio code'] },
  { key: 'notepad', label: 'Notepad', icon: 'notepad', aliases: ['notepad', 'text editor', 'notes'] },
  { key: 'explorer', label: 'File Explorer', icon: 'folder', aliases: ['file explorer', 'explorer', 'files'] },
  { key: 'calculator', label: 'Calculator', icon: 'calculator', aliases: ['calculator', 'calc'] },
  { key: 'cmd', label: 'Command Prompt', icon: 'terminal', aliases: ['cmd', 'command prompt', 'console'] },
  { key: 'powershell', label: 'PowerShell', icon: 'terminal', aliases: ['powershell', 'power shell'] },
  { key: 'terminal', label: 'Terminal', icon: 'terminal', aliases: ['terminal'] },
  { key: 'taskmanager', label: 'Task Manager', icon: 'system', aliases: ['task manager', 'taskmanager'] },
  { key: 'controlpanel', label: 'Control Panel', icon: 'settings', aliases: ['control panel', 'controlpanel'] },
  { key: 'settingsapp', label: 'Settings', icon: 'settings', aliases: ['windows settings', 'system settings'] },
  { key: 'paint', label: 'Paint', icon: 'notepad', aliases: ['paint', 'ms paint', 'mspaint'] },
  { key: 'word', label: 'Microsoft Word', icon: 'notepad', aliases: ['word', 'microsoft word', 'ms word'] },
  { key: 'excel', label: 'Microsoft Excel', icon: 'notepad', aliases: ['excel', 'microsoft excel', 'ms excel'] },
  { key: 'powerpoint', label: 'PowerPoint', icon: 'notepad', aliases: ['powerpoint', 'ms powerpoint', 'microsoft powerpoint'] },
  { key: 'outlook', label: 'Outlook', icon: 'notepad', aliases: ['outlook', 'microsoft outlook'] },
  { key: 'onenote', label: 'OneNote', icon: 'notepad', aliases: ['onenote', 'one note'] },
  { key: 'spotify', label: 'Spotify', icon: 'apps', aliases: ['spotify'] },
  { key: 'discord', label: 'Discord', icon: 'apps', aliases: ['discord'] },
  { key: 'slack', label: 'Slack', icon: 'apps', aliases: ['slack'] },
  { key: 'zoom', label: 'Zoom', icon: 'apps', aliases: ['zoom'] },
  { key: 'teams', label: 'Microsoft Teams', icon: 'apps', aliases: ['teams', 'microsoft teams', 'ms teams'] },
  { key: 'skype', label: 'Skype', icon: 'apps', aliases: ['skype'] },
  { key: 'whatsapp', label: 'WhatsApp', icon: 'apps', aliases: ['whatsapp', 'whats app'] },
  { key: 'telegram', label: 'Telegram', icon: 'apps', aliases: ['telegram'] },
  { key: 'steam', label: 'Steam', icon: 'apps', aliases: ['steam'] },
  { key: 'epicgames', label: 'Epic Games', icon: 'apps', aliases: ['epic games', 'epic games launcher'] },
  { key: 'vlc', label: 'VLC Media Player', icon: 'apps', aliases: ['vlc', 'vlc media player'] },
  { key: 'obs', label: 'OBS Studio', icon: 'apps', aliases: ['obs', 'obs studio'] },
  { key: 'photoshop', label: 'Photoshop', icon: 'apps', aliases: ['photoshop'] },
  { key: 'illustrator', label: 'Illustrator', icon: 'apps', aliases: ['illustrator'] },
  { key: 'premiere', label: 'Premiere Pro', icon: 'apps', aliases: ['premiere', 'premiere pro'] },
  { key: 'notion', label: 'Notion', icon: 'apps', aliases: ['notion'] },
  { key: 'figma', label: 'Figma', icon: 'apps', aliases: ['figma'] },
  { key: 'postman', label: 'Postman', icon: 'apps', aliases: ['postman'] },
  { key: 'docker', label: 'Docker Desktop', icon: 'apps', aliases: ['docker', 'docker desktop'] },
  { key: '7zip', label: '7-Zip', icon: 'folder', aliases: ['7zip', '7-zip', 'winrar', 'zip tool'] },
  { key: 'adobereader', label: 'Adobe Reader', icon: 'notepad', aliases: ['adobe reader', 'acrobat reader', 'pdf reader'] },
  { key: 'itunes', label: 'iTunes', icon: 'apps', aliases: ['itunes'] },
  { key: 'xboxapp', label: 'Xbox App', icon: 'apps', aliases: ['xbox app', 'xbox'] },
  { key: 'camera', label: 'Camera', icon: 'apps', aliases: ['camera'] },
];

export const KNOWN_SITES: SiteDef[] = [
  { key: 'youtube', label: 'YouTube', url: 'https://youtube.com', icon: 'youtube', aliases: ['youtube', 'yt'] },
  { key: 'google', label: 'Google', url: 'https://google.com', icon: 'google', aliases: ['google', 'search'] },
  { key: 'gmail', label: 'Gmail', url: 'https://mail.google.com', icon: 'mail', aliases: ['gmail', 'email', 'mail'] },
  { key: 'github', label: 'GitHub', url: 'https://github.com', icon: 'github', aliases: ['github', 'git hub'] },
  { key: 'facebook', label: 'Facebook', url: 'https://facebook.com', icon: 'google', aliases: ['facebook', 'fb'] },
  { key: 'instagram', label: 'Instagram', url: 'https://instagram.com', icon: 'google', aliases: ['instagram', 'insta'] },
  { key: 'twitter', label: 'X / Twitter', url: 'https://x.com', icon: 'google', aliases: ['twitter', 'x.com'] },
  { key: 'linkedin', label: 'LinkedIn', url: 'https://linkedin.com', icon: 'google', aliases: ['linkedin'] },
  { key: 'reddit', label: 'Reddit', url: 'https://reddit.com', icon: 'google', aliases: ['reddit'] },
  { key: 'amazon', label: 'Amazon', url: 'https://amazon.com', icon: 'google', aliases: ['amazon'] },
  { key: 'netflix', label: 'Netflix', url: 'https://netflix.com', icon: 'google', aliases: ['netflix'] },
  { key: 'wikipedia', label: 'Wikipedia', url: 'https://wikipedia.org', icon: 'google', aliases: ['wikipedia', 'wiki'] },
  { key: 'chatgpt', label: 'ChatGPT', url: 'https://chat.openai.com', icon: 'google', aliases: ['chatgpt', 'chat gpt'] },
  { key: 'claude', label: 'Claude', url: 'https://claude.ai', icon: 'google', aliases: ['claude', 'claude ai'] },
  { key: 'maps', label: 'Google Maps', url: 'https://maps.google.com', icon: 'google', aliases: ['maps', 'google maps'] },
  { key: 'drive', label: 'Google Drive', url: 'https://drive.google.com', icon: 'google', aliases: ['drive', 'google drive'] },
  { key: 'translate', label: 'Google Translate', url: 'https://translate.google.com', icon: 'google', aliases: ['translate', 'google translate'] },
  { key: 'stackoverflow', label: 'Stack Overflow', url: 'https://stackoverflow.com', icon: 'google', aliases: ['stack overflow', 'stackoverflow'] },
  { key: 'twitch', label: 'Twitch', url: 'https://twitch.tv', icon: 'google', aliases: ['twitch'] },
  { key: 'spotifyweb', label: 'Spotify Web', url: 'https://open.spotify.com', icon: 'google', aliases: ['spotify web', 'open spotify web'] },
];

export const DANGEROUS_ACTIONS = ['shutdown', 'restart', 'lock', 'delete file', 'delete'];

/** Phrases the decision engine recognizes as "known" for fallback distance-matching */
export const ALL_KNOWN_PHRASES: string[] = [
  ...KNOWN_APPS.flatMap((a) => a.aliases.map((alias) => `open ${alias}`)),
  ...KNOWN_SITES.flatMap((s) => s.aliases.map((alias) => `open ${alias}`)),
  'what time is it',
  'what is the time',
  'what is the date',
  "what is today's date",
  'shutdown pc',
  'shutdown',
  'restart pc',
  'restart',
  'lock pc',
  'lock screen',
  'open it',
  'do it again',
  'again',
];

/** Very rough check for "this looks like a domain / URL" so bare "open X.com" always resolves */
export function looksLikeDomain(text: string): boolean {
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i.test(text.trim());
}
