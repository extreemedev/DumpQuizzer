const { contextBridge, ipcRenderer } = require("electron");
const path = require("path");


contextBridge.exposeInMainWorld("electronAPI", {
  importPDF: async () => {
    const result = await ipcRenderer.invoke("import-pdf");
    if (result.canceled) return { success: false };
    if (result.error) return { success: false, error: result.error };
    return { success: true, pdfPath: result.pdfPath }; // <-- usa pdfPath
  },

  listQuizzes: async () => {
    return await ipcRenderer.invoke("list-quizzes");
  },

  loadQuiz: async (filename) => {
    return await ipcRenderer.invoke("load-quiz", filename);
  },

  ollamaHealth: async () => {
    return await window.electronAPI ? await window.electronAPI.invoke('ollama-health') : { status: 'error' };
  }
});
