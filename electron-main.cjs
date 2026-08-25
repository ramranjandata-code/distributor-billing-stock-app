const { app, BrowserWindow } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 768,
    minWidth: 1024,
    minHeight: 600,
    title: "DistroPulse - Distributor Stock & Billing ERP",
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'dist', 'favicon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false
    }
  });

  // Robust local file loading with multiple path resolution
  const fs = require('fs');
  const possiblePaths = [
    path.join(__dirname, 'dist', 'index.html'),
    path.join(__dirname, 'index.html'),
    path.join(process.resourcesPath, 'app', 'dist', 'index.html'),
    path.join(process.resourcesPath, 'app', 'index.html')
  ];
  const targetPath = possiblePaths.find(p => fs.existsSync(p));

  if (targetPath) {
    console.log('Loading local production build:', targetPath);
    mainWindow.loadFile(targetPath);
  } else {
    console.log('Local build not found, loading fallback online URL');
    mainWindow.loadURL('https://ramranjandata-code.github.io/distributor-billing-stock-app/');
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
