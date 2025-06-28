const PDFProcessor = require('./pdf-processor');
const LLMClient = require('./llm-client');
const fs = require('fs');
const path = require('path');

class QuizGenerator {
    constructor() {
        this.llmClient = new LLMClient();
    }

    /**
     * Genera un quiz completo da un file PDF
     * @param {string} filePath - Percorso del file PDF
     * @param {object} options - Opzioni per la generazione
     * @returns {Promise<object>} - Quiz generato e informazioni aggiuntive
     */
    async generateFromPDF(filePath, options = {}) {
        try {
            // Valida il file PDF
            if (!PDFProcessor.isValidPDF(filePath)) {
                throw new Error('Il file selezionato non è un PDF valido');
            }

            // Ottieni informazioni sul PDF
            const pdfInfo = await PDFProcessor.getPDFInfo(filePath);
            console.log(`PDF Info: ${pdfInfo.pages} pagine, ${pdfInfo.textLength} caratteri`);

            // Estrai il testo dal PDF
            const extractedText = await PDFProcessor.extractText(filePath);
            
            if (extractedText.length < 100) {
                throw new Error('Il PDF contiene troppo poco testo per generare un quiz significativo');
            }

            // Genera il quiz dal testo
            const quiz = await this.generateFromText(extractedText, options);

            return {
                success: true,
                quiz: quiz,
                pdfInfo: pdfInfo,
                textLength: extractedText.length,
                generatedAt: new Date().toISOString()
            };

        } catch (error) {
            return {
                success: false,
                error: error.message,
                generatedAt: new Date().toISOString()
            };
        }
    }

    /**
     * Genera un quiz da testo estratto
     * @param {string} text - Testo sorgente
     * @param {object} options - Opzioni per la generazione
     * @returns {Promise<object>} - Quiz generato
     */
    async generateFromText(text, options = {}) {
        try {
            // Prepara le opzioni con valori di default
            const generationOptions = {
                numQuestions: options.numQuestions || 10,
                difficulty: options.difficulty || 'medium',
                topic: options.topic || this.extractTopicFromText(text),
                ...options
            };

            // Se il testo è molto lungo, dividilo in chunks
            const chunks = PDFProcessor.splitTextIntoChunks(text, 4000);
            
            if (chunks.length === 1) {
                // Testo abbastanza corto, genera direttamente
                return await this.llmClient.generateQuiz(text, generationOptions);
            } else {
                // Testo lungo, genera da chunks multipli e combina
                return await this.generateFromMultipleChunks(chunks, generationOptions);
            }

        } catch (error) {
            throw new Error(`Errore nella generazione del quiz: ${error.message}`);
        }
    }

    /**
     * Genera quiz da chunks multipli di testo
     * @param {Array<string>} chunks - Array di chunks di testo
     * @param {object} options - Opzioni per la generazione
     * @returns {Promise<object>} - Quiz combinato
     */
    async generateFromMultipleChunks(chunks, options) {
        const questionsPerChunk = Math.ceil(options.numQuestions / chunks.length);
        const allQuestions = [];
        let quizTitle = '';

        for (let i = 0; i < chunks.length && allQuestions.length < options.numQuestions; i++) {
            const chunkOptions = {
                ...options,
                numQuestions: Math.min(questionsPerChunk, options.numQuestions - allQuestions.length)
            };

            try {
                const chunkQuiz = await this.llmClient.generateQuiz(chunks[i], chunkOptions);
                
                if (i === 0) {
                    quizTitle = chunkQuiz.quizTitle;
                }

                // Aggiorna i numeri delle domande
                const adjustedQuestions = chunkQuiz.questions.map(q => ({
                    ...q,
                    number: allQuestions.length + q.number
                }));

                allQuestions.push(...adjustedQuestions);

            } catch (error) {
                console.warn(`Errore nel chunk ${i + 1}: ${error.message}`);
                // Continua con gli altri chunks
            }
        }

        if (allQuestions.length === 0) {
            throw new Error('Impossibile generare domande da nessun chunk del testo');
        }

        // Limita al numero richiesto di domande
        const finalQuestions = allQuestions.slice(0, options.numQuestions);

        return {
            quizTitle: quizTitle || `Quiz generato da PDF`,
            questions: finalQuestions
        };
    }

    /**
     * Estrae un possibile argomento dal testo
     * @param {string} text - Testo da analizzare
     * @returns {string} - Argomento estratto
     */
    extractTopicFromText(text) {
        // Semplice euristica per estrarre l'argomento
        const words = text.toLowerCase().split(/\s+/);
        const commonWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'must'];
        
        const wordFreq = {};
        words.forEach(word => {
            if (word.length > 3 && !commonWords.includes(word)) {
                wordFreq[word] = (wordFreq[word] || 0) + 1;
            }
        });

