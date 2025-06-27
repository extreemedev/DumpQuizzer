const {app, BrowserWindow} = require('electron')

const createWindow = () => {
  const win = new BrowserWindow({
    width: 1300,
    height: 650,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
      sandbox: false // Disabilita la sandbox per abilitare l'esecuzione degli script
    }
  })

  win.loadFile('index.html')
  win.webContents.openDevTools()
}

app.whenReady().then(createWindow)