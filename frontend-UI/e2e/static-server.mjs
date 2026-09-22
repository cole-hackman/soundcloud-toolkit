// Minimal static file server over `frontend-UI/out`, for the Playwright e2e
// harness only (never used in production — that's Express, see
// server/index.js).
//
// It mirrors the *target* lookup order the static-serving middleware will
// have from Task 2 on: exact file -> "<path>/index.html" -> "<path>.html" ->
// "404.html" served with an actual 404 status. Today's Express still falls
// back to root index.html for an unmatched route (a SPA catch-all); this
// harness intentionally does NOT reproduce that, because Task 2 replaces it
// with a real 404, and the point of e2e/a11y.spec.ts hitting a
// `/does-not-exist/` URL is to exercise that behavior once it lands.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../out/", import.meta.url));

// `--port=` (what playwright.config.ts passes), then E2E_PORT / PORT for a
// hand-started server. Parallel checkouts each need their own port — see the
// note in playwright.config.ts.
function resolvePort() {
  const flag = process.argv.slice(2).find((arg) => arg.startsWith("--port="));
  const candidate = flag ? flag.slice("--port=".length) : process.env.E2E_PORT || process.env.PORT;
  const parsed = Number(candidate);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 4173;
}

const PORT = resolvePort();

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml",
  ".webmanifest": "application/manifest+json",
};

function contentTypeFor(path) {
  return CONTENT_TYPES[extname(path)] || "application/octet-stream";
}

async function isFile(path) {
  try {
    const stats = await stat(path);
    return stats.isFile();
  } catch {
    return false;
  }
}

/** Resolve a request path to a file under ROOT, or fall back to 404.html. */
async function resolveFile(requestUrl) {
  const pathname = decodeURIComponent(requestUrl.split("?")[0] || "/");
  const relative = normalize(pathname).replace(/^\/+/, "");

  const candidates = [
    join(ROOT, relative),
    join(ROOT, relative, "index.html"),
    join(ROOT, `${relative}.html`),
  ];

  for (const candidate of candidates) {
    // Path-traversal guard: never serve a file outside ROOT.
    if (!candidate.startsWith(ROOT)) continue;
    if (await isFile(candidate)) {
      return { file: candidate, status: 200 };
    }
  }

  return { file: join(ROOT, "404.html"), status: 404 };
}

/**
 * Identity endpoint, for `e2e/global-setup.mjs`.
 *
 * `reuseExistingServer` adopts *anything* listening on the port. An orphan
 * from an earlier run — or from another worktree — answers `/` with a healthy
 * 200 while serving a different checkout's `out/`, so the whole suite runs
 * against stale HTML and fails in ways that describe someone else's code. A
 * plain health check cannot tell those apart; the `root` this returns can.
 */
const IDENTITY_PATH = "/__e2e/identity";

const server = createServer(async (req, res) => {
  if ((req.url || "").split("?")[0] === IDENTITY_PATH) {
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ harness: "track-toolkit-e2e", root: ROOT, pid: process.pid }));
    return;
  }

  const { file, status } = await resolveFile(req.url || "/");
  try {
    const body = await readFile(file);
    res.writeHead(status, { "Content-Type": contentTypeFor(file) });
    res.end(body);
  } catch {
    res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Internal server error");
  }
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[e2e static-server] serving ${ROOT} on http://localhost:${PORT}`);
});
