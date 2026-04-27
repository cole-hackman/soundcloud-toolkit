import {
  isAllowedDownloadRedirectTarget,
  isAllowedDownloadUrl,
} from '../server/lib/download-utils.js';

describe('download URL safety helpers', () => {
  test('accepts SoundCloud API track download URLs only', () => {
    expect(isAllowedDownloadUrl('https://api.soundcloud.com/tracks/123/download')).toBe(true);
    expect(isAllowedDownloadUrl('https://api.soundcloud.com/tracks/123/download?client_id=x')).toBe(true);
    expect(isAllowedDownloadUrl('https://foo.soundcloud.com/tracks/123/download')).toBe(false);
    expect(isAllowedDownloadUrl('https://soundcloud.com/artist/track')).toBe(false);
    expect(isAllowedDownloadUrl('https://api.soundcloud.com/playlists/123/download')).toBe(false);
    expect(isAllowedDownloadUrl('http://api.soundcloud.com/tracks/123/download')).toBe(false);
  });

  test('allows CDN redirects but rejects SoundCloud error-page redirects', () => {
    expect(isAllowedDownloadRedirectTarget('https://download-media.sndcdn.com/file.mp3')).toBe(true);
    expect(isAllowedDownloadRedirectTarget('https://d1.cloudfront.net/file.mp3')).toBe(true);
    expect(isAllowedDownloadRedirectTarget('https://soundcloud.com/error?code=download')).toBe(false);
    expect(isAllowedDownloadRedirectTarget('https://evil.example/file.mp3')).toBe(false);
  });
});
