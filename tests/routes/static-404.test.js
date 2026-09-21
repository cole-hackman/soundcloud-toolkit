/**
 * Static site serving — skeleton only.
 *
 * Task 1 (Phase 0 harness) adds this file so the suite it belongs to exists
 * before Task 2 changes `server/index.js` to serve `frontend-UI/out/404.html`
 * with a real 404 status (today it falls back to root `index.html` for any
 * unmatched route) and adds the `/sc-toolkit` legacy redirect. Task 2 fills
 * these in; see `e2e/a11y.spec.ts` for the equivalent behavior already
 * exercised against the static export directly.
 */
describe('static site serving', () => {
  test.todo('serves out/404.html with status 404 for unknown paths');
  test.todo('301s /sc-toolkit to /faq/#rebrand');
});
