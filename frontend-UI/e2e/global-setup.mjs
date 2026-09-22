// Refuse to run against someone else's server.
//
// `webServer.reuseExistingServer` is true so a hand-started harness (and a
// watch loop) does not get killed and restarted between runs. The cost is that
// Playwright adopts ANY process already listening on the port: an orphan from
// an aborted run, or another git worktree's harness serving a different
// checkout's `out/`. It answers `/` with a perfectly healthy 200, so nothing
// in Playwright notices, and the entire suite then runs against stale HTML —
// every failure describing code that is not the code under test. That happened
// on 2026-09-22 and cost an afternoon.
//
// A liveness probe cannot tell the two apart, because both are alive. The
// identity endpoint in static-server.mjs can: it reports the absolute `out/`
// directory being served, which is unique per checkout. If that is not the
// directory this config sits next to, we stop before the first test with the
// command that finds the offending process, rather than after an hour of
// confusing red.
import { fileURLToPath } from "node:url";

const EXPECTED_ROOT = fileURLToPath(new URL("../out/", import.meta.url));

export default async function globalSetup(config) {
  const baseURL = config.projects[0]?.use?.baseURL;
  if (!baseURL) return;
  const port = new URL(baseURL).port;

  let identity;
  try {
    const res = await fetch(new URL("/__e2e/identity", baseURL), {
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) identity = await res.json();
  } catch {
    // Unreachable or not JSON — handled by the same message below.
  }

  const hint =
    `\n  Find it:  lsof -nP -iTCP:${port} -sTCP:LISTEN` +
    `\n  Then kill that PID, or run on another port:  E2E_PORT=<free port> npm run test:e2e\n`;

  if (!identity || identity.harness !== "track-toolkit-e2e") {
    throw new Error(
      `Something other than the e2e static server is listening on port ${port}.` +
        `\nPlaywright would have adopted it and every test would fail against its content.` +
        hint,
    );
  }

  if (identity.root !== EXPECTED_ROOT) {
    throw new Error(
      `The e2e server on port ${port} is serving a different checkout.` +
        `\n  serving:  ${identity.root}  (pid ${identity.pid})` +
        `\n  expected: ${EXPECTED_ROOT}` +
        `\nThis is the stale-orphan case: it is healthy, so reuseExistingServer adopted it,` +
        `\nand the suite would have run against that build instead of this one.` +
        hint,
    );
  }
}
