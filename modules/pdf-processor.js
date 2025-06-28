const pdf = require('pdf-parse');
const fs = require('fs');
const path = require('path');

class PDFProcessor {
    /**
     * Estrae il testo da un file PDF
     * @param {string} filePath - Percorso del file PDF
     * @returns {Promise<string>} - Testo estratto dal PDF
     */
    static async extractText(filePath) {
        try {
            if (!fs.existsSync(filePath)) {
                throw new Error(`File non trovato: ${filePath}`);
            }

            const dataBuffer = fs.readFileSync(filePath);
            const data = await pdf(dataBuffer);
            
            if (!data.text || data.text.trim().length === 0) {
                throw new Error('Il PDF non contiene testo estraibile');
            }

            return this.cleanText(data.text);
        } catch (error) {
            throw new Error(`Errore nell'estrazione del testo dal PDF: ${error.message}`);
        }
    }

    /**
     * Pulisce e formatta il testo estratto
     * @param {string} text - Testo grezzo
     * @returns {string} - Testo pulito
     */
    static cleanText(text) {
        if (!text) return '';

        return text
            // Rimuove spazi multipli
            .replace(/\s+/g, ' ')
            // Rimuove newline multipli
            .replace(/\n+/g, '\n')
            // Rimuove caratteri di controllo
            .replace(/[\x00-\x1F\x7F]/g, '')
            // Rimuove spazi all'inizio e alla fine
            .trim();
    }

    /**
     * Valida se un file è un PDF valido
     * @param {string} filePath - Percorso del file
     * @returns {boolean} - True se è un PDF valido
     */
    static isValidPDF(filePath) {
        try {
            const ext = path.extname(filePath).toLowerCase();
            if (ext !== '.pdf') return false;

            const stats = fs.statSync(filePath);
            if (stats.size === 0) return false;

            // Controlla i magic bytes del PDF
            const buffer = fs.readFileSync(filePath, { start: 0, end: 4 });
            return buffer.toString() === '%PDF';
        } catch (error) {
            return false;
        }
    }

    /**
     * Ottiene informazioni sul PDF
     * @param {string} filePath - Percorso del file
     * @returns {Promise<object>} - Informazioni sul PDF
     */
    static async getPDFInfo(filePath) {
        try {
            const dataBuffer = fs.readFileSync(filePath);
            const data = await pdf(dataBuffer);
            
            return {
                pages: data.numpages,
                textLength: data.text.length,
                info: data.info || {},
                version: data.version || 'Unknown'
            };
        } catch (error) {
            throw new Error(`Errore nel recupero delle informazioni PDF: ${error.message}`);
        }
    }

    /**
     * Divide il testo in chunks per il processamento LLM
     * @param {string} text - Testo da dividere
     * @param {number} maxChunkSize - Dimensione massima del chunk
     * @returns {Array<string>} - Array di chunks
     */
    static splitTextIntoChunks(text, maxChunkSize = 4000) {
        if (text.length <= maxChunkSize) {
            return [text];
        }

        const chunks = [];
        const sentences = text.split(/[.!?]+/);
        let currentChunk = '';

        for (const sentence of sentences) {
            if ((currentChunk + sentence).length > maxChunkSize) {
                if (currentChunk) {
                    chunks.push(currentChunk.trim());
                    currentChunk = sentence;
                } else {
                    // Se una singola frase è troppo lunga, la dividiamo
                    chunks.push(sentence.substring(0, maxChunkSize));
                    currentChunk = sentence.substring(maxChunkSize);
                }
            } else {
                currentChunk += sentence + '.';
            }
        }

        if (currentChunk.trim()) {
            chunks.push(currentChunk.trim());
        }

        return chunks;
    }
}

module.exports = PDFProcessor;
