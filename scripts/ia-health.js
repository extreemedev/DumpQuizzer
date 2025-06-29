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
    if (res.status === 'ready') {
      statusDot.style.background = '#2ecc40';
      statusLabel.textContent = 'IA: Ready';
    } else {
      statusDot.style.background = '#ff4136';
      statusLabel.textContent = 'IA: Not Ready';
    }
  } catch (e) {
    statusDot.style.background = '#ff4136';
    statusLabel.textContent = 'IA: Not Ready';
  }
}

window.addEventListener('DOMContentLoaded', () => {
  checkIAStatus();
  setInterval(checkIAStatus, 5000);
});
