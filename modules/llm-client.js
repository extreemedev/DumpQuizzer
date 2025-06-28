const axios = require('axios');
const config = require('../config/app-config.json');

class LLMClient {
    constructor() {
        this.config = config.llm;
    }

    /**
     * Genera un quiz dal testo usando LLM
     * @param {string} text - Testo da cui generare il quiz
     * @param {object} options - Opzioni per la generazione
     * @returns {Promise<object>} - Quiz generato in formato JSON
     */
    async generateQuiz(text, options = {}) {
        const numQuestions = options.numQuestions || this.config.defaultQuestions || 10;
        const difficulty = options.difficulty || 'medium';
        const topic = options.topic || 'generale';

        const prompt = this.buildPrompt(text, numQuestions, difficulty, topic);
        
        try {
            switch(this.config.provider) {
                case 'ollama':
                    return await this.callOllama(prompt);
                case 'openai':
                    return await this.callOpenAI(prompt);
                default:
                    throw new Error(`Provider LLM non supportato: ${this.config.provider}`);
            }
        } catch (error) {
            // Fallback al provider alternativo se configurato
            if (this.config.fallback && this.config.fallback.provider) {
                console.warn(`Fallback al provider: ${this.config.fallback.provider}`);
                return await this.callFallback(prompt);
            }
            throw error;
        }
    }

    /**
     * Costruisce il prompt per l'LLM
     * @param {string} text - Testo sorgente
     * @param {number} numQuestions - Numero di domande
     * @param {string} difficulty - Livello di difficoltà
     * @param {string} topic - Argomento
     * @returns {string} - Prompt formattato
     */
    buildPrompt(text, numQuestions, difficulty, topic) {
        return `Sei un esperto nella creazione di quiz educativi. Analizza il seguente testo e genera esattamente ${numQuestions} domande quiz a scelta multipla.

REQUISITI OBBLIGATORI:
1. Ogni domanda deve avere esattamente 4 opzioni (A, B, C, D)
2. Una sola risposta corretta per domanda
3. Le domande devono essere pertinenti al contenuto del testo
4. Livello di difficoltà: ${difficulty}
5. Argomento: ${topic}
6. Le opzioni sbagliate devono essere plausibili ma chiaramente errate
7. Evita domande troppo ovvie o troppo specifiche

FORMATO OUTPUT (JSON VALIDO):
{
  "quizTitle": "Titolo basato sul contenuto del testo",
  "questions": [
    {
      "number": 1,
      "question": "Testo della domanda chiaro e preciso",
      "options": {
        "A": "Prima opzione",
        "B": "Seconda opzione",
        "C": "Terza opzione",
        "D": "Quarta opzione"
      },
      "correctAnswer": "A"
    }
  ]
}

TESTO DA ANALIZZARE:
${text.substring(0, 4000)}

IMPORTANTE: Rispondi SOLO con il JSON valido, senza testo aggiuntivo prima o dopo. Il JSON deve essere parsabile direttamente.`;
    }

    /**
     * Chiama l'API di Ollama
     * @param {string} prompt - Prompt per l'LLM
     * @returns {Promise<object>} - Risposta parsata
     */
    async callOllama(prompt) {
        try {
            const response = await axios.post(`${this.config.endpoint}/api/generate`, {
                model: this.config.model,
                prompt: prompt,
                stream: false,
                options: {
                    temperature: this.config.temperature,
                    num_predict: this.config.maxTokens
                }
            }, {
                timeout: 60000 // 60 secondi timeout
            });

            if (!response.data || !response.data.response) {
                throw new Error('Risposta vuota da Ollama');
            }

            return this.parseResponse(response.data.response);
        } catch (error) {
            if (error.code === 'ECONNREFUSED') {
                throw new Error('Ollama non è in esecuzione. Assicurati che Ollama sia avviato su localhost:11434');
            }
            throw new Error(`Errore Ollama: ${error.message}`);
        }
    }

