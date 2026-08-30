import express from 'express';
import prisma from '../lib/prisma.js';
import logger from '../lib/logger.js';
import { safeError } from '../lib/safe-error.js';
import { authenticateUser } from '../middleware/auth.js';
import { validateRebrandVote } from '../middleware/validation.js';

const router = express.Router();

/**
 * The live survey is the rebrand name vote: SC Toolkit has to drop
 * "SoundCloud" from its name to stay inside SoundCloud's API terms, and this
 * asks every logged-in user which replacement they'd pick.
 *
 * The retired SongSwipe beta survey (BetaSignup) and the monetization survey
 * before it (SurveyResponse) are kept read-only for history — see the admin
 * routes.
 */
function getCampaignId() {
  return process.env.SURVEY_CAMPAIGN_ID || '2026-rebrand-name-v1';
}

function isSurveyEnabled() {
  return String(process.env.SURVEY_ENABLED ?? 'true').toLowerCase() !== 'false';
}

function cleanStr(value, max) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return max ? trimmed.slice(0, max) : trimmed;
}

/**
 * GET /api/feedback/survey/status
 * Returns whether the current user has already voted in the current campaign,
 * plus campaign identity and the global kill switch.
 */
router.get('/survey/status', authenticateUser, async (req, res) => {
  try {
    const campaignId = getCampaignId();
    const enabled = isSurveyEnabled();

    const existing = await prisma.rebrandVote.findUnique({
      where: { userId_campaignId: { userId: req.user.id, campaignId } },
      select: { id: true, createdAt: true },
    });

    res.json({
      enabled,
      campaignId,
      submitted: !!existing,
      submittedAt: existing?.createdAt ?? null,
    });
  } catch (error) {
    logger.error('survey status error', safeError(error));
    res.status(500).json(safeError(error, 'Failed to load survey status'));
  }
});

/**
 * POST /api/feedback/survey
 * Records a single rebrand vote per user per campaign.
 */
router.post('/survey', authenticateUser, validateRebrandVote, async (req, res) => {
  try {
    if (!isSurveyEnabled()) {
      return res.status(403).json({ error: 'Survey is currently disabled' });
    }

    const campaignId = getCampaignId();
    const { nameChoice, nameIdea, featureIdea, context } = req.body;

    try {
      const created = await prisma.rebrandVote.create({
        data: {
          userId: req.user.id,
          soundcloudId: req.user.soundcloudId,
          campaignId,
          nameChoice,
          nameIdea: cleanStr(nameIdea, 120),
          featureIdea: cleanStr(featureIdea, 2000),
          context,
        },
        select: { id: true, createdAt: true },
      });

      logger.info('rebrand vote recorded', {
        userId: req.user.id,
        campaignId,
        nameChoice,
        context,
      });

      return res.status(201).json({ success: true, id: created.id, campaignId });
    } catch (err) {
      // Prisma unique constraint violation → already voted in this campaign
      if (err && err.code === 'P2002') {
        return res.status(409).json({ error: 'Already submitted for this campaign', campaignId });
      }
      throw err;
    }
  } catch (error) {
    logger.error('survey submit error', safeError(error));
    res.status(500).json(safeError(error, 'Failed to submit survey response'));
  }
});

export default router;
