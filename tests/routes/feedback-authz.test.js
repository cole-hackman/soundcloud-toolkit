import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

const findUnique = jest.fn().mockResolvedValue(null);
const create = jest.fn();

jest.unstable_mockModule('../../server/lib/prisma.js', () => ({
  default: { rebrandVote: { findUnique, create } },
}));
jest.unstable_mockModule('../../server/middleware/auth.js', () => ({
  authenticateUser: (req, res, next) => {
    req.user = { id: 'user-a', soundcloudId: 111 };
    next();
  },
}));

const { default: feedbackRoutes } = await import('../../server/routes/feedback.js');

const app = express();
app.use(express.json()); // mirrors prod: express.json() is the ONLY body parser
app.use('/api/feedback', feedbackRoutes);

beforeEach(() => { findUnique.mockClear(); create.mockClear(); });

describe('survey/status binds to the authenticated principal', () => {
  test('client-supplied userId/email in the query cannot select another user', async () => {
    const res = await request(app)
      .get('/api/feedback/survey/status?userId=user-b&email=victim@example.com');
    expect(res.status).toBe(200);
    expect(findUnique).toHaveBeenCalledTimes(1);
    const where = findUnique.mock.calls[0][0].where;
    // The lookup key comes from the session, never from the request
    expect(where.userId_campaignId.userId).toBe('user-a');
  });
});

describe('CSRF invariant: non-JSON bodies fail closed', () => {
  test('a cross-site form-encoded POST cannot submit the survey', async () => {
    const res = await request(app)
      .post('/api/feedback/survey')
      .type('form')
      .send('nameChoice=tracktidy&context=dashboard');
    // express.json() ignores urlencoded bodies -> req.body empty -> validator rejects
    expect(res.status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });
});

describe('the concluded name vote refuses new writes', () => {
  test('a well-formed vote is answered 410 and never reaches the database', async () => {
    const res = await request(app)
      .post('/api/feedback/survey')
      .send({
        userId: 'user-b',
        soundcloudId: 999,
        nameChoice: 'tracktidy',
        context: 'dashboard',
      });
    expect(res.status).toBe(410);
    expect(res.body.concluded).toBe(true);
    expect(res.body.decidedName).toBe('Track Toolkit');
    // The write path is closed, so no body — client-supplied or not — can
    // create a row.
    expect(create).not.toHaveBeenCalled();
  });

  test('an off-shortlist nameChoice is still rejected by the validator, not the gate', async () => {
    // Validation runs first on purpose; a 410 here would mean the CSRF
    // fail-closed invariant above is being served by the gate rather than by
    // express.json() plus the validator.
    const res = await request(app)
      .post('/api/feedback/survey')
      .send({ nameChoice: 'cratekit', context: 'dashboard' });
    expect(res.status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });

  test('status reports the vote as closed and names the winner', async () => {
    const res = await request(app).get('/api/feedback/survey/status');
    expect(res.status).toBe(200);
    expect(res.body.enabled).toBe(false);
    expect(res.body.concluded).toBe(true);
    expect(res.body.decidedName).toBe('Track Toolkit');
  });
});
