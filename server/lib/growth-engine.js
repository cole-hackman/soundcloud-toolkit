import logger from './logger.js';
import prisma from './prisma.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export class GrowthEngine {
  constructor(soundcloudClient) {
    this.soundcloudClient = soundcloudClient;
  }

  /**
   * Run the discovery algorithm to find suggested follow candidates
   */
  async discoverSuggestions({
    inspirationUserIds,
    authUserId,
    authSoundCloudId,
    accessToken,
    refreshToken,
    strategy = 'followers',
    limit = 50,
  }) {
    logger.info(`[GrowthEngine] Starting discovery for user ${authUserId} (${authSoundCloudId}) with strategy=${strategy}, limit=${limit}`);

    // 1. Fetch authenticated user's followings and followers for filtering
    // In order to not slow down the request, we can get these from the DB caches or fetch them.
    // However, since we need accurate filtering, we can check our database or just fetch them.
    // Wait, the client already has `getFollowings` and `getFollowers` which fetch paginated collections.
    // Let's use soundcloudClient to fetch them, or fetch from DB if we cache them.
    // To be fast and accurate, let's attempt to fetch them. If they fail, we proceed with empty sets.
    let authFollowingsSet = new Set();
    let authFollowersSet = new Set();

    try {
      logger.info(`[GrowthEngine] Fetching auth user's followings for deduplication`);
      const followings = await this.soundcloudClient.getFollowings(accessToken, refreshToken);
      followings.forEach(u => authFollowingsSet.add(u.id));
      logger.info(`[GrowthEngine] Found ${authFollowingsSet.size} existing followings`);
    } catch (err) {
      logger.error(`[GrowthEngine] Failed to fetch auth user's followings:`, err);
    }

    try {
      logger.info(`[GrowthEngine] Fetching auth user's followers for deduplication`);
      const followers = await this.soundcloudClient.getFollowers(accessToken, refreshToken);
      followers.forEach(u => authFollowersSet.add(u.id));
      logger.info(`[GrowthEngine] Found ${authFollowersSet.size} existing followers`);
    } catch (err) {
      logger.error(`[GrowthEngine] Failed to fetch auth user's followers:`, err);
    }

    const candidateMap = new Map(); // id -> { user, appearances: Set, isRelated: boolean }

    // 2. Fetch candidates from inspiration users
    for (const inspId of inspirationUserIds) {
      logger.info(`[GrowthEngine] Crawling network for inspiration user: ${inspId}`);

      // Path A: Fetch followers
      if (strategy === 'followers' || strategy === 'both') {
        try {
          const followers = await this.soundcloudClient.getUserFollowers(inspId, accessToken, refreshToken, 200);
          logger.info(`[GrowthEngine] Path A: Found ${followers.length} followers for inspiration ${inspId}`);
          for (const u of followers) {
            if (!candidateMap.has(u.id)) {
              candidateMap.set(u.id, { user: u, appearances: new Set(), isRelated: false });
            }
            candidateMap.get(u.id).appearances.add(inspId);
          }
        } catch (err) {
          logger.error(`[GrowthEngine] Path A crawl failed for user ${inspId}:`, err);
        }
        await sleep(300); // Respect rate limits
      }

      // Path B: Fetch related artists
      try {
        const related = await this.soundcloudClient.getRelatedArtists(inspId, accessToken, refreshToken, 20);
        logger.info(`[GrowthEngine] Path B: Found ${related.length} related artists for inspiration ${inspId}`);
        for (const u of related) {
          if (!candidateMap.has(u.id)) {
            candidateMap.set(u.id, { user: u, appearances: new Set(), isRelated: true });
          } else {
            candidateMap.get(u.id).isRelated = true;
          }
          candidateMap.get(u.id).appearances.add(inspId);
        }
      } catch (err) {
        logger.error(`[GrowthEngine] Path B crawl failed for user ${inspId}:`, err);
      }
      await sleep(300); // Respect rate limits
    }

    const candidates = Array.from(candidateMap.values());
    logger.info(`[GrowthEngine] Total unique candidates found across all paths: ${candidates.length}`);

    // 3. Filter candidates
    const filteredCandidates = candidates.filter(({ user }) => {
      // Exclude self
      if (user.id === authSoundCloudId) return false;
      // Exclude already followed
      if (authFollowingsSet.has(user.id)) return false;
      // Exclude already following you (optional: if you want new connections, but we filter to be clean)
      if (authFollowersSet.has(user.id)) return false;
      // Filter out obvious spam/inactive bots (0 followers AND 0 tracks)
      if ((user.followers_count || 0) === 0 && (user.track_count || 0) === 0) return false;
      
      return true;
    });

    logger.info(`[GrowthEngine] Candidates remaining after filtering: ${filteredCandidates.length}`);

    // 4. Score candidates
    const scoredSuggestions = filteredCandidates.map(({ user, appearances, isRelated }) => {
      const scoreData = this.scoreCandidate(user, appearances.size, inspirationUserIds.length, isRelated);
      return {
        user: {
          id: user.id,
          username: user.username,
          avatar_url: user.avatar_url,
          permalink_url: user.permalink_url,
          followers_count: user.followers_count || 0,
          followings_count: user.followings_count || 0,
          track_count: user.track_count || 0,
        },
        score: scoreData.score,
        scoreLabel: scoreData.scoreLabel,
        signals: scoreData.signals,
      };
    });

    // 5. Sort by score descending and limit
    scoredSuggestions.sort((a, b) => b.score - a.score);
    const topSuggestions = scoredSuggestions.slice(0, limit);

    // 6. Fetch best track for top suggestions
    logger.info(`[GrowthEngine] Fetching best tracks for top ${topSuggestions.length} candidates`);
    const results = [];
    for (const sug of topSuggestions) {
      let suggestedTrack = null;
      try {
        const tracks = await this.soundcloudClient.getUserTracks(sug.user.id, accessToken, refreshToken, 5);
        if (tracks && tracks.length > 0) {
          // Sort by likes descending, or falls back to most recent (which is order returned by API)
          const sortedTracks = [...tracks].sort((a, b) => (b.likes_count || 0) - (a.likes_count || 0));
          const best = sortedTracks[0];
          suggestedTrack = {
            id: best.id,
            title: best.title,
            artwork_url: best.artwork_url || sug.user.avatar_url,
            likes_count: best.likes_count || 0,
            playback_count: best.playback_count || 0,
            permalink_url: best.permalink_url,
            created_at: best.created_at,
          };
        }
      } catch (err) {
        logger.debug(`[GrowthEngine] Failed to fetch tracks for candidate ${sug.user.id}: ${err.message}`);
      }

      results.push({
        ...sug,
        suggestedTrack,
      });

      // Avoid hitting rate limits
      await sleep(150);
    }

    return {
      suggestions: results,
      stats: {
        inspirationUsers: inspirationUserIds.length,
        candidatesScanned: candidates.length,
        afterDedup: filteredCandidates.length,
        suggestionsReturned: results.length,
      },
    };
  }

  /**
   * Score a single candidate based on network overlap and counts
   */
  scoreCandidate(user, appearancesCount, totalInspirations, isRelated) {
    const followers = user.followers_count || 0;
    const followings = user.followings_count || 0;
    const tracks = user.track_count || 0;

    // A. Following-to-Follower Ratio Score (30%)
    // High ratio means they follow a lot of people compared to their followers.
    const ratio = followers > 0 ? followings / followers : followings;
    const clampedRatio = Math.min(Math.max(ratio, 0), 5); // clamp at 5
    const ratioScore = clampedRatio / 5.0;

    // B. Shared Network Overlap Score (25%)
    const overlapScore = totalInspirations > 0 ? appearancesCount / totalInspirations : 0;

    // C. related artists boost (15%)
    const relatedBoost = isRelated ? 1.0 : 0.0;

    // D. Creator Signal Score (15%)
    const creatorScore = tracks > 0 ? Math.min(tracks / 10, 1.0) : 0.0;

    // E. Activity Recency (15%)
    // Check user's last_modified if available
    let activityScore = 0.5; // neutral default
    if (user.last_modified) {
      try {
        const modifiedDate = new Date(user.last_modified);
        const diffMs = Date.now() - modifiedDate.getTime();
        const diffDays = diffMs / (1000 * 60 * 60 * 24);
        if (diffDays < 30) activityScore = 1.0;
        else if (diffDays < 90) activityScore = 0.5;
        else activityScore = 0.1;
      } catch {
        activityScore = 0.5;
      }
    }

    // Weighted combination
    const rawScore =
      (ratioScore * 0.30) +
      (overlapScore * 0.25) +
      (relatedBoost * 0.15) +
      (creatorScore * 0.15) +
      (activityScore * 0.15);

    // Normalize to 0-100 scale
    const score = Math.round(rawScore * 100);

    let scoreLabel = 'low';
    if (score >= 70) scoreLabel = 'high';
    else if (score >= 40) scoreLabel = 'medium';

    return {
      score,
      scoreLabel,
      signals: {
        followBackRatio: Math.round(ratio * 100) / 100,
        sharedInspirationCount: appearancesCount,
        isRelatedArtist: isRelated,
        isCreator: tracks > 0,
      },
    };
  }
}
