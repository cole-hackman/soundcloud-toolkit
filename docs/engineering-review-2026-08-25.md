# SC Toolkit — Engineering Review & Remediation Plan

## Context

Cole is preparing this repo as a portfolio project for recruiters and senior engineers. An external reviewer raised concerns about authorization (IDOR via client-supplied IDs), a 3,000+ line route file, stale docs, logging overhead, hard-coded behavior, unsupported public claims, and "vibe-coded" appearance. This review validated every criticism against the actual repository using three parallel investigation agents plus an independent adversarial verifier, and ran the full test suite (17 suites, 138 tests, all green, 1.8s).

**Verdict: the repo is closer to showcase-ready than the reviewer suggested.** The reviewer's headline security concern (IDOR in feedback.js) is **refuted** — two independent passes confirmed every route binds to `req.user`, and admin auth fails closed. No critical vulnerabilities exist. The real blockers are: (1) developer docs (CLAUDE.md/AGENTS.md) describe an architecture that no longer exists, (2) the landing page's "Trusted by 2,000+ DJs & producers" claim is unbacked and contradicts the README's verified numbers, and (3) zero route-level integration tests — all 138 tests are lib unit tests.

---

## 1. Executive Assessment

| Dimension | Assessment |
|---|---|
| **Portfolio readiness** | ~80%. Security fundamentals are sound and verifiable; production data analysis (ANALYSIS.md) is a genuine differentiator. Blockers are docs accuracy, one unbacked public claim, and missing integration tests. |
| **Highest-risk confirmed issue** | No fetch timeouts in `soundcloud-client.js` (requests can hang indefinitely — MEDIUM). Session hygiene cluster (non-constant-time HMAC compare, no expiry in signed payload, no server-side revocation) is MEDIUM and cheap to fix. |
| **Most important maintainability problem** | `api.js` intra-file duplication (7 inline `sleep()` definitions, 3× duplicated followed-library pagination, inline normalizers/cache) + dead `.ts` files + zero route tests. Size itself is not the problem. |
| **Strongest existing quality** | Correct authorization binding throughout; AES-256-GCM/PKCE/HMAC done right; 429 Retry-After + cursor pagination + deadline budgets in the SC client; ANALYSIS.md (9,235 production logs analyzed, 5 bugs found → all fixed in commit cc416ad with the fixes verifiable in current code). |
| **Biggest resume-evidence opportunity** | Replace the unsupported "400K+ tracks/month" with the documented "1.1M+ tracks processed all-time (Aug 2026)"; lead with the production-log analysis and merge-at-scale story (44% user reach, 624K tracks). |

---

## 2. Reviewer Feedback Validation

| Reviewer concern | Status | Severity | Evidence | Recommended action |
|---|---|---|---|---|
| IDOR: routes trust client-supplied user IDs/emails (feedback.js `/survey/status`) | **Not confirmed (refuted twice)** | — | `feedback.js:36,82` use `req.user.id`; DB unique `(userId, campaignId)`; `assertFollowedUser()` gates target-user routes (`api.js:326-335`); admin routes all have `adminAuth`, fails closed 403 when `ADMIN_IDS` unset (`adminAuth.js:16-17`) | Add authz regression tests to *prove* it and prevent regressions (P0) |
| `api.js` >3,000 lines mixing domains | **Partially confirmed** | Medium (maintainability) | 3,234 lines, ~18 route families — but business logic already lives in ~23 `server/lib/` modules; real issues: 7× inline `sleep()`, 3× duplicated pagination (`api.js:1647-1751`), inline normalizers (183-320) and resolve cache (117-181) | Smallest split: extract growth routes + normalizers + shared pacing; no service layer (§4) |
| Stale docs (CLAUDE.md, AGENTS.md, NOTES.md, README-QUESTIONS.md) | **Confirmed** | High (perception) | CLAUDE.md claims "ALL route handlers" in api.js (there are 4 route files), references nonexistent `server/utils/`, documents 2 DB tables (schema has 9-11); AGENTS.md duplicates the same stale content; README-QUESTIONS.md is a legit open-questions file needing Cole's input | Rewrite CLAUDE.md, delete/stub AGENTS.md, resolve the 4 questions (§6) |
| Logger over-sanitizes / performance overhead | **Not confirmed (perf); partially confirmed (gaps)** | Low | Redaction ~1ms/call, depth-capped at 10; the only measurable cost is `preventKeyLeakage` re-serialization (unmeasured, est. 5-50ms/response). Real gap: `logger.info` message string bypasses `sanitizeString()` (`logger.js:182`); regex misses `?oauth_token=` in URLs. No actual leak found at any current call site | Sanitize message on all levels; add URL-token pattern; optional benchmark (§8 Phase 4) |
| Hard-coded behavior (`await sleep(300)`) | **Partially confirmed** | Low-Medium | `sleep()` defined inline 7× in api.js + 4 lib modules; delays 150ms–5s scattered. Counter-evidence: growth caps, cache TTLs, rate limits are already named constants | One shared sleep + named pacing constants; do NOT extract every literal |
| Unsupported public claims | **Confirmed (one claim)** | High (credibility) | `page.tsx:339` "Trusted by 2,000+ DJs & producers" — unbacked (STATE.md itself flags it) and contradicts README's verified "3,155 registered users". README numbers ARE supported by ANALYSIS.md methodology. Resume's "400K+ tracks/month" is unsupported | Replace landing line with verified figure; fix resume claim (§7) |
| "Vibe coded" / lacks engineering ownership | **Subjective; objective signals mixed** | Medium | Real signals: stale docs, dead `session.ts`/`pkce.ts`/`crypto.ts`, unused `MonetizationSurveyModal.tsx`, `verify_sc_user.js` debug script, `/api/reposts/debug` endpoint. Strong counter-evidence: ANALYSIS.md, incident post-mortem, NOTES.md lessons, STATE.md decision log, 138 passing tests | Dead-code sweep + docs accuracy closes the gap |
| Session/OAuth/crypto custom code | **Mostly sound; hygiene gaps** | Medium | AES-256-GCM correct (fresh 12-byte IV, auth tag, AAD); PKCE correct; HMAC compare is `!==` not `timingSafeEqual` (`session.js:38`, impractical to exploit remotely — downgraded from HIGH); no expiry inside signed payload; no server-side revocation; CSRF mitigated *by accident* (JSON-only body parser + validation fail closed; verified on bulk-unlike, merge, account-delete) | timingSafeEqual + payload `iat/exp` + Origin-check middleware + document the invariant |

