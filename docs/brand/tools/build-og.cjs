// Builds the social card (the one opaque asset) from the same spec and
// modules as the logos: the dark horizontal wordmark from build-wordmark.cjs,
// a tagline outlined from Space Grotesk at wght 500, and a playlist-split
// illustration drawn only with the mark's rounded bars. Re-run with:
//
//   BRAND_DEPS=<deps dir> node docs/brand/tools/build-og.cjs
'use strict';
const fs = require('fs');
const path = require('path');
const { load } = require('./deps.cjs');
const { COLORS } = require('./mark-spec.cjs');
const { loadFont, textPath } = require('./text-outline.cjs');
const { buildSvg: buildWordmark } = require('./build-wordmark.cjs');
const sharp = load('sharp');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const OUT = path.join(ROOT, 'frontend-UI', 'public', 'brand');
const PREVIEW = path.join(OUT, 'preview');
const { ORANGE, ORANGE_DEEP, WHITE, NIGHT } = COLORS;

// Canvas and safe area
const W = 1200, H = 630;
const SAFE = { x0: (W - 1120) / 2, y0: (H - 550) / 2, x1: (W + 1120) / 2, y1: (H + 550) / 2 }; // 40..1160 x 40..590

// Wordmark: ink 480 px wide, ink starting 96 px from the left.
const WM_INK_W = 480, WM_LEFT = 96;

// Tagline: Space Grotesk 500, 28 px cap height, white at 70 %, one wordmark
// bar-height below the wordmark's ink. The full sentence is 1094 px wide at
// this size, so it is set on two lines; the second cap line sits LINE_ADVANCE
// below the first.
const TAGLINE = ['Bulk playlist, like and follow', 'management for SoundCloud.'];
const TAG_WEIGHT = 500, TAG_CAP = 28, TAG_OPACITY = 0.7, LINE_ADVANCE = 40;

// Illustration: a long playlist split into two groups, left-aligned, inside
// the safe area, at least 96 px clear of the wordmark and 48 px clear of the
// tagline. Bar height : gap = 2 : 1 like the mark; the split is one missing row.
const ILL = { x0: 736, barH: 28, gap: 14, splitExtra: 28 + 14, shift: 28 };
const BARS = [
  { len: 380 }, { len: 300 }, { len: 424 }, { len: 260 }, { len: 340 }, { len: 220 },
  'split',
  { len: 400, deep: true }, { len: 280, deep: true }, { len: 356, deep: true, shift: true }, { len: 200, deep: true }, { len: 316, deep: true },
];

function layout() {
  const wm = buildWordmark(loadFont(), { markFill: ORANGE, textFill: WHITE });
  const s = WM_INK_W / (wm.inkBox.x1 - wm.inkBox.x0);      // px per wordmark unit
  const bar = 10 * s;                                       // one bar-height at the rendered scale
  const wmH = (wm.inkBox.y1 - wm.inkBox.y0) * s;

  const tagFont = loadFont(TAG_WEIGHT);
  const tagSize = TAG_CAP / (tagFont.capHeight / tagFont.unitsPerEm);
  const groupH = wmH + bar + TAG_CAP + (TAGLINE.length - 1) * LINE_ADVANCE;
  const groupTop = H / 2 - groupH / 2;

  const tx = WM_LEFT - wm.inkBox.x0 * s, ty = groupTop - wm.inkBox.y0 * s;
  const wordmark = `<g id="wordmark" transform="translate(${tx.toFixed(3)} ${ty.toFixed(3)}) scale(${s.toFixed(6)})">\n${wm.inner}\n  </g>`;

  let capLine = groupTop + wmH + bar;
  const lines = [];
  for (const text of TAGLINE) {
    const baseline = capLine + TAG_CAP;
    const probe = textPath(tagFont, tagSize, 0, baseline, text);
    const { d, ink } = textPath(tagFont, tagSize, WM_LEFT - probe.ink.x0, baseline, text);
    lines.push({ d, ink, baseline });
    capLine += LINE_ADVANCE;
  }
  const tagline = `<g id="tagline" fill="${WHITE}" fill-opacity="${TAG_OPACITY}">\n${lines.map((l) => `    <path d="${l.d}"/>`).join('\n')}\n  </g>`;

  const rows = [];
  let n = 0;
  for (const b of BARS) if (b !== 'split') n++;
  const illH = n * ILL.barH + (n - 1) * ILL.gap + ILL.splitExtra;
  let y = (H - illH) / 2;
  for (const b of BARS) {
    if (b === 'split') { y += ILL.splitExtra; continue; }
    const x = ILL.x0 + (b.shift ? ILL.shift : 0);
    rows.push({ x, y, w: b.len, fill: b.deep ? ORANGE_DEEP : ORANGE });
    y += ILL.barH + ILL.gap;
  }
  const illustration = `<g id="illustration">\n${rows.map((r) => `    <rect x="${r.x}" y="${r.y}" width="${r.w}" height="${ILL.barH}" rx="${ILL.barH / 2}" fill="${r.fill}"/>`).join('\n')}\n  </g>`;

  const svg = (layers) => `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Track Toolkit: bulk playlist, like and follow management for SoundCloud">
${layers.join('\n')}
</svg>
`;
  const background = `<rect id="background" width="${W}" height="${H}" fill="${NIGHT}"/>`;
  return {
    full: svg([background, wordmark, tagline, illustration]),
    only: { wordmark: svg([wordmark]), tagline: svg([tagline]), illustration: svg([illustration]) },
    meta: { scale: s, bar, wmH, groupTop, groupH, tagSize, lines, illH, rows },
  };
}

