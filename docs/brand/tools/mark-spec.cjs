// The single parametric spec for the Track Toolkit mark. build-mark.cjs and
// build-wordmark.cjs both read their geometry and colours from here.
'use strict';

const COLORS = {
  ORANGE: '#FF5500',
  ORANGE_DEEP: '#E64A00',
  INK: '#0F1729',
  WHITE: '#FFFFFF',
  PAPER: '#F8F7F5',
  NIGHT: '#0E121A',
};

// All geometry in a 48-unit square viewBox. Bar thickness T, gap G.
const VB = 48;
const T = 10;   // 20.8 % of canvas
const G = 5;    // 10.4 % of canvas
const ROWS = [4, 4 + T + G, 4 + 2 * (T + G)]; // y of each bar: 4, 19, 34 -> bottom edge 44

// Each candidate: rows of pieces [x0, x1]. `accent` marks the irregular piece.
const CANDIDATES = {
  // "moved": the middle row is pushed sideways out of the left-aligned list.
  shift: {
    name: 'shift',
    rows: [
      [{ x: [4, 36] }],
      [{ x: [14, 44], accent: true }],
      [{ x: [4, 28] }],
    ],
  },
  // "split": the middle row is cut into two pieces with a small gap.
  split: {
    name: 'split',
    rows: [
      [{ x: [4, 44] }],
      [{ x: [4, 24] }, { x: [30, 44], accent: true }],
      [{ x: [4, 32] }],
    ],
  },
};

const CHOSEN = 'shift';
const RUNNER_UP = 'split';
const USE_ACCENT = false; // second flat tone on the irregular piece (tried, dropped: imperceptible at icon sizes)

function pieces(spec) {
  const out = [];
  spec.rows.forEach((row, i) => row.forEach((p) => out.push({ x: p.x[0], y: ROWS[i], w: p.x[1] - p.x[0], h: T, accent: !!p.accent })));
  return out;
}

function bounds(spec) {
  const ps = pieces(spec);
  const x0 = Math.min(...ps.map((p) => p.x)), x1 = Math.max(...ps.map((p) => p.x + p.w));
  const y0 = Math.min(...ps.map((p) => p.y)), y1 = Math.max(...ps.map((p) => p.y + p.h));
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
}

// The mark's rects as markup, optionally translated by (dx, dy).
function rects(spec, { fill, accentFill, dx = 0, dy = 0, indent = '  ' } = {}) {
  return pieces(spec)
    .map((p) => `${indent}<rect x="${p.x + dx}" y="${p.y + dy}" width="${p.w}" height="${p.h}" rx="${T / 2}" fill="${p.accent && accentFill ? accentFill : fill}"/>`)
    .join('\n');
}

function svg(spec, { fill, accentFill, size } = {}) {
  const dim = size ? ` width="${size}" height="${size}"` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VB} ${VB}"${dim} role="img" aria-label="Track Toolkit">\n${rects(spec, { fill, accentFill })}\n</svg>\n`;
}

module.exports = { COLORS, VB, T, G, ROWS, CANDIDATES, CHOSEN, RUNNER_UP, USE_ACCENT, pieces, bounds, rects, svg };
