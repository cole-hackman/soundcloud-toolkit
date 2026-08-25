import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

const findUnique = jest.fn().mockResolvedValue(null);
const create = jest.fn();

jest.unstable_mockModule('../../server/lib/prisma.js', () => ({
  default: { betaSignup: { findUnique, create } },
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
      .send('rekordboxUse=weekly&interest=high&wantsBeta=true');
    // express.json() ignores urlencoded bodies -> req.body empty -> validator rejects
    expect(res.status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });
});