    /**
     * Chiama l'API di OpenAI
     * @param {string} prompt - Prompt per l'LLM
     * @returns {Promise<object>} - Risposta parsata
     */
    async callOpenAI(prompt) {
        try {
            if (!this.config.fallback.apiKey) {
                throw new Error('API Key OpenAI non configurata');
            }

            const response = await axios.post('https://api.openai.com/v1/chat/completions', {
                model: this.config.fallback.model,
                messages: [
                    {
                        role: 'system',
                        content: 'Sei un esperto nella creazione di quiz educativi. Rispondi sempre con JSON valido.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: this.config.temperature,
                max_tokens: this.config.maxTokens
            }, {
                headers: {
                    'Authorization': `Bearer ${this.config.fallback.apiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 30000
            });

            if (!response.data.choices || !response.data.choices[0]) {
                throw new Error('Risposta vuota da OpenAI');
            }

            return this.parseResponse(response.data.choices[0].message.content);
        } catch (error) {
            throw new Error(`Errore OpenAI: ${error.message}`);
        }
    }

    /**
     * Chiama il provider di fallback
     * @param {string} prompt - Prompt per l'LLM
     * @returns {Promise<object>} - Risposta parsata
     */
    async callFallback(prompt) {
        const originalProvider = this.config.provider;
        this.config.provider = this.config.fallback.provider;
        
        try {
            return await this.generateQuiz(prompt);
        } finally {
            this.config.provider = originalProvider;
        }
    }

    /**
     * Parsa la risposta dell'LLM e valida il JSON
     * @param {string} response - Risposta grezza dell'LLM
     * @returns {object} - Quiz parsato e validato
     */
    parseResponse(response) {
        try {
            // Rimuove eventuali caratteri prima e dopo il JSON
            let cleanResponse = response.trim();
            
            // Trova l'inizio e la fine del JSON
            const jsonStart = cleanResponse.indexOf('{');
            const jsonEnd = cleanResponse.lastIndexOf('}') + 1;
            
            if (jsonStart === -1 || jsonEnd === 0) {
                throw new Error('JSON non trovato nella risposta');
            }
            
            cleanResponse = cleanResponse.substring(jsonStart, jsonEnd);
            
            const quiz = JSON.parse(cleanResponse);
            
            // Valida la struttura del quiz
            this.validateQuiz(quiz);
            
            return quiz;
        } catch (error) {
            throw new Error(`Errore nel parsing della risposta: ${error.message}\nRisposta: ${response}`);
        }
    }

    /**
     * Valida la struttura del quiz generato
     * @param {object} quiz - Quiz da validare
     * @throws {Error} - Se la struttura non è valida
     */
    validateQuiz(quiz) {
        if (!quiz || typeof quiz !== 'object') {
            throw new Error('Quiz non è un oggetto valido');
        }

        if (!quiz.quizTitle || typeof quiz.quizTitle !== 'string') {
            throw new Error('Quiz deve avere un titolo valido');
        }

        if (!Array.isArray(quiz.questions) || quiz.questions.length === 0) {
            throw new Error('Quiz deve avere almeno una domanda');
        }

        quiz.questions.forEach((question, index) => {
            if (!question.number || !question.question || !question.options || !question.correctAnswer) {
                throw new Error(`Domanda ${index + 1} ha una struttura invalida`);
            }

            const options = Object.keys(question.options);
            if (options.length !== 4 || !options.includes('A') || !options.includes('B') || !options.includes('C') || !options.includes('D')) {
                throw new Error(`Domanda ${index + 1} deve avere esattamente 4 opzioni (A, B, C, D)`);
            }

            if (!['A', 'B', 'C', 'D'].includes(question.correctAnswer)) {
                throw new Error(`Domanda ${index + 1} ha una risposta corretta invalida`);
            }
        });
    }

    /**
     * Testa la connessione con il provider LLM
     * @returns {Promise<boolean>} - True se la connessione è attiva
     */
    async testConnection() {
        try {
            switch(this.config.provider) {
                case 'ollama':
                    const response = await axios.get(`${this.config.endpoint}/api/tags`, { timeout: 5000 });
                    return response.status === 200;
                case 'openai':
                    if (!this.config.fallback.apiKey) return false;
                    // Test con una richiesta minima
                    const testResponse = await axios.post('https://api.openai.com/v1/chat/completions', {
                        model: this.config.fallback.model,
                        messages: [{ role: 'user', content: 'test' }],
                        max_tokens: 1
                    }, {
                        headers: {
                            'Authorization': `Bearer ${this.config.fallback.apiKey}`,
                            'Content-Type': 'application/json'
                        },
                        timeout: 5000
                    });
                    return testResponse.status === 200;
                default:
                    return false;
            }
        } catch (error) {
            return false;
        }
    }
}

module.exports = LLMClient;
