import express from 'express';
import prisma from '../lib/prisma.js';
import logger from '../lib/logger.js';
import { safeError } from '../lib/safe-error.js';
import { authenticateUser } from '../middleware/auth.js';
import { validateRebrandVote } from '../middleware/validation.js';

const router = express.Router();

/**
 * The rebrand name vote — CONCLUDED. Track Toolkit won, and the product now
 * ships under that name, so there is nothing left to vote on.
 *
 * The vote is closed in code rather than by an environment variable: the
 * client-side modal is gone, and a vote arriving after the decision would be
 * recorded against a question nobody is asking any more. `SURVEY_ENABLED` can
 * still switch a FUTURE campaign off without a redeploy; it can no longer
 * switch this one back on.
 *
 * Everything already collected is untouched. `RebrandVote` rows stay, and the
 * admin read paths (/api/admin/rebrand and /api/admin/rebrand/summary) still
 * serve the full tally and both write-in fields. Same posture as the retired
 * SongSwipe beta survey (BetaSignup) and the monetization survey before it
 * (SurveyResponse) — read-only for history.
 */
const REBRAND_VOTE_CONCLUDED = true;

/** The name the vote settled on, echoed to clients so a stale build can tell
 *  why the prompt is gone rather than silently retrying. */
const REBRAND_WINNING_NAME = 'Track Toolkit';

function getCampaignId() {
  return process.env.SURVEY_CAMPAIGN_ID || '2026-rebrand-name-v1';
}

function isSurveyEnabled() {
  if (REBRAND_VOTE_CONCLUDED) return false;
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
      concluded: REBRAND_VOTE_CONCLUDED,
      decidedName: REBRAND_VOTE_CONCLUDED ? REBRAND_WINNING_NAME : null,
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
 *
 * `validateRebrandVote` deliberately still runs BEFORE the closed-campaign
 * check. It is what makes a cross-site form post fail with a 400 rather than
 * reaching the handler at all, which is the invariant
 * tests/routes/feedback-authz.test.js guards — see the CSRF section of
 * docs/SECURITY.md. Moving the gate in front of it would quietly retire that
 * coverage along with the vote.
 */
router.post('/survey', authenticateUser, validateRebrandVote, async (req, res) => {
  try {
    if (REBRAND_VOTE_CONCLUDED) {
      return res.status(410).json({
        error: `The name vote has closed — the winner was ${REBRAND_WINNING_NAME}.`,
        concluded: true,
        decidedName: REBRAND_WINNING_NAME,
      });
    }
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
