const { app, BrowserWindow } = require("electron");
const path = require("path");
const { spawn } = require('child_process');
const os = require('os');
const fs = require('fs');
const http = require('http');

console.log("Preload path:", path.join(__dirname, "preload.js"));

const createWindow = () => {
  const win = new BrowserWindow({
    width: 1300,
    height: 650,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      // log in console
      devTools: true,
      nodeIntegration: true,
      contextIsolation: true
    }
  });

  win.loadFile("index.html");
  win.webContents.openDevTools();

  require("./scripts/ipc-handlers").setupHandlers(win);
};

let ollamaProcess = null;

function startOllama() {
  let binPath;
  if (os.platform() === 'win32') {
    binPath = path.join(__dirname, 'ollama-bin', 'ollama-win.exe');
  } else if (os.platform() === 'darwin') {
    binPath = path.join(__dirname, 'ollama-bin', 'ollama-mac');
  } else {
    binPath = path.join(__dirname, 'ollama-bin', 'ollama-linux');
  }
  if (!fs.existsSync(binPath)) {
    console.error('Ollama binary not found:', binPath);
    return;
  }
  ollamaProcess = spawn(binPath, [], {
    detached: true,
    stdio: 'ignore'
  });
  ollamaProcess.unref();
  console.log('Ollama started:', binPath);
}

function downloadOllamaModel(modelName = 'mistral:7b') {
  const data = JSON.stringify({ name: modelName });
  const options = {
    hostname: 'localhost',
    port: 11434,
    path: '/api/pull',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': data.length
    }
  };
  const req = http.request(options, res => {
    let output = '';
    res.on('data', chunk => {
      output += chunk;
      process.stdout.write('.'); // progress indicator
    });
    res.on('end', () => {
      console.log(`\nModello ${modelName} scaricato o già presente.`);
    });
  });
  req.on('error', error => {
    console.error('Errore download modello Ollama:', error.message);
  });
  req.write(data);
  req.end();
}

app.whenReady().then(() => {
  startOllama();
  // Attendi qualche secondo che Ollama sia pronto
  setTimeout(() => {
    downloadOllamaModel('mistral:7b');
    createWindow();
  }, 4000); // 4 secondi di attesa, regola se serve
});
