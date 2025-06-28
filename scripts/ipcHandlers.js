const { dialog, ipcMain } = require("electron");
const path = require("path");
const { convertPdfToQuiz } = require("./llmConverter");
const fs = require("fs");

function setupHandlers(win) {
  ipcMain.handle("import-pdf", async () => {
    const result = await dialog.showOpenDialog(win, {
      filters: [{ name: "PDF", extensions: ["pdf"] }],
      properties: ["openFile"]
    });

    if (result.canceled || !result.filePaths[0]) return { canceled: true };

    const pdfPath = result.filePaths[0];
    const quizDir = path.join(__dirname, "..", "quiz");

    if (!fs.existsSync(quizDir)) fs.mkdirSync(quizDir);

    try {
      const quizPath = await convertPdfToQuiz(pdfPath, quizDir);
      return { success: true, path: quizPath };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
  
  ipcMain.handle("list-quizzes", async () => {
    const quizDir = path.join(__dirname, "..", "quiz");

    if (!fs.existsSync(quizDir)) return [];

    const files = fs.readdirSync(quizDir)
      .filter((file) => file.endsWith(".json"));

    return files;
  });

  ipcMain.handle("load-quiz", async (_, filename) => {
    const filePath = path.join(__dirname, "..", "quiz", filename);

    try {
      const content = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(content);
    } catch (err) {
      return { error: err.message };
    }
  });
}

module.exports = { setupHandlers };

