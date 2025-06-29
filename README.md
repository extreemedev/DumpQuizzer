# DumpQuizzer

DumpQuizzer is a desktop application developed using Electron and Node.js, designed to help users practice with exam dump quizzes or collections of questions and exercises from real or simulated certification exams (commonly IT-related, such as Cisco, CompTIA, Microsoft, etc.).

The main goal is to provide a simple and functional interface to simulate tests, quickly review questions, or improve exam readiness by working directly with real-world examples.

---

## Ollama Prerequisites and Distribution Notes

To use the embedded LLM features (PDF to quiz conversion), the following requirements must be met on the target system:

### 1. Ollama Binary
- The correct Ollama binary for your OS must be present in the `ollama/` folder (e.g. `ollama-win.exe`, `ollama-linux`, `ollama-mac`).

### 2. System Dependencies
- **Windows:** Usually works out-of-the-box, but some systems may require the latest Visual C++ Redistributable.
- **Linux:** Requires standard libraries like `libc`, `libstdc++`, etc. (usually already present on most distributions).
- **Mac:** Requires macOS 12 or newer.

### 3. Model Download
- The first time you use the app, Ollama will automatically download the required model (e.g. `mistral:7b`) to the user's `.ollama/models` directory. This requires an internet connection on first use.

### 4. Permissions
- The Ollama binary must have execution permissions.
- On Windows, SmartScreen or antivirus may block the executable; allow it if prompted.

### 5. Free Port
- Ollama must be able to bind to port `11434` (default).

### 6. No Need for Python, Docker, or Node.js (for Ollama)
- Ollama is a native binary and does not require Python, Docker, or Node.js to run.

### Troubleshooting
- If the IA status is "Not Ready":
  - Make sure Ollama is running (check Task Manager or Activity Monitor).
  - Make sure port 11434 is not blocked by a firewall or used by another process.
  - Try running the Ollama binary manually to check for missing dependencies or error messages.
  - Ensure you have an internet connection for the first model download.

For more details, see the official Ollama documentation: https://ollama.com/