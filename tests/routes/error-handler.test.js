import express from 'express';
import request from 'supertest';
import { errorHandler } from '../../server/middleware/errorHandler.js';

// Mounts the actual global error handler (extracted from index.js) on a
// bare app with a throwing route, so this exercises the real middleware
// rather than a re-implementation of it.
const app = express();
app.get('/boom', (req, res, next) => {
  next(new Error('kaboom'));
});
app.get('/teapot', (req, res, next) => {
  const err = new Error('short and stout');
  err.status = 418;
  next(err);
});
app.use(errorHandler);

describe('global error handler', () => {
  test('a 5xx payload carries the support email', async () => {
    const res = await request(app).get('/boom');
    expect(res.status).toBe(500);
    expect(res.body.support).toBe('tracktoolkit@gmail.com');
  });

  test('a non-5xx payload does not carry a support field', async () => {
    const res = await request(app).get('/teapot');
    expect(res.status).toBe(418);
    expect(res.body.support).toBeUndefined();
  });
});
