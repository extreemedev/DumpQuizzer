const { dialog, ipcMain } = require('electron');
const { copyFileSync, existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync, appendFileSync } = require('fs');
const { join, basename } = require('path');
const fetch = require('node-fetch');
const pdfParse = require('pdf-parse');
const { spawn } = require('child_process');

const quizDir = join(__dirname, '../quiz');
const logsDir = join(__dirname, '../logs');
const ollamaEndpoint = 'http://localhost:11434/api/generate'; // Assicurati che Ollama sia avviato

// Imposta qui il limite massimo di caratteri per il prompt (adatta in base al modello Ollama)
let MAX_PROMPT_CHARS = 8000; // Esempio: 8000 per modelli 8k token, 4000 per modelli 4k token

function getQuizPrompt(pdfText) {
  return `
Estrarre domande a scelta multipla dal seguente testo PDF.
Restituisci solo un oggetto JSON con questo formato:

{
  "title": "Titolo del quiz",
  "questions": [
    {
      "number": 1,
      "question": "Testo della domanda",
      "options": {
        "A": "Opzione A",
        "B": "Opzione B",
        "C": "Opzione C",
        "D": "Opzione D"
      },
      "correctAnswer": "A"
    }
    // ...altre domande...
  ]
}

Testo PDF:
${pdfText}
`;
}

function getOllamaLogFile() {
  const now = new Date();
  const pad = n => n.toString().padStart(2, '0');
  const y = now.getFullYear();
  const m = pad(now.getMonth() + 1);
  const d = pad(now.getDate());
  const h = pad(now.getHours());
  return join(logsDir, `ollama_${y}_${m}_${d}_${h}00.log`);
}

function logOllama(msg) {
  const logFile = getOllamaLogFile();
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  appendFileSync(logFile, line, 'utf-8');
  console.log(msg);
}

async function getOllamaContextLength(model, endpoint) {
  try {
    const res = await fetch(`${endpoint}/api/show`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model })
    });
    if (!res.ok) return 4096; // fallback
    const data = await res.json();
    return data.details && data.details.context_length ? data.details.context_length : 4096;
  } catch {
    return 4096;
  }
}

