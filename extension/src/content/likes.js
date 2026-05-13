(function () {
  const state = new Map();

  function normalizeTrackUrl(href) {
    try {
      const u = new URL(href);
      u.hash = '';
      const path = u.pathname.replace(/\/$/, '') || '/';
      u.pathname = path;
      return u.toString();
    } catch {
      return href;
    }
  }

  function isLikelyTrackUrl(href) {
    try {
      const u = new URL(href);
      const host = u.hostname.toLowerCase();
      if (host !== 'soundcloud.com' && !host.endsWith('.soundcloud.com')) return false;
      const parts = u.pathname.split('/').filter(Boolean);
      if (parts.length !== 2) return false;
      const blockedFirst = new Set([
        'you',
        'pages',
        'discover',
        'popular',
        'stations',
        'imprint',
        'charts',
        'feed',
      ]);
      if (blockedFirst.has(parts[0])) return false;
      return true;
    } catch {
      return false;
    }
  }

  function extractTrackIdFromElement(el) {
    if (!el) return null;
    const html = el.innerHTML;
    let m = html.match(/soundcloud:tracks:(\d+)/);
    if (m) return Number(m[1]);
    m = html.match(/\/tracks\/(\d+)/);
    if (m) return Number(m[1]);
    m = html.match(/data-track-id="(\d+)"/);
    if (m) return Number(m[1]);
    return null;
  }

  function pushSelection() {
    const items = [];
    for (const [url, meta] of state.entries()) {
      if (meta.checked) {
        const row = { url };
        if (typeof meta.trackId === 'number') row.trackId = meta.trackId;
        items.push(row);
      }
    }
    chrome.runtime.sendMessage({ type: 'TRACK_SELECTION', payload: { items } });
  }

  function cleanup() {
    document.querySelectorAll('.sc-toolkit-select-wrap').forEach((el) => el.remove());
    document.querySelectorAll('[data-sc-toolkit-bound]').forEach((el) => el.removeAttribute('data-sc-toolkit-bound'));
    state.clear();
    chrome.runtime.sendMessage({ type: 'TRACK_SELECTION', payload: { items: [] } });
  }

  function scan() {
    const anchors = document.querySelectorAll('a[href*="soundcloud.com"]');
    const seenUrls = new Set();

    for (const anchor of anchors) {
      const fullHref = anchor.href;
      if (!isLikelyTrackUrl(fullHref)) continue;
      const url = normalizeTrackUrl(fullHref);
      if (seenUrls.has(url)) continue;
      seenUrls.add(url);

      if (anchor.dataset.scToolkitBound) continue;
      anchor.dataset.scToolkitBound = '1';

      const row =
        anchor.closest('li') ||
        anchor.closest('article') ||
        anchor.closest('[role="row"]') ||
        anchor.closest('div[class*="track"]') ||
        anchor.parentElement;
      const trackId = extractTrackIdFromElement(row || anchor);

      const wrap = document.createElement('span');
      wrap.className = 'sc-toolkit-select-wrap';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.className = 'sc-toolkit-cb';
      cb.title = 'SoundCloud Toolkit selection';

      const meta = { checkbox: cb, trackId, checked: false };
      state.set(url, meta);

      cb.addEventListener('change', () => {
        meta.checked = cb.checked;
        pushSelection();
      });

      wrap.appendChild(cb);

      const parent = anchor.parentNode;
      if (parent) {
        parent.insertBefore(wrap, anchor);
      }
    }
  }

  let debounceTimer;
  function scheduleScan() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(scan, 300);
  }

  let lastHref = location.href;
  function checkNavigation() {
    if (location.href !== lastHref) {
      lastHref = location.href;
      cleanup();
      scheduleScan();
    }
  }

  const observer = new MutationObserver(() => scheduleScan());
  observer.observe(document.documentElement, { childList: true, subtree: true });

  setInterval(checkNavigation, 800);

  window.addEventListener('popstate', () => {
    lastHref = location.href;
    cleanup();
    scheduleScan();
  });

  scan();
})();
