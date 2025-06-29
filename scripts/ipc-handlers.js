const { dialog, ipcMain } = require('electron');
const { copyFileSync, existsSync, readdirSync, readFileSync, writeFileSync } = require('fs');
const { join, basename } = require('path');
const fetch = require('node-fetch');
const pdfParse = require('pdf-parse');

const quizDir = join(__dirname, '../quiz');
const ollamaEndpoint = 'http://localhost:11434/api/generate'; // Assicurati che Ollama sia avviato

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

function setupHandlers(win) {
  // Import PDF handler
  ipcMain.handle('import-pdf', async () => {
    try {
      const { canceled, filePaths } = await dialog.showOpenDialog(win, {
        title: 'Seleziona un PDF',
        filters: [{ name: 'PDF', extensions: ['pdf'] }],
        properties: ['openFile']
      });
      if (canceled || !filePaths || !filePaths[0]) return { canceled: true };
      const pdfPath = filePaths[0];

      // Estrai testo dal PDF
      const dataBuffer = require('fs').readFileSync(pdfPath);
      const pdfData = await pdfParse(dataBuffer);
      const pdfText = pdfData.text.slice(0, 12000); // Limita lunghezza prompt se necessario

      // Prompt a Ollama
      const prompt = getQuizPrompt(pdfText);
      const ollamaRes = await fetch(ollamaEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama3.1:8b', // o il modello che preferisci
          prompt,
          stream: false
        })
      });
      const ollamaJson = await ollamaRes.json();
      let quizJson;
      try {
        // Cerca il primo oggetto JSON valido nella risposta
        const match = ollamaJson.response.match(/\{[\s\S]*\}/);
        quizJson = JSON.parse(match[0]);
      } catch (e) {
        return { canceled: false, error: 'Errore parsing JSON dal LLM' };
      }

      // Salva il file quiz
      const quizFileName = require('path').basename(pdfPath, '.pdf') + '.json';
      const quizFilePath = require('path').join(quizDir, quizFileName);
      require('fs').writeFileSync(quizFilePath, JSON.stringify(quizJson, null, 2), 'utf-8');

      return { canceled: false, pdfPath: pdfPath, quizFile: quizFileName };
    } catch (error) {
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
}

module.exports = { setupHandlers };
