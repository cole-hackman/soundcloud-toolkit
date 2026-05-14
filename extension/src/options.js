const DEFAULT_API_BASE = 'https://api.soundcloudtoolkit.com';

async function load() {
  const { apiBase } = await chrome.storage.sync.get(['apiBase']);
  document.getElementById('apiBase').value = apiBase || DEFAULT_API_BASE;
}

document.getElementById('save').addEventListener('click', async () => {
  const raw = document.getElementById('apiBase').value.trim() || DEFAULT_API_BASE;
  let normalized = raw.replace(/\/$/, '');
  try {
    normalized = new URL(normalized).origin;
  } catch {
    document.getElementById('status').textContent = 'Invalid URL';
    document.getElementById('status').style.color = '#c00';
    return;
  }
  await chrome.storage.sync.set({ apiBase: normalized });
  document.getElementById('status').textContent = 'Saved.';
  document.getElementById('status').style.color = '#0a0';
});

load();
