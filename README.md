# DumpQuizzer

DumpQuizzer is a desktop application developed using Electron and Node.js, designed to help users practice with exam dump quizzes or collections of questions and exercises from real or simulated certification exams (commonly IT-related, such as Cisco, CompTIA, Microsoft, etc.).

The main goal is to provide a simple and functional interface to simulate tests, quickly review questions, or improve exam readiness by working directly with real-world examples.

---

## Ollama Model Storage

When your application downloads a model using Ollama (for example, `mistral:7b`), the model file is automatically saved by Ollama in its default models directory.

### Default model path

- **Windows:**
  - `C:\Users\<username>\.ollama\models`
- **Linux/Mac:**
  - `/home/<username>/.ollama/models` or `/Users/<username>/.ollama/models`

This location is managed internally by Ollama and **cannot be changed** via API or parameters.

### Important notes
- You do not need to manually move model files.
- If you distribute the app to other computers, the model will be automatically downloaded to the above folder on first launch.
- If you want to save disk space, you can delete unused models directly from this folder.

For more details, see the official Ollama documentation: https://ollama.com/