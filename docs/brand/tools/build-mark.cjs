// Builds the Track Toolkit icon mark from the parametric spec in mark-spec.cjs: SVG sources,
// PNG icon exports (maskable-safe framing), a 24 px legibility export, and the
// review previews. Re-run with:
//
//   BRAND_DEPS=<deps dir> node docs/brand/tools/build-mark.cjs
'use strict';
const fs = require('fs');
const path = require('path');
const { load } = require('./deps.cjs');
const { verify } = require('./verify-png.cjs');
const sharp = load('sharp');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const OUT = path.join(ROOT, 'frontend-UI', 'public', 'brand');
const PREVIEW = path.join(OUT, 'preview');
fs.mkdirSync(PREVIEW, { recursive: true });

const { COLORS, VB, T, G, CANDIDATES, CHOSEN, RUNNER_UP, USE_ACCENT, pieces, bounds, svg } = require('./mark-spec.cjs');
const { ORANGE, ORANGE_DEEP, INK, WHITE, PAPER, NIGHT } = COLORS;

// Largest scale (px per unit) at which every rounded cap of the mark stays
// inside a circle of the given radius centred on the canvas centre.
function maskableScale(spec, canvas, radius) {
  const c = VB / 2, r = T / 2;
  let far = 0;
  for (const p of pieces(spec)) {
    for (const cx of [p.x + r, p.x + p.w - r]) {
      const cy = p.y + r;
      far = Math.max(far, Math.hypot(cx - c, cy - c) + r);
    }
  }
  return radius / far;
}

async function renderAt(svgText, size) {
  return sharp(Buffer.from(svgText)).resize(size, size).png().toBuffer();
}

// Render the mark scaled by `scale` px/unit and centred on a transparent canvas.
async function renderPadded(svgText, canvas, scale) {
  const inner = Math.round(VB * scale);
  const buf = await renderAt(svgText, inner);
  const off = Math.round((canvas - inner) / 2);
  return sharp({ create: { width: canvas, height: canvas, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: buf, left: off, top: off }])
    .png()
    .toBuffer();
}

