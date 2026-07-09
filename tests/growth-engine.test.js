import { jest } from '@jest/globals';
import { GrowthEngine } from '../server/lib/growth-engine.js';

describe('GrowthEngine', () => {
  let mockSoundCloudClient;
  let growthEngine;

  beforeEach(() => {
    mockSoundCloudClient = {
      getFollowings: jest.fn(),
      getFollowers: jest.fn(),
      getUserFollowers: jest.fn(),
      getUserFollowings: jest.fn().mockResolvedValue([]),
      getRelatedArtists: jest.fn(),
      getUserTracks: jest.fn(),
    };

    growthEngine = new GrowthEngine(mockSoundCloudClient);
  });

  describe('scoreCandidate', () => {
    test('calculates correct score and label based on ratios and signals', () => {
      const user = {
        id: 101,
        username: 'candidate1',
        followers_count: 100,
        followings_count: 400, // Ratio 4.0
        track_count: 5,       // Creator
        last_modified: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // Active 5 days ago
      };

      const result = growthEngine.scoreCandidate(user, 2, 3, true);

      expect(result.score).toBeGreaterThanOrEqual(40);
      expect(result.signals.followBackRatio).toBe(4.0);
      expect(result.signals.sharedInspirationCount).toBe(2);
      expect(result.signals.isRelatedArtist).toBe(true);
      expect(result.signals.isCreator).toBe(true);
    });

    test('gives low score to inactive spam/bot profiles with no tracks', () => {
      const user = {
        id: 102,
        username: 'bot',
        followers_count: 5000,
        followings_count: 5, // Ratio 0.01
        track_count: 0,
        last_modified: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(), // Inactive
      };

      const result = growthEngine.scoreCandidate(user, 0, 3, false);

      expect(result.score).toBeLessThan(40);
      expect(result.scoreLabel).toBe('low');
    });

    test('genre affinity raises the score and is surfaced as a signal', () => {
      const user = {
        id: 103,
        username: 'scene-fit',
        followers_count: 100,
        followings_count: 100,
        track_count: 4,
      };

      const noAffinity = growthEngine.scoreCandidate(user, 1, 2, false, 0);
      const highAffinity = growthEngine.scoreCandidate(user, 1, 2, false, 1);

      expect(highAffinity.score).toBeGreaterThan(noAffinity.score);
      expect(highAffinity.signals.genreAffinity).toBe(1);
      expect(noAffinity.signals.genreAffinity).toBe(0);
    });
  });

  describe('discoverSuggestions', () => {
    test('successfully scans seeds, deduplicates, and scores candidates', async () => {
      // Mock auth user's networks (for filtering)
      mockSoundCloudClient.getFollowings.mockResolvedValue([
        { id: 999 }, // already followed
      ]);
      mockSoundCloudClient.getFollowers.mockResolvedValue([
        { id: 888 }, // already follows you
      ]);

      // Seed 1 followers (Path A)
      mockSoundCloudClient.getUserFollowers.mockResolvedValue([
        { id: 101, username: 'user101', followers_count: 100, followings_count: 200, track_count: 1 },
        { id: 999, username: 'user999', followers_count: 50, followings_count: 50, track_count: 0 }, // should be filtered (already followed)
      ]);

      // Seed 1 related (Path B)
      mockSoundCloudClient.getRelatedArtists.mockResolvedValue([
        { id: 102, username: 'user102', followers_count: 20, followings_count: 100, track_count: 3 },
      ]);

      // Track mock for candidate users
      mockSoundCloudClient.getUserTracks.mockResolvedValue([
        { id: 201, title: 'Track 201', likes_count: 42, playback_count: 1000, created_at: '2026-07-08T00:00:00Z' },
      ]);

      const discoverSuggestionsHelper = async (opts) => {
        return growthEngine.discoverSuggestions(opts);
      };

      const result = await discoverSuggestionsHelper({
        inspirationUserIds: [1],
        authUserId: 'user-cuid',
        authSoundCloudId: 50,
        accessToken: 'token',
        refreshToken: 'refresh',
        strategy: 'both',
        limit: 5,
      });

      expect(result.suggestions.length).toBe(2);
      expect(result.suggestions[0].user.id).toBe(102); // higher ratio/score than 101
      expect(result.suggestions[0].suggestedTrack.id).toBe(201);
      expect(result.stats.candidatesScanned).toBe(3); // 101, 999, 102
      expect(result.stats.afterDedup).toBe(2); // 101, 102 (999 filtered)
    });
  });
});
