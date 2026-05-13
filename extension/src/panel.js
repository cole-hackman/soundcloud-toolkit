const DEFAULT_API_BASE = 'https://api.soundcloudtoolkit.com';

function normalizeTrackUrl(href) {
  try {
    const u = new URL(href);
    u.hash = '';
    u.search = '';
    const path = u.pathname.replace(/\/$/, '') || '/';
    u.pathname = path;
    return u.toString();
  } catch {
    return href;
  }
}

async function getApiBase() {
  const { apiBase } = await chrome.storage.sync.get(['apiBase']);
  const raw = (apiBase || DEFAULT_API_BASE).replace(/\/$/, '');
  try {
    return new URL(raw).origin;
  } catch {
    return DEFAULT_API_BASE;
  }
}

async function apiFetch(path, options = {}) {
  const base = await getApiBase();
  const headers = { ...options.headers };
  if (options.body && typeof options.body === 'string' && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  return fetch(`${base}${path}`, {
    ...options,
    credentials: 'include',
    headers,
  });
}

async function fetchSession() {
  const res = await apiFetch('/api/auth/me');
  if (!res.ok) return null;
  return res.json();
}

function setAuthUi(session) {
  const authStatus = document.getElementById('authStatus');
  const signOut = document.getElementById('signOut');
  const signIn = document.getElementById('signIn');
  if (session?.username) {
    authStatus.textContent = `Signed in as @${session.username}`;
    authStatus.classList.remove('muted');
    signOut.hidden = false;
    signIn.hidden = true;
  } else {
    authStatus.textContent = 'Not signed in. Use Sign in to open the login tab.';
    authStatus.classList.add('muted');
    signOut.hidden = true;
    signIn.hidden = false;
  }
  updateCreateEnabled();
}

function updateCreateEnabled() {
  const title = document.getElementById('playlistTitle').value.trim();
  const count = Number(document.getElementById('selectionCount').textContent) || 0;
  const signedIn = !document.getElementById('signOut').hidden;
  document.getElementById('createPlaylist').disabled = !signedIn || count < 1 || !title;
}

document.getElementById('playlistTitle').addEventListener('input', updateCreateEnabled);

document.getElementById('openOptions').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

document.getElementById('signIn').addEventListener('click', async () => {
  const base = await getApiBase();
  const redirect = encodeURIComponent('/extension/connected');
  const url = `${base}/api/auth/login?redirect_path=${redirect}`;
  await chrome.tabs.create({ url });
  document.getElementById('actionMessage').textContent =
    'Complete login in the new tab, then click Refresh session here.';
  document.getElementById('actionMessage').classList.remove('error');
});

document.getElementById('refreshSession').addEventListener('click', async () => {
  document.getElementById('authStatus').textContent = 'Checking session…';
  const session = await fetchSession();
  setAuthUi(session);
});

document.getElementById('signOut').addEventListener('click', async () => {
  await apiFetch('/api/auth/logout', { method: 'POST', body: '{}' });
  setAuthUi(null);
});

async function readSelection() {
  const data = await chrome.storage.session.get(['scToolkitSelection']);
  return data.scToolkitSelection || { items: [] };
}

async function refreshSelectionCount() {
  const sel = await readSelection();
  const items = sel.items || [];
  document.getElementById('selectionCount').textContent = String(items.length);
  updateCreateEnabled();
}

chrome.storage.session.onChanged.addListener(() => {
  refreshSelectionCount();
});

async function resolveUrlsToIds(urls) {
  const unique = [...new Set(urls)];
  const ids = [];
  const BATCH = 50;
  for (let i = 0; i < unique.length; i += BATCH) {
    const chunk = unique.slice(i, i + BATCH);
    const res = await apiFetch('/api/resolve/batch', {
      method: 'POST',
      body: JSON.stringify({ urls: chunk }),
    });
    if (res.status === 429) {
      throw new Error('Too many requests. Wait a moment and try again.');
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || err.message || `Resolve failed (${res.status})`);
    }
    const data = await res.json();
    const results = data.results || [];
    for (const r of results) {
      if (r.status === 'ok' && r.data && r.data.type === 'track' && typeof r.data.id === 'number') {
        ids.push(r.data.id);
      }
    }
  }
  return [...new Set(ids)];
}

document.getElementById('createPlaylist').addEventListener('click', async () => {
  const msg = document.getElementById('actionMessage');
  msg.textContent = 'Working…';
  msg.classList.remove('error');
  const title = document.getElementById('playlistTitle').value.trim();
  if (!title) {
    msg.textContent = 'Enter a playlist title.';
    msg.classList.add('error');
    return;
  }
  const session = await fetchSession();
  if (!session?.username) {
    msg.textContent = 'Sign in first.';
    msg.classList.add('error');
    return;
  }
  const sel = await readSelection();
  const items = sel.items || [];
  if (items.length === 0) {
    msg.textContent = 'Select tracks on SoundCloud first.';
    msg.classList.add('error');
    return;
  }
  const directIds = [];
  const needUrls = [];
  for (const it of items) {
    if (typeof it.trackId === 'number' && it.trackId > 0) {
      directIds.push(it.trackId);
    } else if (it.url) {
      needUrls.push(normalizeTrackUrl(it.url));
    }
  }
  try {
    const resolved = needUrls.length ? await resolveUrlsToIds(needUrls) : [];
    const trackIds = [...new Set([...directIds, ...resolved])];
    if (trackIds.length === 0) {
      msg.textContent = 'Could not resolve any track IDs. Try again or refresh the SoundCloud page.';
      msg.classList.add('error');
      return;
    }
    const res = await apiFetch('/api/playlists/from-likes', {
      method: 'POST',
      body: JSON.stringify({ trackIds, title }),
    });
    if (res.status === 429) {
      msg.textContent = 'Rate limited. Try again later.';
      msg.classList.add('error');
      return;
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || err.message || `Create failed (${res.status})`);
    }
    const body = await res.json();
    const playlists = body.playlists || [];
    if (playlists.length === 1 && playlists[0].permalink_url) {
      msg.textContent = `Created: ${playlists[0].title || 'Playlist'}`;
    } else if (playlists.length > 0) {
      msg.textContent = `Created ${playlists.length} playlists (split at 500 tracks).`;
    } else {
      msg.textContent = 'Playlist created.';
    }
    msg.classList.remove('error');
  } catch (e) {
    msg.textContent = e.message || 'Something went wrong.';
    msg.classList.add('error');
  }
});

(async function init() {
  const session = await fetchSession();
  setAuthUi(session);
  await refreshSelectionCount();
})();
