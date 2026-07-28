const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { exec, execFile } = require('child_process');

const isDev = process.env.NODE_ENV === 'development';
const MEMORY_PATH = path.join(app.getPath('userData'), 'memory.json');

// ---------- Memory persistence ----------
const DEFAULT_MEMORY = {
  last_command: '',
  last_app: '',
  custom_commands: {},
  logs: [],
};

function ensureMemoryFile() {
  try {
    if (!fs.existsSync(MEMORY_PATH)) {
      fs.writeFileSync(MEMORY_PATH, JSON.stringify(DEFAULT_MEMORY, null, 2));
    }
  } catch (err) {
    console.error('Failed to create memory file:', err);
  }
}

function readMemory() {
  ensureMemoryFile();
  try {
    const raw = fs.readFileSync(MEMORY_PATH, 'utf-8');
    return { ...DEFAULT_MEMORY, ...JSON.parse(raw) };
  } catch (err) {
    console.error('Failed to read memory:', err);
    return { ...DEFAULT_MEMORY };
  }
}

function writeMemory(data) {
  try {
    fs.writeFileSync(MEMORY_PATH, JSON.stringify(data, null, 2));
    return true;
  } catch (err) {
    console.error('Failed to write memory:', err);
    return false;
  }
}

// ---------- App / OS action helpers ----------
const APP_COMMANDS = {
  win32: {
    chrome: 'start chrome',
    firefox: 'start firefox',
    edge: 'start msedge',
    'vs code': 'code',
    vscode: 'code',
    notepad: 'notepad',
    explorer: 'explorer',
    calculator: 'calc',
    cmd: 'start cmd',
    powershell: 'start powershell',
    terminal: 'start wt',
    taskmanager: 'taskmgr',
    controlpanel: 'control',
    settingsapp: 'start ms-settings:',
    paint: 'mspaint',
    word: 'start winword',
    excel: 'start excel',
    powerpoint: 'start powerpnt',
    outlook: 'start outlook',
    onenote: 'start onenote',
    spotify: 'start spotify:',
    discord: 'start discord:',
    slack: 'start slack:',
    zoom: 'start zoommtg:',
    teams: 'start msteams:',
    skype: 'start skype:',
    whatsapp: 'start whatsapp:',
    telegram: 'start tg:',
    steam: 'start steam:',
    epicgames: 'start com.epicgames.launcher:',
    vlc: 'start vlc',
    obs: 'start obs64',
    photoshop: 'start photoshop',
    illustrator: 'start illustrator',
    premiere: 'start "" "Adobe Premiere Pro"',
    notion: 'start notion:',
    figma: 'start figma:',
    postman: 'start postman',
    docker: 'start "Docker Desktop"',
    '7zip': 'start "" "7-Zip"',
    adobereader: 'start acrord32',
    itunes: 'start itunes',
    xboxapp: 'start xbox:',
    camera: 'start microsoft.windows.camera:',
  },
  darwin: {
    chrome: 'open -a "Google Chrome"',
    firefox: 'open -a "Firefox"',
    edge: 'open -a "Microsoft Edge"',
    'vs code': 'open -a "Visual Studio Code"',
    vscode: 'open -a "Visual Studio Code"',
    notepad: 'open -a "TextEdit"',
    explorer: 'open .',
    calculator: 'open -a "Calculator"',
    cmd: 'open -a "Terminal"',
    powershell: 'open -a "Terminal"',
    terminal: 'open -a "Terminal"',
    taskmanager: 'open -a "Activity Monitor"',
    controlpanel: 'open -a "System Preferences"',
    settingsapp: 'open -a "System Preferences"',
    paint: 'open -a "Preview"',
    word: 'open -a "Microsoft Word"',
    excel: 'open -a "Microsoft Excel"',
    powerpoint: 'open -a "Microsoft PowerPoint"',
    outlook: 'open -a "Microsoft Outlook"',
    onenote: 'open -a "Microsoft OneNote"',
    spotify: 'open -a "Spotify"',
    discord: 'open -a "Discord"',
    slack: 'open -a "Slack"',
    zoom: 'open -a "zoom.us"',
    teams: 'open -a "Microsoft Teams"',
    skype: 'open -a "Skype"',
    whatsapp: 'open -a "WhatsApp"',
    telegram: 'open -a "Telegram"',
    steam: 'open -a "Steam"',
    epicgames: 'open -a "Epic Games Launcher"',
    vlc: 'open -a "VLC"',
    obs: 'open -a "OBS"',
    photoshop: 'open -a "Adobe Photoshop"',
    illustrator: 'open -a "Adobe Illustrator"',
    premiere: 'open -a "Adobe Premiere Pro"',
    notion: 'open -a "Notion"',
    figma: 'open -a "Figma"',
    postman: 'open -a "Postman"',
    docker: 'open -a "Docker"',
    '7zip': 'open -a "The Unarchiver"',
    adobereader: 'open -a "Adobe Acrobat Reader DC"',
    itunes: 'open -a "Music"',
    xboxapp: 'open -a "Xbox"',
    camera: 'open -a "Photo Booth"',
  },
  linux: {
    chrome: 'google-chrome',
    firefox: 'firefox',
    edge: 'microsoft-edge',
    'vs code': 'code',
    vscode: 'code',
    notepad: 'gedit',
    explorer: 'nautilus .',
    calculator: 'gnome-calculator',
    cmd: 'x-terminal-emulator',
    powershell: 'pwsh',
    terminal: 'x-terminal-emulator',
    taskmanager: 'gnome-system-monitor',
    controlpanel: 'gnome-control-center',
    settingsapp: 'gnome-control-center',
    paint: 'gimp',
    word: 'libreoffice --writer',
    excel: 'libreoffice --calc',
    powerpoint: 'libreoffice --impress',
    outlook: 'thunderbird',
    onenote: 'gnome-notes',
    spotify: 'spotify',
    discord: 'discord',
    slack: 'slack',
    zoom: 'zoom',
    teams: 'teams',
    skype: 'skype',
    whatsapp: 'whatsapp-for-linux',
    telegram: 'telegram-desktop',
    steam: 'steam',
    epicgames: 'legendary',
    vlc: 'vlc',
    obs: 'obs',
    photoshop: 'gimp',
    illustrator: 'inkscape',
    premiere: 'kdenlive',
    notion: 'notion-app',
    figma: 'figma-linux',
    postman: 'postman',
    docker: 'docker desktop',
    '7zip': 'file-roller',
    adobereader: 'xreader',
    itunes: 'rhythmbox',
    xboxapp: 'steam',
    camera: 'cheese',
  },
};

