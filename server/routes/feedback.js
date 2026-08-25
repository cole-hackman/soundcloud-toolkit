import express from 'express';
import prisma from '../lib/prisma.js';
import logger from '../lib/logger.js';
import { safeError } from '../lib/safe-error.js';
import { authenticateUser } from '../middleware/auth.js';
import { validateBetaSignup } from '../middleware/validation.js';

const router = express.Router();

function getCampaignId() {
  return process.env.SURVEY_CAMPAIGN_ID || '2026-songswipe-beta-v1';
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
 * Returns whether the current user has already submitted for the current
 * campaign, plus campaign identity and the global kill switch.
 */
router.get('/survey/status', authenticateUser, async (req, res) => {
  try {
    const campaignId = getCampaignId();
    const enabled = isSurveyEnabled();

    const existing = await prisma.betaSignup.findUnique({
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
 * Records a single SongSwipe beta-signup / feedback response per campaign.
 */
router.post('/survey', authenticateUser, validateBetaSignup, async (req, res) => {
  try {
    if (!isSurveyEnabled()) {
      return res.status(403).json({ error: 'Survey is currently disabled' });
    }

    const campaignId = getCampaignId();
    const {
      email,
      rekordboxUse,
      platform,
      cullMethod,
      featuresWanted,
      editHesitations,
      trustDirectWrite,
      interest,
      wantsBeta,
      wantsCall,
      suggestions,
      nameIdea,
      context,
    } = req.body;

    try {
      const created = await prisma.betaSignup.create({
        data: {
          userId: req.user.id,
          soundcloudId: req.user.soundcloudId,
          campaignId,
          email: cleanStr(email, 254)?.toLowerCase() ?? null,
          rekordboxUse,
          platform: platform ?? null,
          cullMethod: cullMethod ?? null,
          featuresWanted: cleanStr(featuresWanted, 300),
          editHesitations: cleanStr(editHesitations, 300),
          trustDirectWrite: trustDirectWrite ?? null,
          interest,
          wantsBeta: wantsBeta === true,
          wantsCall: wantsCall === true,
          suggestions: cleanStr(suggestions, 2000),
          nameIdea: cleanStr(nameIdea, 120),
          context,
        },
        select: { id: true, createdAt: true },
      });

      logger.info('beta signup recorded', {
        userId: req.user.id,
        campaignId,
        rekordboxUse,
        interest,
        wantsBeta: wantsBeta === true,
        context,
      });

      return res.status(201).json({ success: true, id: created.id, campaignId });
    } catch (err) {
      // Prisma unique constraint violation → already submitted for this campaign
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