---

## 3. Critical Findings (materially affecting security, correctness, reliability, or perception)

1. **Zero route-level integration tests.** All 138 tests are lib unit tests; nothing exercises Express routes, auth middleware, admin boundary, or the OAuth callback. For a repo whose selling point is security engineering, the authz correctness is unproven-by-test. → Add supertest harness + P0 tests (§5). *This is the single highest-leverage engineering improvement.*
2. **No fetch timeouts** (`soundcloud-client.js:141,279,383,394` — no AbortController anywhere; `deadlineAt` only bounds the pagination loop between pages). A hung SC API call blocks the request indefinitely. → 30s AbortController timeout in `scRequest()`/`paginate()`/`resolveAny()` + unit test.
3. **Session hygiene cluster** (`session.js:38`): non-constant-time signature compare (hygiene, not practically exploitable); no `iat`/`exp` inside the signed payload (cookie maxAge is the only lifetime control — a stolen cookie is valid 7 days with no revocation path). → `crypto.timingSafeEqual` + add issued-at/expiry to payload; verify on unsign. Server-side revocation is optional (out of scope — would need a session table; document as known limitation instead).
4. **CSRF is mitigated by accident, not design.** `express.json()` is the only body parser, so cross-site form posts produce empty `req.body` and validators fail closed (verified against bulk-unlike, merge, account-delete; logout is idempotent; no state-changing GETs). This invariant is undocumented and one `express.urlencoded()` away from breaking. → Add a small Origin-check middleware for state-changing methods + a comment/doc stating the invariant + a regression test posting form-encoded bodies.
5. **Stale developer docs** — CLAUDE.md/AGENTS.md describe a one-file backend with a 2-table schema. A senior reviewer reading docs-then-code concludes the docs are dead. → §6.
6. **Unbacked landing claim** — `page.tsx:339`. Directly contradicts the repo's own "no fabricated social proof" decision in STATE.md. → Replace with verified number (needs Cole's copy choice).
7. **Dead code**: `server/lib/session.ts` + `pkce.ts` (real implementations, never imported — actively misleading), `crypto.ts` (stub), `MonetizationSurveyModal.tsx` (unused), `server/verify_sc_user.js` (debug script), `/api/reposts/debug` (diagnostic endpoint in prod). → Delete (keep `/reposts/debug` only if still used operationally — ask Cole; default: delete).
8. **Logger gap**: `logger.info` path logs the raw message string unsanitized (`logger.js:182`); patterns miss URL-embedded tokens. No current call site leaks, but the API permits it. → Sanitize message across all levels + add `[?&]oauth_token=\S+` style pattern + test.