        const sortedWords = Object.entries(wordFreq)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 3)
            .map(([word]) => word);

        return sortedWords.length > 0 ? sortedWords.join(', ') : 'generale';
    }

    /**
     * Salva un quiz generato su file
     * @param {object} quiz - Quiz da salvare
     * @param {string} filename - Nome del file (opzionale)
     * @returns {string} - Percorso del file salvato
     */
    saveQuiz(quiz, filename = null) {
        try {
            if (!filename) {
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                filename = `quiz-generated-${timestamp}.json`;
            }

            const filePath = path.join('./quiz/generated', filename);
            
            // Assicurati che la directory esista
            const dir = path.dirname(filePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            fs.writeFileSync(filePath, JSON.stringify(quiz, null, 2), 'utf8');
            return filePath;

        } catch (error) {
            throw new Error(`Errore nel salvataggio del quiz: ${error.message}`);
        }
    }

    /**
     * Carica un quiz salvato
     * @param {string} filePath - Percorso del file quiz
     * @returns {object} - Quiz caricato
     */
    loadQuiz(filePath) {
        try {
            if (!fs.existsSync(filePath)) {
                throw new Error(`File non trovato: ${filePath}`);
            }

            const content = fs.readFileSync(filePath, 'utf8');
            const quiz = JSON.parse(content);

            // Valida la struttura del quiz caricato
            this.llmClient.validateQuiz(quiz);

            return quiz;

        } catch (error) {
            throw new Error(`Errore nel caricamento del quiz: ${error.message}`);
        }
    }

    /**
     * Lista tutti i quiz salvati
     * @returns {Array<object>} - Lista dei quiz con metadati
     */
    listSavedQuizzes() {
        try {
            const quizDir = './quiz/generated';
            
            if (!fs.existsSync(quizDir)) {
                return [];
            }

            const files = fs.readdirSync(quizDir)
                .filter(file => file.endsWith('.json'))
                .map(file => {
                    const filePath = path.join(quizDir, file);
                    const stats = fs.statSync(filePath);
                    
                    try {
                        const quiz = this.loadQuiz(filePath);
                        return {
                            filename: file,
                            path: filePath,
                            title: quiz.quizTitle,
                            questionsCount: quiz.questions.length,
                            createdAt: stats.birthtime,
                            modifiedAt: stats.mtime,
                            size: stats.size
                        };
                    } catch (error) {
                        return {
                            filename: file,
                            path: filePath,
                            title: 'Quiz corrotto',
                            questionsCount: 0,
                            createdAt: stats.birthtime,
                            modifiedAt: stats.mtime,
                            size: stats.size,
                            error: error.message
                        };
                    }
                })
                .sort((a, b) => b.createdAt - a.createdAt);

            return files;

        } catch (error) {
            console.error(`Errore nel listare i quiz salvati: ${error.message}`);
            return [];
        }
    }

    /**
     * Elimina un quiz salvato
     * @param {string} filePath - Percorso del file da eliminare
     * @returns {boolean} - True se eliminato con successo
     */
    deleteQuiz(filePath) {
        try {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                return true;
            }
            return false;
        } catch (error) {
            throw new Error(`Errore nell'eliminazione del quiz: ${error.message}`);
        }
    }

    /**
     * Testa la connessione LLM
     * @returns {Promise<boolean>} - True se la connessione è attiva
     */
    async testLLMConnection() {
        return await this.llmClient.testConnection();
    }

    /**
     * Ottiene statistiche sui quiz generati
     * @returns {object} - Statistiche
     */
    getStatistics() {
        try {
            const quizzes = this.listSavedQuizzes();
            const totalQuizzes = quizzes.length;
            const totalQuestions = quizzes.reduce((sum, quiz) => sum + quiz.questionsCount, 0);
            const averageQuestions = totalQuizzes > 0 ? Math.round(totalQuestions / totalQuizzes) : 0;
            
            const sizeStats = quizzes.map(q => q.size);
            const totalSize = sizeStats.reduce((sum, size) => sum + size, 0);
            
            return {
                totalQuizzes,
                totalQuestions,
                averageQuestions,
                totalSize,
                averageSize: totalQuizzes > 0 ? Math.round(totalSize / totalQuizzes) : 0,
                oldestQuiz: quizzes.length > 0 ? quizzes[quizzes.length - 1].createdAt : null,
                newestQuiz: quizzes.length > 0 ? quizzes[0].createdAt : null
            };
        } catch (error) {
            return {
                error: error.message,
                totalQuizzes: 0,
                totalQuestions: 0
            };
        }
    }
}

module.exports = QuizGenerator;
