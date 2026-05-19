const { app, BrowserWindow, Tray, Menu } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow = null;
let tray = null;
let backendProcess = null;
let frontendProcess = null;

function startBackend() {
  console.log("Starting Cherry Backend (FastAPI)...");
  
  const pythonPath = path.join(__dirname, 'backend', 'venv', 'Scripts', 'python.exe');
  
  // Spawn backend inside the venv
  backendProcess = spawn(pythonPath, [
    '-m', 'uvicorn', 
    'main:app', 
    '--host', '127.0.0.1', 
    '--port', '8000'
  ], {
    cwd: path.join(__dirname, 'backend')
  });

  backendProcess.stdout.on('data', (data) => {
    console.log(`[Backend Log]: ${data.toString().trim()}`);
  });

  backendProcess.stderr.on('data', (data) => {
    console.error(`[Backend Err]: ${data.toString().trim()}`);
  });

  backendProcess.on('close', (code) => {
    console.log(`Backend process exited with code ${code}`);
  });
}

function startFrontend() {
  console.log("Starting Cherry Frontend (Next.js)...");
  
  // Spawn Next.js server via npm with shell enabled
  frontendProcess = spawn('npm', ['run', 'dev'], {
    cwd: path.join(__dirname, 'frontend'),
    shell: true
  });

  frontendProcess.stdout.on('data', (data) => {
    console.log(`[Frontend Log]: ${data.toString().trim()}`);
  });

  frontendProcess.stderr.on('data', (data) => {
    console.error(`[Frontend Err]: ${data.toString().trim()}`);
  });

  frontendProcess.on('close', (code) => {
    console.log(`Frontend process exited with code ${code}`);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1300,
    height: 850,
    title: "Cherry AI",
    icon: path.join(__dirname, 'frontend', 'src', 'app', 'favicon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    },
    backgroundColor: '#0f0f11',
    show: true
  });

  // Load local Next.js client
  mainWindow.loadURL('http://localhost:3000');

  // If server is not ready yet, retry loading every 1s
  mainWindow.webContents.on('did-fail-load', () => {
    console.log("Next.js server is not ready yet. Retrying in 1s...");
    setTimeout(() => {
      if (mainWindow) {
        mainWindow.loadURL('http://localhost:3000');
      }
    }, 1000);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createTray() {
  const iconPath = path.join(__dirname, 'frontend', 'src', 'app', 'favicon.ico');
  tray = new Tray(iconPath);
  
  const contextMenu = Menu.buildFromTemplate([
    { 
      label: 'Open Cherry Assistant', 
      click: () => { 
        if (mainWindow) {
          mainWindow.show();
        } else {
          createWindow();
        }
      } 
    },
    { 
      label: 'Hide Workspace', 
      click: () => { 
        if (mainWindow) mainWindow.hide(); 
      } 
    },
    { type: 'separator' },
    { 
      label: 'Shut Down Assistant', 
      click: () => { 
        app.quit(); 
      } 
    }
  ]);

  tray.setToolTip('Cherry AI Assistant');
  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
      }
    } else {
      createWindow();
    }
  });
}

app.whenReady().then(() => {
  startBackend();
  startFrontend();
  
  // Give servers a few seconds to boot up before showing Electron client
  setTimeout(() => {
    createWindow();
    createTray();
  }, 4000);
});

app.on('window-all-closed', () => {
  // Keep app active in system tray on Windows, unless explicitly closed via menu
  if (process.platform === 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

app.on('will-quit', () => {
  console.log("Shutting down development servers...");
  
  if (backendProcess && backendProcess.pid) {
    spawn('taskkill', ['/pid', backendProcess.pid, '/f', '/t']);
  }
  if (frontendProcess && frontendProcess.pid) {
    spawn('taskkill', ['/pid', frontendProcess.pid, '/f', '/t']);
  }
});
