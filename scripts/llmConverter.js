const fs = require("fs");
const pdf = require("pdf-parse");
const { spawn } = require("child_process");
const path = require("path");

async function extractText(pdfPath) {
  const buffer = fs.readFileSync(pdfPath);
  const data = await pdf(buffer);
  return data.text;
}

function askOllama(text, callback) {
  const prompt = `
You are a converter. Convert the following multiple-choice questions into JSON using this format:

{
  "quiz": [
    {
      "question": "...",
      "options": ["...", "...", "...", "..."],
      "answer": "..."
    }
  ]
}

Return only the JSON.

TEXT:
`;

  const ollama = spawn("ollama", ["run", "mistral"]);

  let result = "";

  ollama.stdout.on("data", (data) => {
    result += data.toString();
  });

  ollama.stdin.write(prompt + text);
  ollama.stdin.end();

  ollama.on("close", () => {
    callback(result);
  });
}

async function convertPdfToQuiz(pdfPath, outputDir) {
  const text = await extractText(pdfPath);
  const baseName = path.basename(pdfPath).replace(".pdf", "");
  const outputPath = path.join(outputDir, `quiz-from-${baseName}.json`);

  return new Promise((resolve, reject) => {
    askOllama(text, (json) => {
      try {
        fs.writeFileSync(outputPath, json);
        resolve(outputPath);
      } catch (err) {
        reject(err);
      }
    });
  });
}

module.exports = { convertPdfToQuiz };
