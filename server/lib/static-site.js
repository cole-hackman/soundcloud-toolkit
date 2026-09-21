import express from 'express';
import { existsSync } from 'fs';
import { join } from 'path';

/**
 * Mounts the Next.js static export (`frontend-UI/out`) onto an Express app.
 *
 * Applies, in order, to every non-`/api/`, non-`/health` GET/HEAD request:
 *   1. A hit in `aliases` (request path, trailing slash normalized away) ->
 *      301 redirect to the mapped target. Lets retired paths
 *      (`/sc-toolkit`, `/soundcloud-toolkit`, `/rebrand`) point somewhere
 *      useful instead of soft-404ing.
 *   2. `express.static` — real files (JS/CSS/images/etc.) served as-is.
 *   3. `<path>/index.html` — a Next.js static-export route.
 *   4. `<path>.html` — same, without the trailing slash.
 *   5. `404.html`, served with a real HTTP 404 status (not 200) if it
 *      exists; otherwise `next()` so anything mounted after this call still
 *      gets a chance (e.g. the API-only fallback in server/index.js is a
 *      separate branch entirely and never reaches this code).
 *
 * @param {import('express').Express} app
 * @param {string} buildPath - absolute path to the static export directory
 * @param {{ aliases?: Record<string, string> }} [options]
 */
export function mountStaticSite(app, buildPath, { aliases = {} } = {}) {
  // 1. Redirect aliases (checked before anything else so a stale link never
  // has to depend on there being no real file at that path).
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/') || req.path === '/health') return next();
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();

    const normalizedPath =
      req.path.length > 1 && req.path.endsWith('/') ? req.path.slice(0, -1) : req.path;
    const target = aliases[normalizedPath];
    if (target) {
      return res.redirect(301, target);
    }
    next();
  });

  // 2. Real static files from the Next.js build.
  app.use(
    express.static(buildPath, {
      maxAge: '1d',
      etag: true,
    })
  );

  // 3-5. Next.js route HTML, falling back to a real 404.
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/') || req.path === '/health') {
      return next();
    }

    // Next.js static export writes folder/index.html for each route.
    const pagePath = req.path.endsWith('/') ? req.path : req.path + '/';
    const htmlFile = join(buildPath, pagePath, 'index.html');
    if (existsSync(htmlFile)) {
      return res.sendFile(htmlFile);
    }

    // Or, less commonly, path.html directly.
    const exactHtmlFile = join(buildPath, req.path + '.html');
    if (existsSync(exactHtmlFile)) {
      return res.sendFile(exactHtmlFile);
    }

    // Unknown path: serve the branded 404 page with a real 404 status.
    const notFoundFile = join(buildPath, '404.html');
    if (existsSync(notFoundFile)) {
      return res.status(404).sendFile(notFoundFile);
    }

    next();
  });
}

export default mountStaticSite;