function assertOutlineOnly(file) {
  const s = fs.readFileSync(file, 'utf8');
  const bad = ['<text', '@font-face', 'url(', 'href', '<image', '<use', 'xlink', 'gradient', '<style', '<script', 'filter'].filter((k) => s.includes(k));
  if (bad.length) throw new Error(`${file} is not outline-only: ${bad.join(', ')}`);
}

async function inkBounds(svg) {
  const { data, info } = await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let x0 = info.width, y0 = info.height, x1 = -1, y1 = -1;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    if (data[(y * info.width + x) * 4 + 3] === 0) continue;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return { x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

async function main() {
  const { full, only, meta } = layout();
  fs.mkdirSync(PREVIEW, { recursive: true });
  const svgFile = path.join(OUT, 'og-image.svg');
  fs.writeFileSync(svgFile, full);
  assertOutlineOnly(svgFile);

  const pngFile = path.join(OUT, 'og-image.png');
  await sharp(Buffer.from(full)).png().toFile(pngFile);

  // Verification
  const img = sharp(pngFile);
  const m = await img.metadata();
  const { data, info } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let transparent = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i] !== 255) transparent++;
  const px = (x, y) => { const i = (y * info.width + x) * 4; return '#' + [data[i], data[i + 1], data[i + 2]].map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase(); };
  const corners = [[0, 0], [W - 1, 0], [0, H - 1], [W - 1, H - 1]].map(([x, y]) => px(x, y));
  const wmB = await inkBounds(only.wordmark), tgB = await inkBounds(only.tagline), ilB = await inkBounds(only.illustration);
  const inside = (b) => b.x0 >= SAFE.x0 && b.y0 >= SAFE.y0 && b.x1 <= SAFE.x1 - 1 && b.y1 <= SAFE.y1 - 1;
  const checks = {
    dimensions: m.width === W && m.height === H,
    fullyOpaque: transparent === 0,
    cornersAreNight: corners.every((c) => c === NIGHT),
    wordmarkInkWidth480: Math.abs(wmB.w - WM_INK_W) <= 1,
    wordmarkLeft96: wmB.x0 === WM_LEFT,
    wordmarkInSafeArea: inside(wmB),
    taglineInSafeArea: inside(tgB),
    taglineLeftAlignedWithWordmark: tgB.x0 === WM_LEFT,
    illustrationClearOfWordmark96: ilB.x0 - (wmB.x1 + 1) >= 96,
    illustrationClearOfTagline48: ilB.x0 - (tgB.x1 + 1) >= 48,
    illustrationInSafeArea: inside(ilB),
    // centred on the cap/baseline box (descenders of 'p', 'y', 'g' hang below it by design)
    groupVerticallyCentred: Math.abs((wmB.y0 + meta.lines[meta.lines.length - 1].baseline) / 2 - H / 2) <= 1,
  };
  const report = {
    size: `${m.width}x${m.height}`, channels: m.channels, nonOpaquePixels: transparent, corners,
    wordmark: { scalePxPerUnit: +meta.scale.toFixed(4), barPx: +meta.bar.toFixed(2), ink: wmB },
    tagline: { font: `Space Grotesk wght ${TAG_WEIGHT}`, capPx: TAG_CAP, fontSizePx: +meta.tagSize.toFixed(2), opacity: TAG_OPACITY, lines: TAGLINE, lineAdvancePx: LINE_ADVANCE, gapFromWordmarkPx: +meta.bar.toFixed(2), ink: tgB, lineInk: meta.lines.map((l) => ({ x1: +l.ink.x1.toFixed(1), baseline: +l.baseline.toFixed(1) })) },
    illustration: { bars: meta.rows.length, ink: ilB, bleeds: { left: ilB.x0 <= 0, right: ilB.x1 >= W - 1, top: ilB.y0 <= 0, bottom: ilB.y1 >= H - 1 }, clearanceFromWordmarkPx: ilB.x0 - (wmB.x1 + 1), clearanceFromTaglinePx: ilB.x0 - (tgB.x1 + 1) },
    groupCentreY: { capBox: +((wmB.y0 + meta.lines[meta.lines.length - 1].baseline) / 2).toFixed(1), inkIncludingDescenders: (wmB.y0 + tgB.y1 + 1) / 2, canvas: H / 2 },
    safeArea: SAFE, checks,
  };
  console.log(JSON.stringify(report, null, 1));

  // Previews: safe-area check and half-size render.
  const overlay = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect x="${SAFE.x0 + 0.5}" y="${SAFE.y0 + 0.5}" width="${1120 - 1}" height="${550 - 1}" fill="none" stroke="#FFFFFF" stroke-opacity="0.6" stroke-width="1" stroke-dasharray="8 6"/></svg>`;
  await sharp(pngFile).composite([{ input: Buffer.from(overlay) }]).png().toFile(path.join(PREVIEW, 'og-image-check.png'));
  await sharp(pngFile).resize(600, 315).png().toFile(path.join(PREVIEW, 'og-image-half.png'));

  const failed = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);
  if (failed.length) { console.error('CHECKS FAILED:', failed.join(', ')); process.exit(1); }
}

main().catch((e) => { console.error(e); process.exit(1); });