/** Best-effort generic launch for anything not in the curated table above.
 * Tries the raw name as a system command / registered app; on failure the
 * renderer will offer to let the user teach the exact path (learning system). */
function genericLaunch(appKey) {
  return new Promise((resolve) => {
    const platform = process.platform;
    const safeName = appKey.replace(/"/g, '');
    const command =
      platform === 'win32'
        ? `start "" "${safeName}"`
        : platform === 'darwin'
        ? `open -a "${safeName}"`
        : safeName.toLowerCase().replace(/\s+/g, '-');

    exec(command, (error) => {
      if (error) {
        resolve({
          success: false,
          message: `I couldn't find "${appKey}" automatically. What's the exact command or file path to launch it?`,
        });
      } else {
        resolve({ success: true, message: `${appKey} opened successfully.` });
      }
    });
  });
}

function openApp(appKey) {
  const platform = process.platform;
  const table = APP_COMMANDS[platform] || APP_COMMANDS.linux;
  const command = table[appKey.toLowerCase()];
  if (!command) {
    return genericLaunch(appKey);
  }
  return new Promise((resolve) => {
    exec(command, (error) => {
      if (error) {
        resolve({ success: false, message: `Failed to open ${appKey}: ${error.message}` });
      } else {
        resolve({ success: true, message: `${appKey} opened successfully.` });
      }
    });
  });
}

/** Runs a user-taught command or path verbatim (used by the learning system) */
function openCustom(target) {
  return new Promise((resolve) => {
    const trimmed = target.trim();
    const isUrl = /^https?:\/\//i.test(trimmed) || /^[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i.test(trimmed);
    if (isUrl) {
      const url = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
      shell.openExternal(url).then(
        () => resolve({ success: true, message: 'Opened successfully.' }),
        (err) => resolve({ success: false, message: `Failed to open: ${err.message}` })
      );
      return;
    }
    const platform = process.platform;
    const command = platform === 'win32' ? `start "" "${trimmed}"` : trimmed;
    exec(command, (error) => {
      if (error) {
        resolve({ success: false, message: `Failed to run "${trimmed}": ${error.message}` });
      } else {
        resolve({ success: true, message: 'Done.' });
      }
    });
  });
}

function openUrl(url) {
  return shell.openExternal(url).then(
    () => ({ success: true, message: 'Website opened successfully.' }),
    (err) => ({ success: false, message: `Failed to open URL: ${err.message}` })
  );
}

function systemAction(action) {
  const platform = process.platform;
  return new Promise((resolve) => {
    let command = null;
    if (action === 'shutdown') {
      command =
        platform === 'win32' ? 'shutdown /s /t 5' : platform === 'darwin' ? 'osascript -e \'tell app "System Events" to shut down\'' : 'shutdown -h now';
    } else if (action === 'restart') {
      command =
        platform === 'win32' ? 'shutdown /r /t 5' : platform === 'darwin' ? 'osascript -e \'tell app "System Events" to restart\'' : 'shutdown -r now';
    } else if (action === 'lock') {
      command =
        platform === 'win32' ? 'rundll32.exe user32.dll,LockWorkStation' : platform === 'darwin' ? 'pmset displaysleepnow' : 'loginctl lock-session';
    }
    if (!command) {
      resolve({ success: false, message: `Unknown system action: ${action}` });
      return;
    }
    exec(command, (error) => {
      if (error) {
        resolve({ success: false, message: `Failed to ${action}: ${error.message}` });
      } else {
        resolve({ success: true, message: `${action} initiated.` });
      }
    });
  });
}

function createFile(filePath, content = '') {
  try {
    fs.writeFileSync(filePath, content);
    return { success: true, message: `File created at ${filePath}` };
  } catch (err) {
    return { success: false, message: `Failed to create file: ${err.message}` };
  }
}

function openFile(filePath) {
  return shell.openPath(filePath).then((result) => {
    if (result) {
      return { success: false, message: `Failed to open file: ${result}` };
    }
    return { success: true, message: `Opened ${filePath}` };
  });
}

// ---------- IPC registration ----------
function registerIpcHandlers() {
  ipcMain.handle('memory:get', () => readMemory());
  ipcMain.handle('memory:set', (_event, data) => writeMemory(data));

  ipcMain.handle('action:open-app', async (_event, appKey) => openApp(appKey));
  ipcMain.handle('action:open-url', async (_event, url) => openUrl(url));
  ipcMain.handle('action:open-custom', async (_event, target) => openCustom(target));
  ipcMain.handle('action:system', async (_event, action) => systemAction(action));
  ipcMain.handle('action:create-file', async (_event, { filePath, content }) => createFile(filePath, content));
  ipcMain.handle('action:open-file', async (_event, filePath) => openFile(filePath));

  ipcMain.handle('system:stats', () => {
    const cpus = os.cpus();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMemPct = Math.round(((totalMem - freeMem) / totalMem) * 100);
    return {
      platform: os.platform(),
      cpuModel: cpus[0]?.model || 'Unknown',
      cpuCount: cpus.length,
      memUsedPercent: usedMemPct,
      uptime: os.uptime(),
    };
  });

  ipcMain.handle('system:datetime', () => {
    const now = new Date();
    return {
      time: now.toLocaleTimeString(),
      date: now.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
      iso: now.toISOString(),
    };
  });
}

// ---------- Window ----------
function createWindow() {
  const win = new BrowserWindow({
    width: 1536,
    height: 1024,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: '#0a0e17',
    titleBarStyle: 'hidden',
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    win.loadURL('http://localhost:3000');
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(path.join(__dirname, '..', 'out', 'index.html'));
  }

  ipcMain.handle('window:minimize', () => win.minimize());
  ipcMain.handle('window:maximize', () => (win.isMaximized() ? win.unmaximize() : win.maximize()));
  ipcMain.handle('window:close', () => win.close());
}

app.whenReady().then(() => {
  ensureMemoryFile();
  registerIpcHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
