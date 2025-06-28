async function loadQuizList() {
  const list = await window.electronAPI.listQuizzes();
  const container = document.getElementById("quiz-list");

  container.innerHTML = ""; // svuota

  if (list.length === 0) {
    container.innerHTML = "<p>Nessun quiz disponibile.</p>";
    return;
  }

  list.forEach(file => {
    const btn = document.createElement("button");
    btn.textContent = file;
    btn.className = "btn-grad";
    btn.onclick = async () => {
      const quiz = await window.electronAPI.loadQuiz(file);
      if (quiz && quiz.quiz) {
        console.log("Quiz caricato:", quiz);
        // TODO: lancia il quiz in UI (usando generateQuiz(quiz))
        alert("Quiz caricato: " + file);
      } else {
        alert("Errore nel caricamento del quiz.");
      }
    };
    container.appendChild(btn);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const importBtn = document.getElementById("import-btn");
  if (importBtn) {
    importBtn.onclick = async () => {
      const result = await window.electronAPI.importPDF();
      if (result.success) {
        alert("✅ Quiz generato: " + result.jsonPath);
        await loadQuizList();
      } else if (result.error) {
        alert("❌ Errore: " + result.error);
      }
    };
  }

  // 🔁 Carica lista quiz all'avvio
  loadQuizList();
});
