async function checkIAStatus() {
  let statusDot = document.getElementById('ia-status-dot');
  let statusLabel = document.getElementById('ia-status-label');
  if (!window.electronAPI || !window.electronAPI.ollamaHealth) {
    statusDot.style.background = '#aaa';
    statusLabel.textContent = 'IA: Not available';
    return;
  }
  try {
    const res = await window.electronAPI.ollamaHealth();
    console.log('[Ollama Health] Response:', res);
    if (res.status === 'error') {
      statusDot.style.background = '#2ecc40';
      statusLabel.textContent = 'IA: Reachable';
    } else {
      statusDot.style.background = '#ff4136';
      statusLabel.textContent = 'IA: Not Ready';
    }
  } catch (e) {
    statusDot.style.background = '#ff4136';
    statusLabel.textContent = 'IA: Not Ready';
    console.error('[Ollama Health] Error:', e);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  checkIAStatus();
  setInterval(checkIAStatus, 5000);
});