**Verified non-issues worth knowing:** the claimed SQL injection at `admin.js:548` is refuted (`Prisma.sql` binds the concatenated value as a parameter; `Prisma.raw` only ever receives the `Object.hasOwn`-whitelisted sort key); all 4 production bugs documented in ANALYSIS.md (clone ReferenceError, bulk-like silent success, playlist-compare metadata, growth-reverse labeling) are already fixed in current main (commit cc416ad, verified in code); `.env` is not tracked in git; no hardcoded secrets found; token-refresh race exists but is LOW (single-threaded Node, rare dual-401, transient impact).

---

## 4. Architecture Remediation (smallest useful change)

**Problem:** not file size — intra-file duplication and untestable inline helpers in `api.js`.

**Target:** `api.js` stays the route index for core tools; extract only what's duplicated or independently testable:

| Move | From → To | Lines saved / gained |
|---|---|---|
| Growth routes (the one clean domain: `/growth/*`, ~520 lines) | `api.js:2710-3231` → `server/routes/growth.js` | api.js → ~2,700 |
| Resource normalizers (4 fns) | `api.js:183-320` → `server/lib/normalize.js` | testable, −140 |
| Shared `sleep` + named pacing constants (`PLAYLIST_BATCH_DELAY_MS` etc.) | 7 inline defs in api.js + 4 lib copies → `server/lib/pacing.js` | consistency |
| Followed-library pagination (3 near-identical handlers) | `api.js:1647-1751` → one parameterized helper | −70 |
| Resolve cache (TTL map + prune/set) | `api.js:117-181` → lib module (pattern-match existing `request-cache.js`) | testable, −65 |

