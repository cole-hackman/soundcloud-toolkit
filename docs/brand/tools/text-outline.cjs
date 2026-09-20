// Shared typography for every wordmark: Space Grotesk instantiated at wght 600
// from the verified variable font, kerning on, -0.01 em tracking, converted to
// SVG path outlines. build-wordmark.cjs and build-stacked.cjs both use this so
// the lockups cannot drift apart.
'use strict';
const fs = require('fs');
const path = require('path');
const { load } = require('./deps.cjs');
const fontkit = load('fontkit');
const sharp = load('sharp');

const FONT = path.join(__dirname, 'fonts', 'SpaceGrotesk[wght].ttf');
const TEXT = 'Track Toolkit';
const WEIGHT = 600;
const TRACKING_EM = -0.01;

function loadFont() {
  const font = fontkit.openSync(FONT).getVariation({ wght: WEIGHT });
  if (font.familyName.indexOf('Space Grotesk') !== 0) throw new Error(`unexpected font ${font.familyName}`);
  return font;
}

function fmt(n) { return String(+n.toFixed(3)); }

// One SVG path `d` for the whole string: glyph outlines placed on the baseline
// with the font's kerning plus the tracking, y flipped to SVG space. Returns
// the ink box of the placed text.
function textPath(font, size, x0, baseline, text = TEXT) {
  const s = size / font.unitsPerEm;
  const run = font.layout(text);
  const track = TRACKING_EM * size;
  let pen = x0, d = '', inkMinX = Infinity, inkMaxX = -Infinity, inkMinY = Infinity, inkMaxY = -Infinity;
  run.glyphs.forEach((g, i) => {
    const pos = run.positions[i];
    const gx = pen + pos.xOffset * s, gy = baseline - pos.yOffset * s;
    for (const c of g.path.commands) {
      const a = c.args;
      const X = (k) => fmt(gx + a[k] * s), Y = (k) => fmt(gy - a[k] * s);
      switch (c.command) {
        case 'moveTo': d += `M${X(0)} ${Y(1)}`; break;
        case 'lineTo': d += `L${X(0)} ${Y(1)}`; break;
        case 'quadraticCurveTo': d += `Q${X(0)} ${Y(1)} ${X(2)} ${Y(3)}`; break;
        case 'bezierCurveTo': d += `C${X(0)} ${Y(1)} ${X(2)} ${Y(3)} ${X(4)} ${Y(5)}`; break;
        case 'closePath': d += 'Z'; break;
        default: throw new Error(`unhandled path command ${c.command}`);
      }
    }
    if (g.bbox.maxX > g.bbox.minX) { // skip empty glyphs (space)
      inkMinX = Math.min(inkMinX, gx + g.bbox.minX * s);
      inkMaxX = Math.max(inkMaxX, gx + g.bbox.maxX * s);
      inkMinY = Math.min(inkMinY, gy - g.bbox.maxY * s);
      inkMaxY = Math.max(inkMaxY, gy - g.bbox.minY * s);
    }
    pen += pos.xAdvance * s + track;
  });
  return { d, ink: { x0: inkMinX, x1: inkMaxX, y0: inkMinY, y1: inkMaxY } };
}

// Ink width of the string at a given size (tracking included).
function inkWidth(font, size, text = TEXT) {
  const { ink } = textPath(font, size, 0, 0, text);
  return ink.x1 - ink.x0;
}

// A logo SVG must be outlines only, on nothing: no text, fonts or external
// references, no fill/style/background on the root element, and no rect that
// could be a backing tile (every rect must be a mark bar: rx set, narrower than
// the canvas).
function assertCleanSvg(file) {
  const s = fs.readFileSync(file, 'utf8');
  const bad = ['<text', '@font-face', 'url(', 'href', '<image', '<use', 'xlink', 'gradient', '<style', '<script', 'filter', 'background'].filter((k) => s.includes(k));
  if (bad.length) throw new Error(`${file} is not outline-only: ${bad.join(', ')}`);
  const root = s.match(/<svg\b[^>]*>/)[0];
  for (const attr of ['fill', 'style', 'background', 'class']) {
    if (new RegExp(`\\s${attr}=`).test(root)) throw new Error(`${file}: root <svg> carries ${attr}`);
  }
  const vbW = parseFloat(root.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/)[1]);
  for (const r of s.match(/<rect\b[^>]*>/g) || []) {
    const w = parseFloat(r.match(/width="([\d.]+)"/)[1]);
    if (!/\srx="/.test(r) || w >= vbW) throw new Error(`${file}: rect looks like a background: ${r}`);
  }
  return true;
}

async function renderWidth(svg, width) { return sharp(Buffer.from(svg)).resize({ width }).png().toBuffer(); }
async function renderHeight(svg, height) { return sharp(Buffer.from(svg)).resize({ height }).png().toBuffer(); }

module.exports = { FONT, TEXT, WEIGHT, TRACKING_EM, loadFont, textPath, inkWidth, assertCleanSvg, renderWidth, renderHeight, fmt };
