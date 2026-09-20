// Resolves the native/npm dependencies the brand tools need without adding
// them to the project's package.json.
//
//   BRAND_DEPS=/path/to/dir node docs/brand/tools/<script>.cjs
//
// where <dir> was prepared once with:
//   mkdir -p <dir> && cd <dir> && npm init -y && npm i --no-audit --no-fund sharp fontkit
//
// Falls back to the main checkout's frontend-UI/node_modules for sharp.
'use strict';
const path = require('path');
const { createRequire } = require('module');

const candidates = [
  process.env.BRAND_DEPS,
  path.resolve(__dirname, 'node_modules', '..'),           // docs/brand/tools/node_modules (gitignored)
  path.resolve(__dirname, '..', '..', '..', 'frontend-UI'), // this worktree's frontend-UI
  '/Users/coleh/Developer/soundcloud-toolkit/frontend-UI',  // main checkout (sharp only)
].filter(Boolean);

function load(name) {
  for (const dir of candidates) {
    try {
      return createRequire(path.join(dir, 'package.json'))(name);
    } catch (e) {
      if (e.code !== 'MODULE_NOT_FOUND') throw e;
    }
  }
  throw new Error(`${name} not found. Set BRAND_DEPS to a dir where it is installed (see deps.cjs).`);
}

module.exports = { load };
