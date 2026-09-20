// Verifies that a PNG has a real alpha channel, that its four corners and the
// full outer edge ring are fully transparent, and reports the bounding box of
// non-transparent pixels (the mark's pixel bounds) so the safe zone can be checked.
//
//   node docs/brand/tools/verify-png.cjs <file.png> [more.png ...]
'use strict';
const { load } = require('./deps.cjs');
const sharp = load('sharp');

async function verify(file) {
  const img = sharp(file);
  const meta = await img.metadata();
  const { data, info } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: c } = info;
  const alphaAt = (x, y) => data[(y * w + x) * c + 3];

  let minX = w, minY = h, maxX = -1, maxY = -1, opaque = 0, partial = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const a = alphaAt(x, y);
      if (a === 0) continue;
      if (a === 255) opaque++; else partial++;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
  }
  const corners = [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]].map(([x, y]) => alphaAt(x, y));
  let edgeNonZero = 0;
  for (let x = 0; x < w; x++) { if (alphaAt(x, 0)) edgeNonZero++; if (alphaAt(x, h - 1)) edgeNonZero++; }
  for (let y = 1; y < h - 1; y++) { if (alphaAt(0, y)) edgeNonZero++; if (alphaAt(w - 1, y)) edgeNonZero++; }

  const empty = maxX < 0;
  const result = {
    file,
    size: `${w}x${h}`,
    hasAlpha: !!meta.hasAlpha,
    channels: meta.channels,
    cornersAlpha: corners,
    edgePixelsWithAlpha: edgeNonZero,
    bounds: empty ? null : { x0: minX, y0: minY, x1: maxX, y1: maxY, w: maxX - minX + 1, h: maxY - minY + 1 },
    margins: empty ? null : { left: minX, top: minY, right: w - 1 - maxX, bottom: h - 1 - maxY },
    opaquePixels: opaque,
    antialiasedPixels: partial,
    ok: !!meta.hasAlpha && corners.every((a) => a === 0) && edgeNonZero === 0 && !empty,
  };
  return result;
}

if (require.main === module) {
  (async () => {
    let allOk = true;
    for (const f of process.argv.slice(2)) {
      const r = await verify(f);
      allOk = allOk && r.ok;
      console.log(JSON.stringify(r));
    }
    process.exit(allOk ? 0 : 1);
  })().catch((e) => { console.error(e); process.exit(2); });
}

module.exports = { verify };
