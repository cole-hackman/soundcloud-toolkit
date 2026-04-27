const DOWNLOAD_PATH_RE = /^\/tracks\/\d+\/download$/;

export function isAllowedDownloadUrl(input) {
  if (!input || typeof input !== 'string') return false;
  const value = input.trim();
  if (!value) return false;

  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return (
      url.protocol === 'https:' &&
      host === 'api.soundcloud.com' &&
      DOWNLOAD_PATH_RE.test(url.pathname)
    );
  } catch {
    return false;
  }
}

export function isAllowedDownloadRedirectTarget(input) {
  if (!input || typeof input !== 'string') return false;

  try {
    const url = new URL(input);
    const host = url.hostname.toLowerCase();
    return (
      url.protocol === 'https:' &&
      (host === 'sndcdn.com' ||
        host.endsWith('.sndcdn.com') ||
        host === 'cloudfront.net' ||
        host.endsWith('.cloudfront.net'))
    );
  } catch {
    return false;
  }
}
