const { app, BrowserWindow } = require('electron');
const { spawn } = require('child_process');
const net = require('net');
const path = require('path');

let mainWindow;
let serverProcess;

function getOpenPort() {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.listen(0, () => {
      const port = srv.address().port;
      srv.close(() => resolve(port));
    });
  });
}

async function createWindow() {
  const port = await getOpenPort();
  const isDev = !app.isPackaged;

  const serverPath = isDev 
    ? 'dev:server' 
    : path.join(__dirname, '../packages/server/src/index.ts');

  if (isDev) {
    const pnpmCommand = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
    serverProcess = spawn(pnpmCommand, ['run', 'dev:server'], {
      env: { ...process.env, PORT: port },
      stdio: 'inherit'
    });
  } else {
    // Production uses the bundled node execution
    serverProcess = spawn(process.execPath, [serverPath], {
      env: { ...process.env, PORT: port },
      stdio: 'inherit'
    });
  }

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    titleBarStyle: 'hidden',
    title: 'MusicBridge',
    backgroundColor: '#09090b',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  if (isDev) {
    mainWindow.loadURL(`http://localhost:5173?serverPort=${port}`);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../packages/client/dist/index.html'), {
      query: { serverPort: port.toString() }
    });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (serverProcess) serverProcess.kill();
});