import { buildDeepLink } from '../server/lib/chat-deep-links.js';

describe('buildDeepLink', () => {
  test('like-manager filter encodes artist+genre+q', () => {
    expect(buildDeepLink('like-manager-filter', { artist: 'Riordan', genre: 'tech house' })).toBe(
      '/like-manager?artist=Riordan&genre=tech+house',
    );
  });
  test('omits empty fields', () => {
    expect(buildDeepLink('like-manager-filter', { artist: 'X', genre: '', q: undefined })).toBe(
      '/like-manager?artist=X',
    );
  });
  test('playlist-compare uses a/b', () => {
    expect(buildDeepLink('playlist-compare', { a: 12, b: 34 })).toBe('/playlist-compare?a=12&b=34');
  });
  test('returns null for unknown kind', () => {
    expect(buildDeepLink('whatever', {})).toBeNull();
  });
});