**Do NOT change:** the existing `server/lib/` module layout (it's good), route registration style, error-handling pattern (consistent try/catch → logger → status json), Prisma usage, no service classes / DI / repositories.

**Safe migration order:** pacing module first (mechanical), then normalizers, then resolve cache, then pagination helper, then growth route split last (biggest diff, purely mechanical move). Full test suite between each.

---

## 5. Test Gaps

**P0 — before showcasing** (requires adding supertest as a devDependency + a small Express app harness):
1. Admin boundary: non-admin → 403; `ADMIN_IDS` unset → 403 (fails closed); admin → 200.
2. Authz regression: `/survey/status` returns only the authenticated user's row; `assertFollowedUser` → 403 for non-followed target. (Directly answers the external reviewer.)
3. OAuth callback: happy path sets signed cookie + upserts user; PKCE verifier mismatch → error; missing code → 400.
4. Session: sign/unsign round-trip, tampered signature rejected, expired payload rejected (after `iat/exp` fix).

**P1 — meaningful quality improvement:**
5. CSRF fail-closed: form-encoded POST to bulk-unlike/merge → 400 (locks in the invariant).
6. Token refresh through `authenticateUser` middleware (mock SC 401 → refresh → retry → DB updated).
7. Fetch timeout: mocked hanging fetch aborts at deadline.
8. Logger: message-string sanitization on all levels; URL-token pattern.

**P2 — optional:** resolve-cache eviction/max-entries; rate-limiter config assertions; growth cooldown route-level enforcement; bulk-op partial-failure logging regression (fix already shipped; test cements it).

---

## 6. Documentation Cleanup

| Doc | Action |
|---|---|
| CLAUDE.md | Rewrite structure/architecture sections: 4 route files, `server/lib/` (23 modules), full schema (User, Token, OperationLog, SurveyResponse, BetaSignup, GrowthAction, Track, Playlist + cross-branch tables), current endpoint inventory. Keep the good flow/security sections. |
| AGENTS.md | Delete, or reduce to a pointer at CLAUDE.md (two parallel stale copies is worse than one). Recommend: pointer stub. |
| README.md | Keep (recently rewritten, evidence-first, accurate). Refresh stats to Cole's current figures (2026-08-25): **3,570 lifetime users, 2,032,233 tracks processed**. Add: 1-line problem provenance (**needs Cole**), LICENSE reference, numbers attribution ("from production operation_log export, as of 2026-08-25"). |
| README-QUESTIONS.md | Resolve its 4 items (provenance sentence, LICENSE choice — MIT recommended, landing-claim alignment, traction attribution), then delete the file. |
| Landing `page.tsx:339` | Replace "Trusted by 2,000+ DJs & producers" with a verifiable line (recommend: "3,500+ registered users", backed by Cole's 2026-08-25 figure of 3,570). **Needs Cole's final copy approval** — settled decisions in STATE.md (headline, animations) remain untouched. |
| LICENSE | Add (MIT recommended for a portfolio repo). **Needs Cole's confirmation.** |
| STATE.md | Refresh after this work (it's July-dated; main has moved). |
| ANALYSIS.md, NOTES.md, DATA-COLLECTION.md, docs/incident-*, docs/SECURITY.md | **Keep** — these are assets. Minor: SECURITY.md gains a paragraph documenting the CSRF invariant + session lifetime limitation; archive `docs/privacy-policy-draft-2026-08.md` if live page supersedes it. |

Minimum accurate set going forward: README.md, CLAUDE.md, STATE.md, docs/SECURITY.md, ANALYSIS.md.

---

## 7. Resume Evidence Report

| Claim | Classification | Evidence / correction |
|---|---|---|
| Full-stack toolkit (Next.js 15, Express, PostgreSQL, Prisma) | **PROVEN** | Repo structure; live deploy |
| OAuth2 + PKCE | **PROVEN** | `routes/auth.js`, `lib/pkce.js` |
| AES-256-GCM token encryption (12-byte IV, auth tag, AAD) | **PROVEN** | `lib/crypto.js` |
| HMAC-SHA256 signed HttpOnly sessions | **PROVEN** | `lib/session.js` |
| Automatic token refresh on 401 | **PROVEN** | `soundcloud-client.js` + tests |
| Rate limiting (per-IP tiers + server-enforced growth caps 50/24h) | **PROVEN** | `rateLimiter.js`, `growth-engine.js` |
| CORS allowlist + Helmet | **PROVEN** | `server/index.js` |
| 3,100+ registered users | **EXTERNAL (documented)** | Cole's 2026-08-25 production figure: **3,570 lifetime users**. Claim "3,500+ registered users (as of Aug 2026)". Repo artifact (README/ANALYSIS.md, currently 3,155 as of Aug 8) to be refreshed in Phase 3 so the resume claim stays repo-verifiable |
| **400K+ tracks processed/month** | **EXTERNAL — verify before claiming** | Cole's 2026-08-25 figure: **2,032,233 tracks all-time** vs README's documented 1,125,105 (Aug 8) — a ~900K delta in ~17 days that, if both figures come from the same operation_log methodology, would support 400K+/month. Verify with a refreshed export documented in ANALYSIS.md before putting it on the resume; the always-safe form is "2M+ tracks processed all-time (Aug 2026)" |
| 429 Retry-After backoff + cursor pagination + time budgets | **PROVEN** (stronger than current claims) | `soundcloud-client.js:178-192,266-323` + `soundcloud-client.test.js` |
| Production log analysis → 5 bugs found and fixed | **PROVEN** | ANALYSIS.md (9,235 logs) + commit cc416ad fixes verified in code — *best bullet in the repo* |
| Merge auto-split at scale (44% user reach, 624K tracks) | **EXTERNAL (documented)** | ANALYSIS.md §3 |
| Concurrent-refresh mutex, request timeouts | **UNSUPPORTED today** → becomes PROVEN after Phase 1 fixes |
| MEASURABLE candidates | Logger/preventKeyLeakage overhead benchmark; merge throughput (tracks/min) — derivable from existing `durationMs` in operation logs |

**Top 5 defensible bullets:** (1) production data audit → bug fixes shipped; (2) merge engine with 500-track auto-split, dedup, pacing — 44% reach / 624K tracks; (3) OAuth2+PKCE proxy with AES-256-GCM at-rest tokens and transparent refresh; (4) reliability engineering vs undocumented SC rate limits (Retry-After, backoff, cursor pagination, time budgets); (5) server-enforced anti-abuse caps on the growth feature with 17.4% measured follow-back rate.

---

## 8. Remediation Roadmap

**Phase 0 — Verify: COMPLETE (this review).** SQLi refuted, IDOR refuted, ANALYSIS.md bugs confirmed fixed, tests green, `.env` untracked. No remaining runtime verification blocks the plan.

**Phase 1 — Harden + prove (security hygiene with tests).**
Objective: close the four hygiene gaps, each landing with its regression test.
Files: `lib/session.js`, `lib/logger.js`, `lib/soundcloud-client.js`, `middleware/security.js`, `server/index.js`, new `tests/routes/*` harness (supertest).
Acceptance: timingSafeEqual + payload iat/exp; Origin-check middleware; fetch timeouts; logger message sanitization; P0 tests 1–4 + P1 5,7,8 green; full suite green.
Risk: session payload change invalidates existing sessions on deploy (users re-login once — acceptable; note in deploy notes).

**Phase 2 — Simplify (dead code + smallest extractions).**
Objective: remove misleading artifacts; execute §4 in the stated order.
Acceptance: `git grep` shows no imports of deleted files; api.js ≈ 2,600–2,700 lines; suite green after each step; no behavior change.
Risk: mechanical move errors — mitigated by per-step test runs and small commits.

**Phase 3 — Document.**
Objective: §6 in full. Blocked-on-Cole items: provenance sentence, LICENSE, landing copy.
Acceptance: CLAUDE.md matches tree; AGENTS.md resolved; README-QUESTIONS.md deleted; landing claim verifiable; STATE.md refreshed via /handoff.
Risk: landing copy is outward-facing — deploy + /verify-deploy per global rules.

**Phase 4 — Measure (optional, only where it changes a decision).**
Logger/preventKeyLeakage micro-benchmark (decides whether to keep re-serialization middleware as-is); merge throughput from existing operation-log `durationMs` (resume metric). Skip anything else.

**Phase 5 — Portfolio polish.**
Final sweep: README top section links ANALYSIS.md + SECURITY.md; confirm no TODO/debug remnants; run full suite + frontend build; /verify-deploy the landing change.

## 9. Commit Plan (small, reviewable; behavior-changing commits marked ⚠)

1. `test: add supertest harness + admin/authz boundary tests` — tests only
2. `fix(session): timingSafeEqual + iat/exp in signed payload` ⚠ (sessions reissued) — with tests
3. `fix(security): Origin check middleware for state-changing methods; document CSRF invariant` ⚠ — with form-encoded regression test
4. `fix(client): AbortController timeouts in scRequest/paginate/resolveAny` ⚠ — with test
5. `fix(logger): sanitize message on all levels; URL-token pattern` — with test
6. `chore: remove dead files (session.ts, pkce.ts, crypto.ts, MonetizationSurveyModal, verify_sc_user.js)` — no behavior change
7. `refactor: shared pacing module (sleep + named delay constants)` — no behavior change
8. `refactor: extract normalizers to lib/normalize.js; resolve cache to lib` — with unit tests
9. `refactor: consolidate followed-library pagination; extract routes/growth.js` — no behavior change
10. `docs: rewrite CLAUDE.md; AGENTS.md → pointer; SECURITY.md invariants`
11. `docs: README provenance/attribution + LICENSE; delete README-QUESTIONS.md` (needs Cole's inputs)
12. `fix(landing): replace unbacked social-proof line` ⚠ (needs Cole's copy) — then /verify-deploy

## 10. First 10 Actions

1. Get Cole's two remaining inputs: LICENSE choice (MIT?) and problem-provenance sentence. (Stats received 2026-08-25: 3,570 users / 2,032,233 tracks; landing copy defaults to "3,500+ registered users" unless Cole overrides.)
2. Commit 1 — supertest harness + admin fail-closed + `/survey/status` authz regression tests (answers the reviewer with proof).
3. Commit 2 — session timingSafeEqual + iat/exp.
4. Commit 3 — Origin-check middleware + CSRF invariant doc + test.
5. Commit 4 — fetch timeouts.
6. Commit 5 — logger sanitization fix.
7. Commit 6 — dead-code sweep (decide `/api/reposts/debug` fate with Cole; default delete).
8. Commits 7–9 — the four small extractions, test-run between each.
9. Commits 10–11 — docs rewrite + README/LICENSE.
10. Commit 12 — landing claim fix, deploy, /verify-deploy, then /handoff to refresh STATE.md.

---

## Phase 4 Results (measured 2026-08-25)

Benchmark: `scripts/bench-logger.js`, 20,000 iterations per case, Node
production mode, output suppressed. Figures recorded from Run 2 (representative middle run of three).

| Case | µs/op |
|---|---|
| `logger.info`, clean message | 0.77 |
| `logger.info`, message containing secrets | 1.30 |
| `logger.info`, message + 50-item payload | 227.28 |
| `preventKeyLeakage` on a 50-track response | 82.89 |

**Typical per-request cost:** 0.084 ms.

Run-to-run spread across 3 runs on the same machine: payload case ~227–233 µs/op, middleware case ~82–84 µs/op. Single-run figures above; the decision is insensitive to this spread.

**Decision:** keep `preventKeyLeakage` as-is — the combined cost of one sanitized log (0.77 µs) plus one wrapped JSON response (82.89 µs) totals 83.66 µs per typical request, or ~0.084 ms. This is negligible compared to network latency and SoundCloud API calls (typically 100–500ms per request). The re-serialization does no material harm and is cheap enough to leave unoptimized indefinitely.

**Merge throughput** (the other Phase 4 candidate) is NOT measured here: it
requires a production `operation_log` export, which is a Cole action, not a
repo action. See "What I Need From Cole" in
`docs/superpowers/plans/2026-08-25-audit-completion.md`.
