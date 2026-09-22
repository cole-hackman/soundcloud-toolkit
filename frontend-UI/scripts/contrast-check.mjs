#!/usr/bin/env node
// Contrast gate for the design tokens in src/app/globals.css.
//
// Parses the `:root` (light) and `.dark` blocks for `--name: H S% L%;`
// declarations, computes the WCAG 2.x contrast ratio for a fixed list of
// foreground/background pairs in both themes, prints a table and exits 1 if
// any pair is under its threshold. No dependencies on purpose: this runs in
// CI and in `npm run contrast` without an install step.
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const CSS = fileURLToPath(new URL("../src/app/globals.css", import.meta.url));

/** Pairs checked in both themes: [foreground, background, threshold, note]. */
const PAIRS = [
  ["foreground", "background", 4.5, "body text"],
  ["muted-foreground", "background", 4.5, "secondary text"],
  ["muted-foreground", "card", 4.5, "secondary text on cards"],
  ["muted-foreground-subtle", "background", 4.5, "subtle text"],
  ["primary-text", "background", 4.5, "orange as text"],
  ["primary-text", "card", 4.5, "orange as text on cards"],
  // 3.0 because the uses this gate knows about are icons, and a glyph is a
  // graphical object under 1.4.11. It is NOT a statement that no text uses
  // the pair — this script compares token pairs, it cannot see a call site,
  // and a first sweep here missed two (the EmptyState links in
  // ListExportCard and TrackExportCard) precisely because they carry
  // `text-primary-text` at rest and add only `hover:bg-accent`, so grepping
  // for `hover:text-primary-text` never found them.
  //
  // So before trusting this line, search BOTH forms:
  //   `hover:text-primary-text`                  (hover swaps the colour in)
  //   `text-primary-text` + `hover:bg-accent`    (hover swaps the surface in)
  // Anything textual that turns up hovers to `--accent-foreground` instead,
  // gated on the next line at the full 4.5.
  ["primary-text", "accent", 3.0, "orange ICON on a hovered row (1.4.11)"],
  ["accent-foreground", "accent", 4.5, "text on a hovered row"],
  ["primary-foreground", "primary", 4.5, "primary button label"],
  ["destructive-foreground", "destructive", 4.5, "destructive button label"],
  ["destructive-text", "background", 4.5, "error text"],
  ["success-text", "background", 4.5, "success text"],
  ["warning-text", "background", 4.5, "warning text"],
  ["input", "background", 3.0, "1.4.11 control border"],
  ["ring", "background", 3.0, "1.4.11 focus ring"],
  ["tone-foreground", "tone-download", 4.5, "free-download chip label"],
  ["tone-foreground", "tone-purchase", 4.5, "purchase-link chip label"],
  ["tone-foreground", "tone-match", 4.5, "high-match badge label"],
];

/**
 * Pairs whose surface is an ALPHA utility rather than a token on its own:
 * `[foreground, tint, alpha, base, threshold, note]` renders as
 * `bg-<tint>/<alpha*100>` over `bg-<base>`.
 *
 * This list exists because checking resting token values alone is not enough
 * to know what ships. `Button variant="destructive"` hovers to
 * `bg-destructive/90`, and while `--destructive` passed on its own that
 * composite put white at 4.32:1 — a hover below AA on every confirm button in
 * the app, green on this gate the whole time. Same blind spot for the brand
 * tints: `bg-primary/10 text-primary-text` is how an active nav item, a genre
 * chip and a secondary CTA are built, and it measured 4.21:1.
 *
 * Two bases per tint on purpose: a tint over `--background` and the same tint
 * over `--card` are different colours, and which one a component lands on is
 * a layout decision, so both have to hold.
 *
 * **`bg-primary/20` is the deepest gated brand tint**, and that number is a
 * contract in two directions: `--primary-text` was chosen so it holds there
 * (dark mode had to come up to 56% for it), and no call site may go deeper,
 * because past 20% nothing here says whether it still passes. The comment on
 * `--primary-text` in globals.css quotes the same 20%; keep them in step.
 *
 * Bases are a floor, not the whole truth: a tint over a *toned* panel — say
 * `ResultPanel tone="success"` — composites over a colour this gate has no
 * token for. Staying inside the gated bound is necessary, not sufficient.
 */
const TINTED_PAIRS = [
  ["destructive-foreground", "destructive", 0.9, "background", 4.5, "destructive button hover"],
  ["destructive-foreground", "destructive", 0.9, "card", 4.5, "destructive button hover on a card"],
  ["primary-foreground", "primary", 0.9, "background", 4.5, "primary button hover"],
  ["primary-foreground", "primary", 0.9, "card", 4.5, "primary button hover on a card"],
  ["primary-text", "primary", 0.1, "background", 4.5, "orange as text on the brand tint"],
  ["primary-text", "primary", 0.1, "card", 4.5, "orange as text on the brand tint, on a card"],
  ["primary-text", "primary", 0.15, "background", 4.5, "…at the brand-tint hover"],
  ["primary-text", "primary", 0.15, "card", 4.5, "…same, on a card"],
  ["primary-text", "primary", 0.2, "background", 4.5, "…at the DEEPEST gated brand tint"],
  ["primary-text", "primary", 0.2, "card", 4.5, "…same, on a card — the binding case"],
  ["destructive-text", "destructive", 0.1, "background", 4.5, "destructive icon-button hover"],
  ["destructive-text", "destructive", 0.1, "card", 4.5, "destructive icon-button hover on a card"],
  ["muted-foreground", "secondary", 0.2, "background", 4.5, "secondary text on a tinted panel"],
  ["muted-foreground-subtle", "secondary", 0.2, "background", 4.5, "subtle text on a tinted panel"],
  ["muted-foreground-subtle", "secondary", 0.2, "card", 4.5, "subtle text on a tinted panel, on a card"],
  ["tone-foreground", "tone-download", 0.9, "background", 4.5, "free-download chip hover"],
  ["tone-foreground", "tone-purchase", 0.9, "background", 4.5, "purchase-link chip hover"],
];

