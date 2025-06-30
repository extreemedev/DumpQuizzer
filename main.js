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
    binPath = path.join(__dirname, 'ollama', 'ollama-win.exe');
  } else if (os.platform() === 'darwin') {
    binPath = path.join(__dirname, 'ollama', 'ollama-mac');
  } else {
    binPath = path.join(__dirname, 'ollama', 'ollama-linux');
  }
  if (!fs.existsSync(binPath)) {
    console.error('Ollama binary not found:', binPath);
    return;
  }


  //ollamaProcess = spawn(binPath, ['run', 'mistral:7b'], {
  ollamaProcess = spawn(binPath, ['serve'], {
    detached: true,
    //stdio: 'inherit'
    stdio: ['ignore', 'pipe', 'pipe']
  });
  //ollamaProcess.unref();
  console.log('Ollama started:', binPath);

  if (ollamaProcess.stdout) {
    ollamaProcess.stdout.on('data', (data) => {
      const msg = `[Ollama STDOUT]: ${data}`;
      console.log(msg);
      logOllamaToFile(msg);
    });
  }
  if (ollamaProcess.stderr) {
    ollamaProcess.stderr.on('data', (data) => {
      const msg = `[Ollama STDERR]: ${data}`;
      console.error(msg);
      logOllamaToFile(msg);
    });
  }
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

// Funzione per loggare anche su file
function logOllamaToFile(msg) {
  const now = new Date();
  const pad = n => n.toString().padStart(2, '0');
  const y = now.getFullYear();
  const m = pad(now.getMonth() + 1);
  const d = pad(now.getDate());
  const h = pad(now.getHours());
  const logsDir = path.join(__dirname, 'logs');
  if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir);
  const logFile = path.join(logsDir, `ollama_${y}_${m}_${d}_${h}00.log`);
  const line = `[${now.toISOString()}] ${msg}\n`;
  fs.appendFileSync(logFile, line, 'utf-8');
}

app.whenReady().then(() => {
  startOllama();
  // Attendi qualche secondo che Ollama sia pronto
  setTimeout(() => {
    downloadOllamaModel('mistral:7b');
    createWindow();
  }, 4000); // 4 secondi di attesa, regola se serve
});
