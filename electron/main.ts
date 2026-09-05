import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { fileURLToPath } from 'url';
import * as fs from 'fs/promises';
import * as pty from 'node-pty';
import * as os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SANDBOX_DIR = path.join(os.homedir(), 'SecureOS', 'sandbox');
const isDev = !app.isPackaged;

let mainWindow: BrowserWindow | null = null;

async function ensureSandbox() {
  try {
    await fs.mkdir(SANDBOX_DIR, { recursive: true });
  } catch (err) {
    console.error('Failed to create sandbox directory', err);
  }
}

function resolveSandboxPath(vfsPath: string) {
  // Normalize and prevent directory traversal
  const normalizedPath = path.normalize(vfsPath).replace(/^(\.\.[\/\\])+/, '');
  const absolutePath = path.join(SANDBOX_DIR, normalizedPath);
  if (!absolutePath.startsWith(SANDBOX_DIR)) {
    throw new Error('Access denied: Path outside sandbox');
  }
  return absolutePath;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(async () => {
  await ensureSandbox();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handlers

const appCapabilities = new Map<string, string[]>();

ipcMain.handle('system:registerApp', (event, appId: string, capabilities: string[]) => {
  appCapabilities.set(appId, capabilities);
});

function enforceCapability(appId: string, requiredCapability: string) {
  const caps = appCapabilities.get(appId) || [];
  if (!caps.includes(requiredCapability)) {
    throw new Error(`Kernel capability ${requiredCapability} denied for ${appId}`);
  }
}

// File System
ipcMain.handle('fs:readFile', async (event, appId: string, filePath: string) => {
  enforceCapability(appId, 'fs:read');
  const realPath = resolveSandboxPath(filePath);
  const data = await fs.readFile(realPath, 'utf-8');
  return data;
});

ipcMain.handle('fs:writeFile', async (event, appId: string, filePath: string, content: string) => {
  enforceCapability(appId, 'fs:write');
  const realPath = resolveSandboxPath(filePath);
  await fs.writeFile(realPath, content, 'utf-8');
  return true;
});

ipcMain.handle('fs:mkdir', async (event, appId: string, dirPath: string) => {
  enforceCapability(appId, 'fs:write');
  const realPath = resolveSandboxPath(dirPath);
  await fs.mkdir(realPath, { recursive: true });
  return true;
});

ipcMain.handle('fs:ls', async (event, appId: string, dirPath: string) => {
  enforceCapability(appId, 'fs:read');
  const realPath = resolveSandboxPath(dirPath);
  const files = await fs.readdir(realPath, { withFileTypes: true });
  return files.map(file => ({
    name: file.name,
    type: file.isDirectory() ? 'directory' : 'file',
    path: path.join(dirPath, file.name)
  }));
});

ipcMain.handle('fs:rm', async (event, appId: string, filePath: string) => {
  enforceCapability(appId, 'fs:write');
  const realPath = resolveSandboxPath(filePath);
  await fs.rm(realPath, { recursive: true, force: true });
  return true;
});

// Terminal (node-pty)
const terminals = new Map<string, pty.IPty>();

ipcMain.handle('pty:spawn', (event, id) => {
  if (terminals.has(id)) return;
  const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';
  const ptyProcess = pty.spawn(shell, [], {
    name: 'xterm-color',
    cols: 80,
    rows: 24,
    cwd: SANDBOX_DIR,
    env: process.env as any
  });

  ptyProcess.onData((data) => {
    if (mainWindow) {
      mainWindow.webContents.send(`pty:data:${id}`, data);
    }
  });

  terminals.set(id, ptyProcess);
});

ipcMain.handle('pty:write', (event, id, data) => {
  const ptyProcess = terminals.get(id);
  if (ptyProcess) {
    ptyProcess.write(data);
  }
});

ipcMain.handle('pty:resize', (event, id, cols, rows) => {
  const ptyProcess = terminals.get(id);
  if (ptyProcess) {
    ptyProcess.resize(cols, rows);
  }
});

ipcMain.handle('pty:kill', (event, id) => {
  const ptyProcess = terminals.get(id);
  if (ptyProcess) {
    ptyProcess.kill();
    terminals.delete(id);
  }
});