/** Light-mode `.text-gradient` stops, large text only (3:1). */
const GRADIENT_STOPS = ["#e04000", "#f04a00", "#ff5500"];

// Knowingly-accepted near misses, keyed `<theme>:<fg> / <bg>`. These print as
// WARN with their real ratio and their reason instead of failing the gate.
// Nothing goes in here without a reason written beside it.
const ALLOWANCES = {
  "dark:input / background": {
    min: 2.9,
    reason: "border plus the --surface fill together identify the control",
  },
};

function parseBlock(css, selector) {
  const start = css.indexOf(selector);
  if (start === -1) throw new Error(`No ${selector} block in globals.css`);
  const open = css.indexOf("{", start);
  const close = css.indexOf("}", open);
  const body = css.slice(open + 1, close);
  const tokens = {};
  for (const [, name, h, s, l] of body.matchAll(
    /--([a-z0-9-]+):\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%\s*;/g,
  )) {
    tokens[name] = [Number(h), Number(s), Number(l)];
  }
  return tokens;
}

function hslToRgb([h, s, l]) {
  const sat = s / 100;
  const lig = l / 100;
  const c = (1 - Math.abs(2 * lig - 1)) * sat;
  const hp = (h % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  const [r, g, b] =
    hp < 1 ? [c, x, 0]
    : hp < 2 ? [x, c, 0]
    : hp < 3 ? [0, c, x]
    : hp < 4 ? [0, x, c]
    : hp < 5 ? [x, 0, c]
    : [c, 0, x];
  const m = lig - c / 2;
  return [r + m, g + m, b + m];
}

function hexToRgb(hex) {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255);
}

function luminance(rgb) {
  const [r, g, b] = rgb.map((v) =>
    v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(fg, bg) {
  const a = luminance(fg);
  const b = luminance(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** `background-color: hsl(tint / alpha)` painted over an opaque `base`. */
function composite(tint, base, alpha) {
  return tint.map((channel, i) => channel * alpha + base[i] * (1 - alpha));
}

const css = await readFile(CSS, "utf8");
const light = parseBlock(css, ":root {");
const themes = {
  light,
  // `.dark` only overrides the tokens it redeclares; everything else
  // cascades down from `:root`. Modelling that is what lets a deliberately
  // theme-independent token (the `--tone-*` chips) be declared once.
  dark: { ...light, ...parseBlock(css, ".dark {") },
};

const rows = [];
function token(theme, tokens, name) {
  if (!tokens[name]) throw new Error(`${theme}: missing --${name}`);
  return hslToRgb(tokens[name]);
}

for (const [theme, tokens] of Object.entries(themes)) {
  for (const [fg, bg, min, note] of PAIRS) {
    rows.push({
      theme,
      pair: `${fg} / ${bg}`,
      value: ratio(token(theme, tokens, fg), token(theme, tokens, bg)),
      min,
      note,
    });
  }
  for (const [fg, tint, alpha, base, min, note] of TINTED_PAIRS) {
    const surface = composite(
      token(theme, tokens, tint),
      token(theme, tokens, base),
      alpha,
    );
    rows.push({
      theme,
      pair: `${fg} / ${tint}@${Math.round(alpha * 100)} on ${base}`,
      value: ratio(token(theme, tokens, fg), surface),
      min,
      note,
    });
  }
}
for (const stop of GRADIENT_STOPS) {
  rows.push({
    theme: "light",
    pair: `gradient ${stop} / background`,
    value: ratio(hexToRgb(stop), hslToRgb(themes.light.background)),
    min: 3.0,
    note: "large text only",
  });
}

const width = (key, head) =>
  Math.max(head.length, ...rows.map((r) => String(r[key]).length));
const w = {
  theme: width("theme", "THEME"),
  pair: width("pair", "PAIR"),
  note: width("note", "NOTE"),
};
const line = (theme, pair, ratioText, min, status, note) =>
  `${theme.padEnd(w.theme)}  ${pair.padEnd(w.pair)}  ${ratioText.padStart(7)}  ${min.padStart(5)}  ${status.padEnd(4)}  ${note}`;

console.log(line("THEME", "PAIR", "RATIO", "MIN", "OK?", "NOTE"));
console.log("-".repeat(w.theme + w.pair + w.note + 30));

let failures = 0;
let warnings = 0;
for (const row of rows) {
  const allowance = ALLOWANCES[`${row.theme}:${row.pair}`];
  let status = row.value >= row.min ? "PASS" : "FAIL";
  let note = row.note;
  if (status === "FAIL" && allowance && row.value >= allowance.min) {
    status = "WARN";
    note = `${row.note} — allowed: ${allowance.reason}`;
  }
  if (status === "FAIL") failures += 1;
  if (status === "WARN") warnings += 1;
  console.log(
    line(
      row.theme,
      row.pair,
      `${row.value.toFixed(2)}:1`,
      row.min.toFixed(1),
      status,
      note,
    ),
  );
}

if (failures > 0) {
  console.error(`\n${failures} contrast pair(s) below threshold.`);
  process.exit(1);
}
const suffix = warnings > 0 ? ` (${warnings} allowed near miss)` : "";
console.log(`\nAll ${rows.length} contrast pairs pass${suffix}.`);
