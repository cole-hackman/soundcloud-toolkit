// Builds the stacked Track Toolkit lockup (mark centred above the text) and the
// monochrome stamp from the same spec as the mark (mark-spec.cjs) and the same
// typography as the horizontal wordmark (text-outline.cjs). Re-run with:
//
//   BRAND_DEPS=<deps dir> node docs/brand/tools/build-stacked.cjs
'use strict';
const fs = require('fs');
const path = require('path');
const { load } = require('./deps.cjs');
const { verify } = require('./verify-png.cjs');
const { COLORS, T, CANDIDATES, CHOSEN, USE_ACCENT, bounds, rects } = require('./mark-spec.cjs');
const { TEXT, WEIGHT, TRACKING_EM, loadFont, textPath, inkWidth, assertCleanSvg, renderWidth } = require('./text-outline.cjs');
const sharp = load('sharp');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const OUT = path.join(ROOT, 'frontend-UI', 'public', 'brand');
// Review sheets and QA renders live outside the static export so they are
// never publicly fetchable; only the assets under public/brand ship.
const PREVIEW = path.resolve(__dirname, '..', 'preview');
fs.mkdirSync(PREVIEW, { recursive: true });
const { ORANGE, ORANGE_DEEP, INK, WHITE, PAPER, NIGHT } = COLORS;

// Layout, in the mark's units (one bar = T = 10).
const TEXT_TO_MARK_WIDTH = 1.6;  // text ink width / mark width
const PAD = T;                   // canvas padding, one bar-height on every side
const GAP = T;                   // mark bottom edge to the text's cap line

const spec = CANDIDATES[CHOSEN];
const mb = bounds(spec);         // 40 x 40 at (4,4)

function buildSvg(font, { markFill, textFill }) {
  const textW = TEXT_TO_MARK_WIDTH * mb.w;                 // 64
  const size = textW / inkWidth(font, 1);                  // ink width scales linearly with size
  const capHeight = size * font.capHeight / font.unitsPerEm;
  const W = +(Math.max(mb.w, textW) + 2 * PAD).toFixed(3);
  const axis = W / 2;
  const markX = axis - mb.w / 2, markY = PAD;
  const capLine = markY + mb.h + GAP;
  const baseline = capLine + capHeight;
  const probe = textPath(font, size, 0, baseline);         // measure, then place the ink box on the axis
  const textX = axis - textW / 2 - probe.ink.x0;
  const { d, ink } = textPath(font, size, textX, baseline);
  const H = +(ink.y1 + PAD).toFixed(3);
  const markRects = rects(spec, { fill: markFill, accentFill: USE_ACCENT ? ORANGE_DEEP : null, dx: markX - mb.x0, dy: markY - mb.y0, indent: '    ' });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Track Toolkit">
  <g>
${markRects}
  </g>
  <path fill="${textFill}" d="${d}"/>
</svg>
`;
  return { svg, W, H, size, capHeight, baseline, capLine, ink, axis, mark: { x0: markX, x1: markX + mb.w, y0: markY, y1: markY + mb.h } };
}

async function main() {
  const font = loadFont();
  const variants = {
    'wordmark-stacked': { markFill: ORANGE, textFill: INK },
    'wordmark-stacked-dark': { markFill: ORANGE, textFill: WHITE },
    'stamp-white': { markFill: WHITE, textFill: WHITE },
    'stamp-ink': { markFill: INK, textFill: INK },
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
  await write('wordmark-stacked.png', await renderWidth(built['wordmark-stacked'].svg, 1024));
  await write('wordmark-stacked-dark.png', await renderWidth(built['wordmark-stacked-dark'].svg, 1024));
  await write('stamp-ink-256.png', await renderWidth(built['stamp-ink'].svg, 256));
  await write('stamp-white-256.png', await renderWidth(built['stamp-white'].svg, 256));

  // Contact sheet (opaque preview): stacked light/dark at 1024, stamps at 256,
  // and each stamp at 64 px real size with a 4x nearest-neighbour zoom.
  const M = 48, ZOOM = 4;
  const ratio = built['wordmark-stacked'].H / built['wordmark-stacked'].W;
  const bigH = Math.round(1024 * ratio), stampH = Math.round(256 * ratio), smallH = Math.round(64 * ratio);
  const zoom = async (buf) => sharp(buf).resize(64 * ZOOM, smallH * ZOOM, { kernel: 'nearest' }).png().toBuffer();
  const sheetW = 1024 + 2 * M;
  const bigPanelH = M + bigH + M, stampPanelH = M + Math.max(stampH, smallH * ZOOM) + M;
  const sheetH = 2 * bigPanelH + 2 * stampPanelH;
  const comps = [];
  let y = 0;
  for (const [name, bg] of [['wordmark-stacked', PAPER], ['wordmark-stacked-dark', NIGHT]]) {
    comps.push({ input: { create: { width: sheetW, height: bigPanelH, channels: 4, background: bg } }, left: 0, top: y });
    comps.push({ input: await renderWidth(built[name].svg, 1024), left: M, top: y + M });
    y += bigPanelH;
  }
  for (const [name, bg] of [['stamp-ink', PAPER], ['stamp-white', NIGHT]]) {
    comps.push({ input: { create: { width: sheetW, height: stampPanelH, channels: 4, background: bg } }, left: 0, top: y });
    comps.push({ input: await renderWidth(built[name].svg, 256), left: M, top: y + M });
    const small = await renderWidth(built[name].svg, 64);
    comps.push({ input: small, left: M + 256 + M, top: y + M });
    comps.push({ input: await zoom(small), left: M + 256 + M + 64 + M, top: y + M });
    y += stampPanelH;
  }
  await sharp({ create: { width: sheetW, height: sheetH, channels: 4, background: PAPER } }).composite(comps).png().toFile(path.join(PREVIEW, 'stacked-contact-sheet.png'));

  const b = built['wordmark-stacked'];
  console.log(JSON.stringify({
    text: TEXT, font: `Space Grotesk variable, instantiated at wght ${WEIGHT}`, trackingEm: TRACKING_EM,
    textToMarkWidth: TEXT_TO_MARK_WIDTH, fontSizeUnits: +b.size.toFixed(3), fontSizeEmPerBar: +(b.size / T).toFixed(3),
    capHeightUnits: +b.capHeight.toFixed(3), capToMarkHeight: +(b.capHeight / mb.h).toFixed(4),
    gapUnits: GAP, padUnits: PAD, axisX: b.axis, mark: b.mark, capLineY: +b.capLine.toFixed(3), baselineY: +b.baseline.toFixed(3),
    textInk: Object.fromEntries(Object.entries(b.ink).map(([k, v]) => [k, +v.toFixed(3)])),
    textInkCenterX: +((b.ink.x0 + b.ink.x1) / 2).toFixed(3), markCenterX: (b.mark.x0 + b.mark.x1) / 2,
    viewBox: `0 0 ${b.W} ${b.H}`, aspect: +(b.W / b.H).toFixed(4),
    cleanSvg: Object.keys(variants).map((n) => `${n}.svg`),
  }, null, 1));
  for (const r of results) console.log(JSON.stringify(r));
  if (!results.every((r) => r.ok)) { console.error('VERIFY FAILED'); process.exit(1); }
}

main().catch((e) => { console.error(e); process.exit(1); });
