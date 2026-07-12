import { jest } from '@jest/globals';
import { GrowthEngine, SEED_SAMPLE_MAX } from '../server/lib/growth-engine.js';

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

    test('marks an otherwise mid-range score as limited when SoundCloud omits scene or activity data', () => {
      const user = {
        id: 104,
        username: 'incomplete-profile',
        followers_count: 100,
        followings_count: 400,
        track_count: 5,
      };

      const result = growthEngine.scoreCandidate(user, 2, 3, true);

      expect(result.score).toBeGreaterThanOrEqual(40);
      expect(result.scoreLabel).toBe('limited');
      expect(result.signals.evidence).toEqual({ hasSceneEvidence: false, hasActivityEvidence: false });
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

    const baseOpts = {
      authUserId: 'user-cuid',
      authSoundCloudId: 50,
      accessToken: 'token',
      refreshToken: 'refresh',
      strategy: 'followers',
      limit: 5,
    };

    test('caps each seed crawl at the sample max and threads the deadline', async () => {
      mockSoundCloudClient.getFollowings.mockResolvedValue([]);
      mockSoundCloudClient.getFollowers.mockResolvedValue([]);
      mockSoundCloudClient.getUserFollowers.mockResolvedValue([]);
      mockSoundCloudClient.getRelatedArtists.mockResolvedValue([]);
      mockSoundCloudClient.getUserTracks.mockResolvedValue([]);

      await growthEngine.discoverSuggestions({ ...baseOpts, inspirationUserIds: [1] });

      expect(mockSoundCloudClient.getUserFollowers).toHaveBeenCalledWith(
        1,
        'token',
        'refresh',
        200,
        expect.objectContaining({ maxItems: SEED_SAMPLE_MAX, deadlineAt: expect.any(Number) })
      );
    });

    test('uses preloaded auth lists and skips fetching them', async () => {
      mockSoundCloudClient.getUserFollowers.mockResolvedValue([
        { id: 101, username: 'fresh', followers_count: 100, followings_count: 200, track_count: 1 },
        { id: 999, username: 'followed', followers_count: 50, followings_count: 50, track_count: 2 },
        { id: 888, username: 'follows-you', followers_count: 50, followings_count: 50, track_count: 2 },
      ]);
      mockSoundCloudClient.getRelatedArtists.mockResolvedValue([]);
      mockSoundCloudClient.getUserTracks.mockResolvedValue([]);

      const result = await growthEngine.discoverSuggestions({
        ...baseOpts,
        inspirationUserIds: [1],
        authFollowingIds: [999],
        authFollowerIds: [888],
      });

      expect(mockSoundCloudClient.getFollowings).not.toHaveBeenCalled();
      expect(mockSoundCloudClient.getFollowers).not.toHaveBeenCalled();
      expect(result.suggestions.map((s) => s.user.id)).toEqual([101]);
    });

    test('merges overlapping seed networks deterministically under concurrent crawls', async () => {
      mockSoundCloudClient.getFollowings.mockResolvedValue([]);
      mockSoundCloudClient.getFollowers.mockResolvedValue([]);
      mockSoundCloudClient.getUserFollowers.mockImplementation((seedId) => Promise.resolve([
        { id: 101, username: 'shared', followers_count: 100, followings_count: 100, track_count: 2 },
        { id: 200 + seedId, username: `only-${seedId}`, followers_count: 10, followings_count: 10, track_count: 1 },
      ]));
      mockSoundCloudClient.getRelatedArtists.mockResolvedValue([]);
      mockSoundCloudClient.getUserTracks.mockResolvedValue([]);

      const result = await growthEngine.discoverSuggestions({
        ...baseOpts,
        inspirationUserIds: [1, 2, 3],
        limit: 10,
      });

      const shared = result.suggestions.find((s) => s.user.id === 101);
      expect(shared.signals.sharedInspirationCount).toBe(3);
      expect(result.stats.candidatesScanned).toBe(4); // 101 + one unique per seed
      expect(result.stats.afterDedup).toBe(4);
      expect(result.stats.partial).toBe(false);
    });

    test('returns partial empty results without throwing when the time budget is already spent', async () => {
      mockSoundCloudClient.getFollowings.mockResolvedValue([]);
      mockSoundCloudClient.getFollowers.mockResolvedValue([]);

      const result = await growthEngine.discoverSuggestions({
        ...baseOpts,
        inspirationUserIds: [1, 2],
        timeBudgetMs: 0,
      });

      expect(result.suggestions).toEqual([]);
      expect(result.stats.partial).toBe(true);
      expect(result.stats.perSeed.every((s) => s.skipped)).toBe(true);
      expect(mockSoundCloudClient.getUserFollowers).not.toHaveBeenCalled();
    });

    test('skips candidate track lookups when the budget runs out mid-scan', async () => {
      mockSoundCloudClient.getFollowings.mockResolvedValue([]);
      mockSoundCloudClient.getFollowers.mockResolvedValue([]);
      mockSoundCloudClient.getUserFollowers.mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return [{ id: 101, username: 'late', followers_count: 100, followings_count: 100, track_count: 2 }];
      });
      mockSoundCloudClient.getRelatedArtists.mockResolvedValue([]);
      mockSoundCloudClient.getUserTracks.mockResolvedValue([]);

      const result = await growthEngine.discoverSuggestions({
        ...baseOpts,
        inspirationUserIds: [1],
        timeBudgetMs: 50,
      });

      expect(result.suggestions).toHaveLength(1);
      expect(result.suggestions[0].suggestedTrack).toBeNull();
      // Only the seed-genre lookup ran; the candidate lookup was skipped
      expect(mockSoundCloudClient.getUserTracks).toHaveBeenCalledTimes(1);
      expect(result.stats.partial).toBe(true);
    });

    test('flags sampledFollowers when a seed crawl hits the cap', async () => {
      const capped = Array.from({ length: SEED_SAMPLE_MAX }, (_, i) => ({
        id: 1000 + i,
        username: `u${i}`,
        followers_count: 10,
        followings_count: 10,
        track_count: 1,
      }));
      mockSoundCloudClient.getFollowings.mockResolvedValue([]);
      mockSoundCloudClient.getFollowers.mockResolvedValue([]);
      mockSoundCloudClient.getUserFollowers.mockResolvedValue(capped);
      mockSoundCloudClient.getRelatedArtists.mockResolvedValue([]);
      mockSoundCloudClient.getUserTracks.mockResolvedValue([]);

      const result = await growthEngine.discoverSuggestions({ ...baseOpts, inspirationUserIds: [1] });

      expect(result.stats.sampledFollowers).toBe(true);
      expect(result.stats.perSeed[0]).toMatchObject({
        id: 1,
        followersFetched: SEED_SAMPLE_MAX,
        sampled: true,
        skipped: false,
      });
    });
  });
});
