// Renderer logic for OIDC Tool
document.addEventListener('DOMContentLoaded', async () => {
  const platformBadge = document.getElementById('platform-badge');
  const runtimeLabel = document.getElementById('runtime-label');
  const footerSystemInfo = document.getElementById('footer-system-info');

  try {
    if (window.api && window.api.getAppInfo) {
      const info = await window.api.getAppInfo();
      platformBadge.textContent = `${info.platform} (${info.arch})`;
      runtimeLabel.textContent = `Electron ${info.electronVersion} / Node ${info.nodeVersion}`;
      footerSystemInfo.textContent = `OIDC Tool v${info.version} • Running on ${info.platform} ${info.arch}`;
    } else {
      platformBadge.textContent = 'Web Preview';
      footerSystemInfo.textContent = 'Running in standalone browser context';
    }
  } catch (error) {
    console.error('Failed to load application info:', error);
    platformBadge.textContent = 'Unknown';
    footerSystemInfo.textContent = 'System info unavailable';
  }
});
