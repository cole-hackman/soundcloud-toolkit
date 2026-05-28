import express from 'express';
import prisma from '../lib/prisma.js';
import logger from '../lib/logger.js';
import { safeError } from '../lib/safe-error.js';
import { authenticateUser } from '../middleware/auth.js';
import { validateSurveySubmit } from '../middleware/validation.js';

const router = express.Router();

function getCampaignId() {
  return process.env.SURVEY_CAMPAIGN_ID || '2026-sustainability-v1';
}

function isSurveyEnabled() {
  return String(process.env.SURVEY_ENABLED ?? 'true').toLowerCase() !== 'false';
}

const CONTEXT_TO_ACTION = {
  'post-merge': 'merge',
  'post-from-likes': 'from-likes',
  'dashboard': null,
};

/**
 * GET /api/feedback/survey/status
 * Returns whether the current user has already submitted for the current
 * campaign, plus campaign identity and the global kill switch.
 */
router.get('/survey/status', authenticateUser, async (req, res) => {
  try {
    const campaignId = getCampaignId();
    const enabled = isSurveyEnabled();

    const existing = await prisma.surveyResponse.findUnique({
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
    logger.error({ err: error.message }, 'survey status error');
    res.status(500).json(safeError(error, 'Failed to load survey status'));
  }
});

/**
 * POST /api/feedback/survey
 * Records a single survey response for the current campaign.
 */
router.post('/survey', authenticateUser, validateSurveySubmit, async (req, res) => {
  try {
    if (!isSurveyEnabled()) {
      return res.status(403).json({ error: 'Survey is currently disabled' });
    }

    const campaignId = getCampaignId();
    const { preference, lifetimeInterest, comment, context, trackCount } = req.body;

    const operationAction = CONTEXT_TO_ACTION[context] ?? null;

    try {
      const created = await prisma.surveyResponse.create({
        data: {
          userId: req.user.id,
          soundcloudId: req.user.soundcloudId,
          campaignId,
          preference,
          lifetimeInterest: lifetimeInterest ?? null,
          comment: comment?.trim() ? comment.trim() : null,
          context,
          operationAction,
          trackCount: typeof trackCount === 'number' ? trackCount : null,
        },
        select: { id: true, createdAt: true },
      });

      logger.info({
        userId: req.user.id,
        campaignId,
        preference,
        lifetimeInterest,
        context,
      }, 'survey response recorded');

      return res.status(201).json({ success: true, id: created.id, campaignId });
    } catch (err) {
      // Prisma unique constraint violation → already submitted for this campaign
      if (err && err.code === 'P2002') {
        return res.status(409).json({ error: 'Already submitted for this campaign', campaignId });
      }
      throw err;
    }
  } catch (error) {
    logger.error({ err: error.message }, 'survey submit error');
    res.status(500).json(safeError(error, 'Failed to submit survey response'));
  }
});

export default router;
