// Builds the horizontal Track Toolkit wordmark from the same parametric spec
// as the mark (mark-spec.cjs). Text is Space Grotesk instantiated at wght 600
// from the verified variable font and converted to outlines: the SVGs carry no
// <text>, no @font-face and no external references. Re-run with:
//
//   BRAND_DEPS=<deps dir> node docs/brand/tools/build-wordmark.cjs
'use strict';
const fs = require('fs');
const path = require('path');
const { load } = require('./deps.cjs');
const { verify } = require('./verify-png.cjs');
const { COLORS, T, CANDIDATES, CHOSEN, USE_ACCENT, bounds, rects } = require('./mark-spec.cjs');
const sharp = load('sharp');
const { TEXT, WEIGHT, TRACKING_EM, loadFont, textPath, assertCleanSvg, renderWidth, renderHeight } = require('./text-outline.cjs');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const OUT = path.join(ROOT, 'frontend-UI', 'public', 'brand');
const PREVIEW = path.join(OUT, 'preview');
const { ORANGE, ORANGE_DEEP, INK, WHITE, PAPER, NIGHT } = COLORS;

// Layout, in the mark's units (one bar = T = 10).
const CAP_RATIO = 0.65;      // cap height as a fraction of the mark's height
const PAD = T;               // canvas padding, one bar-height on every side
const GAP = T;               // mark-to-text gap, one bar-height

const spec = CANDIDATES[CHOSEN];
const mb = bounds(spec);     // 40 x 40 at (4,4)

function buildSvg(font, { markFill, textFill }) {
  const capHeightUnits = font.capHeight / font.unitsPerEm;   // 0.7
  const size = (CAP_RATIO * mb.h) / capHeightUnits;          // font size in mark units
  const markX = PAD, markY = PAD;                            // mark's ink box top-left
  const centerY = markY + mb.h / 2;
  const baseline = centerY + (CAP_RATIO * mb.h) / 2;         // cap-height box centred on the mark
  const textX = markX + mb.w + GAP;
  const { d, ink } = textPath(font, size, textX, baseline);
  const W = +(ink.x1 + PAD).toFixed(3);
  const H = mb.h + 2 * PAD;
  const markRects = rects(spec, { fill: markFill, accentFill: USE_ACCENT ? ORANGE_DEEP : null, dx: markX - mb.x0, dy: markY - mb.y0, indent: '    ' });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Track Toolkit">
  <g>
${markRects}
  </g>
  <path fill="${textFill}" d="${d}"/>
</svg>
`;
  return { svg, W, H, size, baseline, ink, capHeight: CAP_RATIO * mb.h };
}

async function main() {
  const font = loadFont();

  const variants = {
    'wordmark': { markFill: ORANGE, textFill: INK },
    'wordmark-dark': { markFill: ORANGE, textFill: WHITE },
    'wordmark-mono-white': { markFill: WHITE, textFill: WHITE },
    'wordmark-mono-ink': { markFill: INK, textFill: INK },
  };
  const built = {};
  for (const [name, fills] of Object.entries(variants)) {
    const b = buildSvg(font, fills);
    const file = path.join(OUT, `${name}.svg`);
    fs.writeFileSync(file, b.svg);
    assertCleanSvg(file);
    built[name] = b;
  }
  const results = [];
  const write = async (name, buf) => { const f = path.join(OUT, name); fs.writeFileSync(f, buf); results.push(await verify(f)); };
  await write('wordmark.png', await renderWidth(built['wordmark'].svg, 1200));
  await write('wordmark-dark.png', await renderWidth(built['wordmark-dark'].svg, 1200));
  await write('wordmark-28.png', await renderHeight(built['wordmark'].svg, 28));
  await write('wordmark-dark-28.png', await renderHeight(built['wordmark-dark'].svg, 28));

  // Contact sheet (opaque preview): light + dark at 1200 px and at 28 px tall
  // (real size and 4x nearest-neighbour), then the two mono versions.
  const M = 48, ZOOM = 4;
  const big = 1200, bigH = Math.round(big * built.wordmark.H / built.wordmark.W);
  const small = fs.readFileSync(path.join(OUT, 'wordmark-28.png'));
  const smallDark = fs.readFileSync(path.join(OUT, 'wordmark-dark-28.png'));
  const smallMeta = await sharp(small).metadata();
  const zoom = async (buf) => sharp(buf).resize(smallMeta.width * ZOOM, smallMeta.height * ZOOM, { kernel: 'nearest' }).png().toBuffer();
  const themePanelH = M + bigH + M + 28 * ZOOM + M;
  const monoW = 600, monoH = Math.round(monoW * built.wordmark.H / built.wordmark.W);
  const monoPanelH = M + monoH + M;
  const sheetW = big + 2 * M, sheetH = 2 * themePanelH + 2 * monoPanelH;
  const comps = [];
  let y = 0;
  for (const [name, bg, smallBuf] of [['wordmark', PAPER, small], ['wordmark-dark', NIGHT, smallDark]]) {
    comps.push({ input: { create: { width: sheetW, height: themePanelH, channels: 4, background: bg } }, left: 0, top: y });
    comps.push({ input: await renderWidth(built[name].svg, big), left: M, top: y + M });
    const rowY = y + M + bigH + M;
    comps.push({ input: smallBuf, left: M, top: rowY + Math.round((28 * ZOOM - 28) / 2) });
    comps.push({ input: await zoom(smallBuf), left: M + smallMeta.width + M, top: rowY });
    y += themePanelH;
  }
  for (const [name, bg] of [['wordmark-mono-ink', PAPER], ['wordmark-mono-white', NIGHT]]) {
    comps.push({ input: { create: { width: sheetW, height: monoPanelH, channels: 4, background: bg } }, left: 0, top: y });
    comps.push({ input: await renderWidth(built[name].svg, monoW), left: M, top: y + M });
    y += monoPanelH;
  }
  await sharp({ create: { width: sheetW, height: sheetH, channels: 4, background: PAPER } }).composite(comps).png().toFile(path.join(PREVIEW, 'wordmark-contact-sheet.png'));

  const b = built.wordmark;
  console.log(JSON.stringify({
    text: TEXT, font: `Space Grotesk variable (${font.postscriptName} file), instantiated at wght ${WEIGHT}`, fontSizeUnits: +b.size.toFixed(3), fontSizeEmPerBar: +(b.size / T).toFixed(3),
    capHeightUnits: b.capHeight, capToMarkRatio: CAP_RATIO, trackingEm: TRACKING_EM, gapUnits: GAP, padUnits: PAD,
    baselineY: +b.baseline.toFixed(3), textInk: Object.fromEntries(Object.entries(b.ink).map(([k, v]) => [k, +v.toFixed(3)])),
    viewBox: `0 0 ${b.W} ${b.H}`, aspect: +(b.W / b.H).toFixed(4),
    outlineOnly: Object.keys(variants).map((n) => `${n}.svg`),
  }, null, 1));
  for (const r of results) console.log(JSON.stringify(r));
  if (!results.every((r) => r.ok)) { console.error('VERIFY FAILED'); process.exit(1); }
}

main().catch((e) => { console.error(e); process.exit(1); });