function setupHandlers(win) {
  // Import PDF handler
  ipcMain.handle('import-pdf', async () => {
    try {
      // Carica config
      const config = JSON.parse(readFileSync(join(__dirname, '../config/app-config.json'), 'utf-8'));
      const model = config.llm.model || 'mistral:7b';
      const endpoint = config.llm.endpoint || 'http://localhost:11434';
      // Ottieni context_length dal modello
      const contextLength = await getOllamaContextLength(model, endpoint);
      // Stima: 1 token ~ 4 caratteri (approssimativo)
      const maxChars = Math.floor(contextLength * 4);
      logOllama(`[Ollama] context_length for model ${model}: ${contextLength} tokens (~${maxChars} chars)`);

      const { canceled, filePaths } = await dialog.showOpenDialog(win, {
        title: 'Seleziona un PDF',
        filters: [{ name: 'PDF', extensions: ['pdf'] }],
        properties: ['openFile']
      });
      if (canceled || !filePaths || !filePaths[0]) return { canceled: true };
      const pdfPath = filePaths[0];

      // Estrai testo dal PDF
      const pdfBuffer = readFileSync(pdfPath);
      const pdfData = await pdfParse(pdfBuffer);
      // Limite chunk: 4000 token ~ 12000 caratteri
      const TOKEN_LIMIT = 4000;
      const CHAR_LIMIT = TOKEN_LIMIT * 3;
      let pdfText = pdfData.text;
      if (pdfText.length > CHAR_LIMIT) {
        logOllama(`[Ollama] PDF text too long (${pdfText.length} chars), truncating to ${CHAR_LIMIT} chars (~${TOKEN_LIMIT} tokens) for prompt.`);
        pdfText = pdfText.slice(0, CHAR_LIMIT);
      }

      // Salva il testo parsato del PDF per debug (prima di inviarlo all'LLM)
      const parsedTxtFileName = require('path').basename(pdfPath, '.pdf') + '.parsed.txt';
      const parsedTxtFilePath = require('path').join(quizDir, parsedTxtFileName);
      require('fs').writeFileSync(parsedTxtFilePath, pdfText, 'utf-8');

      // Prompt a Ollama
      const prompt = getQuizPrompt(pdfText);
      logOllama(`[Ollama] Chiamata API /api/generate con modello ${model}`);
      const ollamaRes = await fetch(`${endpoint}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt,
          stream: false
        })
      });
      logOllama(`[Ollama] Status: ${ollamaRes.status} ${ollamaRes.statusText}`);
      const ollamaText = await ollamaRes.text();
      logOllama(`[Ollama] Response body: ${ollamaText}`);
      let quizJson;
      try {
        // Cerca il primo oggetto JSON valido nella risposta
        const match = ollamaText.match(/\{[\s\S]*\}/);
        quizJson = JSON.parse(match[0]);
      } catch (e) {
        logOllama(`[Ollama] Errore parsing JSON: ${e}\nBody: ${ollamaText}`);
        // Salva la risposta grezza per debug
        const rawFileName = require('path').basename(pdfPath, '.pdf') + '.raw.txt';
        const rawFilePath = require('path').join(quizDir, rawFileName);
        require('fs').writeFileSync(rawFilePath, ollamaText, 'utf-8');
        return { canceled: false, error: 'Errore parsing JSON dal LLM. Risposta grezza salvata in ' + rawFileName };
      }

      // Salva il file quiz
      const quizFileName = require('path').basename(pdfPath, '.pdf') + '.json';
      const quizFilePath = require('path').join(quizDir, quizFileName);
      require('fs').writeFileSync(quizFilePath, JSON.stringify(quizJson, null, 2), 'utf-8');

      // Logga anche la risposta di successo
      logOllama(`[Ollama] Quiz JSON salvato in ${quizFileName}`);
      logOllama(`[Ollama] Risposta JSON: ${JSON.stringify(quizJson, null, 2)}`);

      return { canceled: false, pdfPath: pdfPath, quizFile: quizFileName };
    } catch (error) {
      logOllama(`[Ollama] Errore: ${error}`);
      return { canceled: false, error: error.message };
    }
  });

  // List quizzes handler
  ipcMain.handle('list-quizzes', async () => {
    try {
      if (!existsSync(quizDir)) return [];
      const files = readdirSync(quizDir);
      return files.filter(f => f.toLowerCase().endsWith('.json'));
    } catch (error) {
      return [];
    }
  });

  // Load quiz.json content
  ipcMain.handle('load-quiz', async (event, filename) => {
    try {
      const filePath = join(quizDir, filename);
      if (!existsSync(filePath)) return null;
      const content = readFileSync(filePath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      return null;
    }
  });

  // Ollama health check
  ipcMain.handle('ollama-health', async () => {
    try {
      const res = await fetch('http://localhost:11434/api/tags');
      const body = await res.text();
      console.log('[Ollama] Healthcheck status:', res.status, res.statusText, '\nBody:', body);
      if (res.ok) return { status: 'ready' };
      return { status: 'error' };
    } catch (e) {
      console.error('[Ollama] Healthcheck error:', e);
      return { status: 'error' };
    }
  });
}

// Avvia Ollama come processo figlio e redirigi STDOUT/STDERR nei log
function startOllamaWithLogging() {
  // Modifica il path e args secondo la tua installazione
  const ollamaPath = join(__dirname, '../ollama/ollama-win.exe');
  const ollamaArgs = ['serve'];
  const ollamaProc = spawn(ollamaPath, ollamaArgs, { shell: true });

  ollamaProc.stdout.on('data', (data) => {
    logOllama(`[Ollama STDOUT]: ${data.toString().trim()}`);
  });
  ollamaProc.stderr.on('data', (data) => {
    logOllama(`[Ollama STDERR]: ${data.toString().trim()}`);
  });
  ollamaProc.on('close', (code) => {
    logOllama(`[Ollama] Processo terminato con codice ${code}`);
  });
}

// Avvia Ollama come processo figlio e redirigi STDOUT/STDERR nei log
startOllamaWithLogging();

module.exports = { setupHandlers };
