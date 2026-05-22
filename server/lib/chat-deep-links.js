/**
 * Build a relative deep-link URL for a chat result card.
 * Pure helper — keeps query-string construction out of the tool dispatcher.
 * Returns null for unrecognized kinds.
 */
export function buildDeepLink(kind, args = {}) {
  const params = new URLSearchParams();
  const set = (key, value) => {
    if (value === undefined || value === null) return;
    const str = String(value);
    if (!str) return;
    params.set(key, str);
  };

  if (kind === 'like-manager-filter') {
    set('artist', args.artist);
    set('genre', args.genre);
    set('q', args.q);
    const qs = params.toString();
    return qs ? `/like-manager?${qs}` : '/like-manager';
  }
  if (kind === 'playlist-compare') {
    set('a', args.a);
    set('b', args.b);
    return `/playlist-compare?${params.toString()}`;
  }
  return null;
}
