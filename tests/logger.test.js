import { jest } from '@jest/globals';
const { default: logger } = await import('../server/lib/logger.js');

let logSpy;
beforeEach(() => { logSpy = jest.spyOn(console, 'log').mockImplementation(() => {}); });
afterEach(() => { logSpy.mockRestore(); });

describe('logger.info message sanitization', () => {
  test('redacts token= in the message string', () => {
    logger.info('refresh failed token=super-secret-value retrying');
    expect(logSpy.mock.calls[0][0]).toContain('token=***');
    expect(logSpy.mock.calls[0][0]).not.toContain('super-secret-value');
  });

  test('redacts oauth_token embedded in a URL query string', () => {
    logger.info('resolving https://api.soundcloud.com/me?oauth_token=SECRET123&limit=5');
    expect(logSpy.mock.calls[0][0]).not.toContain('SECRET123');
  });

  test('leaves ordinary messages untouched', () => {
    logger.info('200 GET /api/playlists 154ms');
    expect(logSpy.mock.calls[0][0]).toBe('[INFO] 200 GET /api/playlists 154ms');
  });
});
