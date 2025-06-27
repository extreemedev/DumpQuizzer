let quizData = {};
let selectedQuestions = [];
let currentQuestionIndex = 0;
let userResponses = {};
let fileName = "";

// Carica il quiz.json
fetch('quiz.json')
    .then(response => response.json())
    .then(data => {
        quizData = data;
        document.getElementById('slider').max = quizData.questions.length;
    });

// Aggiorna il valore dello slider dinamicamente
function updateSliderValue(value) {
    document.getElementById('slider-value').textContent = value;
}

// Genera il quiz e mostra il container delle domande
function generateQuiz() {
    const numQuestions = document.getElementById('slider').value;
    const allQuestions = quizData.questions;

    selectedQuestions = [];
    while (selectedQuestions.length < numQuestions) {
        const randomIndex = Math.floor(Math.random() * allQuestions.length);
        if (!selectedQuestions.includes(randomIndex)) {
            selectedQuestions.push(randomIndex);
        }
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    fileName = `./quiz/test-${timestamp}.txt`;

    const selectedQuestionsText = selectedQuestions.map(i => allQuestions[i].number).join(', ');
    saveToFile(fileName, `Selected Questions: ${selectedQuestionsText}`);

    displayQuestion(0);

    document.getElementById('main-container').style.display = 'block';
    document.getElementById('quiz-container').style.display = 'block';
    document.getElementById('submit-btn').style.display = 'block';
    document.getElementById('generate-btn').style.display = 'none';
    document.getElementById('slider').disabled = true;
}

// Salva in un file
function saveToFile(filename, content) {
    console.log(`Salvataggio in ${filename}: \n${content}`);
}

// Mostra una domanda
function displayQuestion(index) {
    const quizContainer = document.getElementById('quiz-container');
    const question = quizData.questions[selectedQuestions[index]];
    
    quizContainer.innerHTML = `
        <h2>${index + 1}. ${question.question}</h2>
        ${Object.keys(question.options).map(optionKey => `
            <label>
                <input type="radio" name="question${index}" value="${optionKey}" ${userResponses[index] === optionKey ? 'checked' : ''}>
                ${optionKey}: ${question.options[optionKey]}
            </label>
        `).join('')}
        <br><br>
        <div style="display:flex;">
        <button onclick="prevQuestion()">Precedente</button>
        <button onclick="nextQuestion()">Successivo</button>
        </div>
    `;
    
    currentQuestionIndex = index;
    if (index === 0) {
        document.querySelector('button[onclick="prevQuestion()"]').style.display = 'none';
    } else {
        document.querySelector('button[onclick="prevQuestion()"]').style.display = 'block';
    }
    if (index === selectedQuestions.length - 1) {
        document.querySelector('button[onclick="nextQuestion()"]').style.display = 'none';
    } else {
        document.querySelector('button[onclick="nextQuestion()"]').style.display = 'block';
    }
}

// Salva la risposta corrente
function storeUserResponse() {
    const selectedOption = document.querySelector(`input[name="question${currentQuestionIndex}"]:checked`);
    if (selectedOption) {
        userResponses[currentQuestionIndex] = selectedOption.value;
    }
}

// Navigazione tra le domande
function prevQuestion() {
    storeUserResponse();
    if (currentQuestionIndex > 0) {
        displayQuestion(currentQuestionIndex - 1);
    }
}

function nextQuestion() {
    storeUserResponse();
    if (currentQuestionIndex < selectedQuestions.length - 1) {
        displayQuestion(currentQuestionIndex + 1);
    }
}

// Submit delle risposte e visualizzazione delle risposte colorate
function submitQuiz() {
    storeUserResponse();

    // Nascondi il container del quiz
    document.getElementById('quiz-container').style.display = 'none';
    document.getElementById('submit-btn').style.display = 'none';
    document.getElementById('restart-btn').style.display = 'block';
    
    let score = 0;
    let correctAnswers = [];
    let incorrectAnswers = [];

    const resultsContainer = document.getElementById('results-container');
    resultsContainer.innerHTML = ''; // Reset dei risultati

    selectedQuestions.forEach((questionIndex, index) => {
        const question = quizData.questions[questionIndex];
        const userAnswer = userResponses[index];

        let isCorrect = userAnswer === question.correctAnswer;
        if (isCorrect) {
            score++;
            correctAnswers.push(`${question.number}: Correct`);
        } else {
            incorrectAnswers.push(`${question.number}: Incorrect (Your Answer: ${userAnswer}, Correct Answer: ${question.correctAnswer})`);
        }

        // Visualizza tutte le domande con le risposte evidenziate
        const questionElem = document.createElement('div');
        questionElem.innerHTML = `
            <h2>${index + 1}. ${question.question}</h2>
            ${Object.keys(question.options).map(optionKey => `
                <label class="${
                    optionKey === userAnswer 
                    ? (isCorrect ? 'correct-answer' : 'wrong-answer') 
                    : (optionKey === question.correctAnswer ? 'correct-answer-outline' : '')}">
                    ${optionKey}: ${question.options[optionKey]} 
                    ${userAnswer === optionKey ? '(Your Answer)' : ''}
                </label>
            `).join('')}
        `;
        resultsContainer.appendChild(questionElem);
    });

    // Mostra il container dei risultati
    resultsContainer.style.display = 'block';

    const resultContent = `Score: ${score}/${selectedQuestions.length}\n\nCorrect Answers:\n${correctAnswers.join('\n')}\n\nIncorrect Answers:\n${incorrectAnswers.join('\n')}`;
    saveToFile(fileName, resultContent);

    document.getElementById('results').innerHTML = `<h3>Your Score: ${score} / ${selectedQuestions.length}</h3>`;
}
