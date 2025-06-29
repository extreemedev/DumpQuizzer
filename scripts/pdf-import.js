document.getElementById('import-btn').addEventListener('click', async function() {
    if (window.electronAPI && window.electronAPI.importPDF) {
        const result = await window.electronAPI.importPDF();
        if (result.success) {
            alert('PDF importato con successo!');
            // Aggiorna la lista quiz dopo l'import
            if (typeof loadQuizList === 'function') loadQuizList();
        } else {
            alert('Errore durante l\'importazione del PDF.');
        }
    }
});