async function main() {
  const chosen = CANDIDATES[CHOSEN];
  const alt = CANDIDATES[RUNNER_UP];
  const accent = USE_ACCENT ? ORANGE_DEEP : null;

  // 1-2. SVG sources
  const markSvg = svg(chosen, { fill: ORANGE, accentFill: accent });
  fs.writeFileSync(path.join(OUT, 'mark.svg'), markSvg);
  fs.writeFileSync(path.join(OUT, 'mark-white.svg'), svg(chosen, { fill: WHITE }));
  fs.writeFileSync(path.join(OUT, 'mark-ink.svg'), svg(chosen, { fill: INK }));
  fs.writeFileSync(path.join(PREVIEW, 'mark-alt.svg'), svg(alt, { fill: ORANGE, accentFill: accent }));

  // 3. Icon exports. Maskable framing: mark inside the central 80 % circle.
  // 5 px inside the 205 px safe radius so anti-aliased edge pixels never cross it.
  const scale512 = maskableScale(chosen, 512, 200);
  const results = [];
  for (const size of [512, 192, 180]) {
    const scale = scale512 * (size / 512);
    const buf = await renderPadded(markSvg, size, scale);
    const file = path.join(OUT, `icon-${size}.png`);
    fs.writeFileSync(file, buf);
    results.push(await verify(file));
  }

  // 4. 24 px legibility export: the mark's own canvas at 24 px.
  const file24 = path.join(OUT, 'icon-24.png');
  fs.writeFileSync(file24, await renderAt(markSvg, 24));
  results.push(await verify(file24));

  // Candidate comparison sheet: both treatments at 24 and 64 px, both themes.
  const cands = [chosen, alt];
  const tile = 96, pad = 16;
  const sheetW = pad + cands.length * (tile + pad), sheetH = 2 * (2 * (tile + pad)) + pad;
  const comps = [];
  const rowY = (theme, sizeIdx) => pad + theme * 2 * (tile + pad) + sizeIdx * (tile + pad);
  for (let t = 0; t < 2; t++) {
    comps.push({ input: { create: { width: sheetW, height: 2 * (tile + pad), channels: 4, background: t ? NIGHT : PAPER } }, left: 0, top: t * 2 * (tile + pad) });
  }
  for (let ci = 0; ci < cands.length; ci++) {
    const s = svg(cands[ci], { fill: ORANGE, accentFill: accent });
    for (let t = 0; t < 2; t++) {
      for (const [si, size] of [[0, 64], [1, 24]]) {
        comps.push({ input: await renderAt(s, size), left: pad + ci * (tile + pad) + Math.round((tile - size) / 2), top: rowY(t, si) + Math.round((tile - size) / 2) });
      }
    }
  }
  await sharp({ create: { width: sheetW, height: sheetH, channels: 4, background: PAPER } }).composite(comps).png().toFile(path.join(PREVIEW, 'mark-candidates.png'));

  // Contact sheet: chosen mark at 512, 64, 24 on paper and on night.
  const half = 512 + 2 * 48 + 64 + 24 + 2 * 48; // 512 tile, then 64 and 24 tiles side by side
  const cw = 512 + 48 * 2 + 160, ch = (512 + 96) * 2;
  const cs = [];
  const labels = [];
  for (let t = 0; t < 2; t++) {
    const top = t * (512 + 96);
    cs.push({ input: { create: { width: cw, height: 512 + 96, channels: 4, background: t ? NIGHT : PAPER } }, left: 0, top });
    cs.push({ input: await renderAt(markSvg, 512), left: 48, top: top + 48 });
    cs.push({ input: await renderAt(markSvg, 64), left: 48 + 512 + 48, top: top + 48 });
    cs.push({ input: await renderAt(markSvg, 24), left: 48 + 512 + 48, top: top + 48 + 64 + 32 });
    cs.push({ input: await renderPadded(markSvg, 128, scale512 * (128 / 512)), left: 48 + 512 + 48, top: top + 48 + 64 + 32 + 24 + 32 });
    const lc = t ? WHITE : INK;
    labels.push(`<text x="${48}" y="${top + 48 + 512 + 28}" fill="${lc}">512 px</text>`);
    labels.push(`<text x="${48 + 512 + 48 + 72}" y="${top + 48 + 40}" fill="${lc}">64 px</text>`);
    labels.push(`<text x="${48 + 512 + 48 + 32}" y="${top + 48 + 64 + 32 + 18}" fill="${lc}">24 px</text>`);
    labels.push(`<text x="${48 + 512 + 48}" y="${top + 48 + 64 + 32 + 24 + 32 + 128 + 20}" fill="${lc}">128 px, maskable framing</text>`);
  }
  const labelSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${cw}" height="${ch}"><g font-family="Helvetica, Arial, sans-serif" font-size="13">${labels.join('')}</g></svg>`;
  cs.push({ input: Buffer.from(labelSvg), left: 0, top: 0 });
  await sharp({ create: { width: cw, height: ch, channels: 4, background: PAPER } }).composite(cs).png().toFile(path.join(PREVIEW, 'mark-contact-sheet.png'));

  // Maskable check: icon-512 with the 410 px safe circle and the outside shaded.
  const overlay = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">
    <defs><mask id="m"><rect width="512" height="512" fill="white"/><circle cx="256" cy="256" r="205" fill="black"/></mask></defs>
    <rect width="512" height="512" fill="${INK}" fill-opacity="0.08" mask="url(#m)"/>
    <circle cx="256" cy="256" r="205" fill="none" stroke="${INK}" stroke-width="1.5" stroke-dasharray="6 5"/>
    <line x1="256" y1="0" x2="256" y2="512" stroke="${INK}" stroke-opacity="0.25" stroke-width="1"/>
    <line x1="0" y1="256" x2="512" y2="256" stroke="${INK}" stroke-opacity="0.25" stroke-width="1"/>
  </svg>`;
  await sharp({ create: { width: 512, height: 512, channels: 4, background: PAPER } })
    .composite([{ input: fs.readFileSync(path.join(OUT, 'icon-512.png')) }, { input: Buffer.from(overlay) }])
    .png().toFile(path.join(PREVIEW, 'mark-maskable-check.png'));

  // Pixel-level maskable check: nothing may sit outside the 410 px safe circle.
  const { data, info } = await sharp(path.join(OUT, 'icon-512.png')).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let outside = 0, maxR = 0;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    if (data[(y * info.width + x) * 4 + 3] === 0) continue;
    const d = Math.hypot(x + 0.5 - 256, y + 0.5 - 256);
    if (d > maxR) maxR = d;
    if (d > 205) outside++;
  }
  console.log(JSON.stringify({ maskable: { pixelsOutsideSafeCircle: outside, farthestPixelRadius: +maxR.toFixed(1), safeRadius: 205 } }));
  if (outside) { console.error('MASKABLE CHECK FAILED'); process.exit(1); }

  // Report
  const b = bounds(chosen);
  console.log(JSON.stringify({
    chosen: CHOSEN, runnerUp: RUNNER_UP, accent: USE_ACCENT,
    viewBox: VB,
    barThicknessPct: +(100 * T / VB).toFixed(2), gapPct: +(100 * G / VB).toFixed(2),
    markBoundsUnits: b, markWidthPct: +(100 * b.w / VB).toFixed(2), markHeightPct: +(100 * b.h / VB).toFixed(2),
    maskableScale512: +scale512.toFixed(4), markPx512: +(b.w * scale512).toFixed(1),
    pieces: pieces(chosen),
  }, null, 1));
  for (const r of results) console.log(JSON.stringify(r));
  const previews = await Promise.all(['mark-candidates.png', 'mark-contact-sheet.png', 'mark-maskable-check.png'].map((f) => verify(path.join(PREVIEW, f))));
  console.log('previews (opaque by design):', previews.map((p) => `${path.basename(p.file)} ${p.size}`).join(', '));
  if (!results.every((r) => r.ok)) { console.error('VERIFY FAILED'); process.exit(1); }
}

main().catch((e) => { console.error(e); process.exit(1); });
