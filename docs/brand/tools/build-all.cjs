// Regenerates every asset under frontend-UI/public/brand from the spec.
//   BRAND_DEPS=<deps dir> node docs/brand/tools/build-all.cjs
'use strict';
const { execFileSync } = require('child_process');
const path = require('path');
for (const s of ['build-mark.cjs', 'build-wordmark.cjs', 'build-stacked.cjs', 'build-og.cjs']) {
  console.log(`\n== ${s}`);
  execFileSync(process.execPath, [path.join(__dirname, s)], { stdio: 'inherit' });
}
