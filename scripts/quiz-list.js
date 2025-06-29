async function loadQuizList() {
    if (window.electronAPI && window.electronAPI.listQuizzes) {
        const quizzes = await window.electronAPI.listQuizzes();
        console.log('Quiz trovati:', quizzes);
        const selector = document.getElementById('quiz-selector');
        selector.innerHTML = '';
        if (quizzes && quizzes.length > 0) {
            quizzes.forEach(q => {
                const option = document.createElement('option');
                option.value = q;
                option.textContent = q;
                selector.appendChild(option);
            });
        } else {
            const option = document.createElement('option');
            option.textContent = 'Nessun quiz disponibile.';
            option.disabled = true;
            selector.appendChild(option);
        }
    }
}
window.addEventListener('DOMContentLoaded', loadQuizList);