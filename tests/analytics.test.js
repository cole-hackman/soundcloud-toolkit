import { startOperationTimer, extractClientInfo, logOperation } from '../server/lib/analytics.js';

describe('analytics helpers', () => {
  describe('startOperationTimer', () => {
    it('returns elapsed time in milliseconds', async () => {
      const elapsed = startOperationTimer();
      await new Promise(resolve => setTimeout(resolve, 50));
      const duration = elapsed();
      expect(duration).toBeGreaterThanOrEqual(40);
    });
  });

  describe('extractClientInfo', () => {
    it('returns null when req is undefined', () => {
      expect(extractClientInfo(null)).toBeNull();
    });

    it('extracts desktop chrome on mac', () => {
      const req = {
        headers: {
          'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      };
      const info = extractClientInfo(req);
      expect(info).toEqual({
        device: 'desktop',
        browser: 'chrome',
        platform: 'mac',
      });
    });

    it('extracts mobile safari on iphone', () => {
      const req = {
        headers: {
          'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        },
      };
      const info = extractClientInfo(req);
      expect(info).toEqual({
        device: 'mobile',
        browser: 'safari',
        platform: 'ios',
      });
    });
  });

  describe('logOperation parameter handling', () => {
    it('gracefully handles missing userId without throwing', async () => {
      await expect(logOperation({ action: 'test-action' })).resolves.not.toThrow();
    });
  });
});
