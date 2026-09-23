#!/usr/bin/env node
// Contrast gate for the design tokens in src/app/globals.css.
//
// Parses the `:root` (light) and `.dark` blocks for `--name: H S% L%;`
// declarations, computes the WCAG 2.x contrast ratio for a fixed list of
// foreground/background pairs in both themes, prints a table and exits 1 if
// any pair is under its threshold. No dependencies on purpose, so it runs from
// `npm run contrast` with no install step.
//
// WHERE IT RUNS: by hand. Nothing invokes it automatically — `npm run build`
// is `next build` alone, and the GitHub workflow runs the Jest suite and the
// build, not this. CLAUDE.md's "Development Commands / Frontend" section names
// it in the run-before-you-claim-done line, which is the whole of the process
// around it. Do not describe it anywhere as a check that "fails the build"
// unless someone has actually wired it into one.
//
// WHAT IT DOES NOT COVER — read this before quoting its score.
// It compares *token pairs*. It cannot see a call site, so a green run is
// evidence that the tokens can be combined safely, not that every component
// combines them that way. Two consequences worth naming:
//
//  1. Until 2026-09-22 it held no admin-console pair at all, and reported
//     "All 73 pass" the whole time the console's own `TONE_SOFT` map was
//     rendering a 10px pill at 1.43:1. The ADMIN_* block near the bottom now
//     covers that map — every tone, both halves, over the three surfaces a
//     console pill lands on. It covers it by READING `primitives.tsx`, not by
//     restating it here: the first version of this block was a hand-copied
//     replica, and a replica cannot notice its original changing. Regressing
//     `TONE_SOFT.ok` back to `text-chart-3` left it printing 115 passing pairs.
//  2. It still cannot catch a component that reaches past the tone maps for a
//     raw `--chart-*` or `--primary`. The console's views were swept onto the
//     `*-text` tokens in the same change, and the only deliberate survivors
//     are the three `<Sparkline className="text-chart-*">` call sites in
//     OverviewView (see the note on `Sparkline` in components/admin/charts.tsx).
//     Nothing here would notice a new one.
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const CSS = fileURLToPath(new URL("../src/app/globals.css", import.meta.url));
const ADMIN_PRIMITIVES = fileURLToPath(
  new URL("../src/components/admin/primitives.tsx", import.meta.url),
);

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
 * Bases are a floor, not the whole truth: a tint composited over a surface
 * whose fill is not a token lands on a colour this gate cannot name. The live
 * example is `SelectableRow`, whose unselected light-mode fill is a raw
 * `bg-gray-50` (its dark fill, `bg-secondary/20`, *is* gated) — so every row
 * in the app stacks its text on something no pair below describes. Staying
 * inside the gated bound is necessary, not sufficient.
 *
 * A *toned* panel is not automatically such a case, and assuming so was wrong
 * once already: `ResultPanel tone="success"` only tints its **border**
 * (`border-green-200`), and its fill is `Card`'s `bg-card`, which is gated.
 * Check which property the tone actually sets before trusting either answer.
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

/**
 * The admin console's tone system, READ FROM
 * `src/components/admin/primitives.tsx` rather than restated here.
 *
 * `TONE_SOFT` is `bg-<tint>/<alpha> text-<ink>` and `TONE_TEXT` is the ink on
 * its own; `TONE_BG` is bars and dots, which are graphical and not gated.
 *
 * This is parsed, not copied, and that is the whole point. The first version
 * of this block was a hand-written replica of `TONE_SOFT`, which meant the
 * gate was checking a copy: editing `primitives.tsx` to put a chart colour
 * back on 10px text left it reporting 115 passing pairs and exiting 0. A gate
 * that names a file it cannot see is worse than no gate, because the score
 * gets quoted. Parsing costs ten lines and the divergence becomes impossible
 * rather than merely discouraged.
 *
 * The class→token mapping is identity by construction: `text-primary-text` is
 * `hsl(var(--primary-text))` in tailwind.config.ts, `bg-chart-3` is
 * `--chart-3`, and so on, so stripping the utility prefix gives the custom
 * property name. A class whose token is not in globals.css throws by name
 * from `token()`, which is the right failure — it means the two files have
 * drifted.
 */
function parseToneMap(source, name, { classesPerTone = 2 } = {}) {
  const block = source.match(
    new RegExp(`export const ${name}: Record<Tone, string> = \\{([\\s\\S]*?)\\n\\};`),
  );
  if (!block) {
    throw new Error(
      `${name} not found in components/admin/primitives.tsx. This gate reads that map ` +
      'rather than duplicating it; if it was renamed or reshaped, update the parser — ' +
      'do not re-inline the values, which is the bug this replaced.',
    );
  }
  const entries = [];
  for (const [, tone, classes] of block[1].matchAll(/^\s*(\w+):\s*"([^"]+)",\s*$/gm)) {
    const words = classes.trim().split(/\s+/);
    if (words.length !== classesPerTone) {
      throw new Error(`${name}.${tone} has ${words.length} classes, expected ${classesPerTone}: "${classes}"`);
    }
    const ink = classes.match(/(?:^|\s)text-([a-z0-9-]+)(?=\s|$)/);
    if (!ink) throw new Error(`${name}.${tone} has no text- class: "${classes}"`);
    if (classesPerTone === 1) {
      entries.push([tone, ink[1]]);
      continue;
    }
    const bg = classes.match(/(?:^|\s)bg-([a-z0-9-]+)(?:\/(\d+))?(?=\s|$)/);
    if (!bg) throw new Error(`${name}.${tone} has no bg- class: "${classes}"`);
    // No `/NN` means an opaque fill: the surface under it is irrelevant.
    entries.push([tone, ink[1], bg[1], bg[2] ? Number(bg[2]) / 100 : 1]);
  }
  return entries;
}

/** The six tones, in the order the type declares them. A tone that disappears
 *  or is renamed has to be noticed here rather than quietly shrink the table. */
const EXPECTED_TONES = ["primary", "ok", "warn", "danger", "info", "muted"];

const primitives = await readFile(ADMIN_PRIMITIVES, "utf8");
const ADMIN_TONES = parseToneMap(primitives, "TONE_SOFT");
const ADMIN_TONE_TEXT = parseToneMap(primitives, "TONE_TEXT", { classesPerTone: 1 });
for (const [label, parsed] of [["TONE_SOFT", ADMIN_TONES], ["TONE_TEXT", ADMIN_TONE_TEXT]]) {
  const tones = parsed.map(([tone]) => tone);
  if (tones.join(",") !== EXPECTED_TONES.join(",")) {
    throw new Error(
      `${label} tones are [${tones}], expected [${EXPECTED_TONES}]. ` +
      // Order matters as well as membership, so this fires for a reorder too —
      // in which case nothing was added and there is nothing to check. Name
      // both possibilities rather than sending the reader to edit a list that
      // is already correct.
      'If a tone was added or renamed, update EXPECTED_TONES once you have ' +
      'checked its numbers. If the same six were only reordered, reorder ' +
      'EXPECTED_TONES to match — the order is what makes a dropped entry an ' +
      'error instead of a quietly shorter table.',
    );
  }
}

/**
 * The surfaces a console pill lands on. `Panel` is `bg-card/85` over the page,
 * so `card` and `background` bracket it in both themes — but the third base is
 * not bracketed by anything: the unread row in the Feedback inbox adds a
 * `bg-primary/[0.05]` brand wash on top (`views/FeedbackView.tsx`), and a tint
 * over a tint lands on a colour neither of the other two names. It is modelled
 * rather than assumed, because assuming was the failure mode.
 */
const ADMIN_BASES = [
  ["background", null],
  ["card", null],
  ["card+unread", ["primary", 0.05, "card"]],
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

/** `<theme>:<pair>` of every row already emitted, so a derived admin row that
 *  restates a PAIRS entry is dropped rather than duplicated. */
const seen = new Set();

for (const [theme, tokens] of Object.entries(themes)) {
  for (const [fg, bg, min, note] of PAIRS) {
    const pair = `${fg} / ${bg}`;
    seen.add(`${theme}:${pair}`);
    rows.push({
      theme,
      pair,
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
  // `TONE_TEXT` ink on a plain surface (the Stat tile's aside, the Mini
  // value). Rows the PAIRS list already carries are skipped so the table does
  // not print the same measurement twice under two names — `seen` is keyed on
  // theme and pair, not on the tone, because two tones can share an ink.
  for (const [tone, ink] of ADMIN_TONE_TEXT) {
    for (const base of ["background", "card"]) {
      const pair = `${ink} / ${base}`;
      if (seen.has(`${theme}:${pair}`)) continue;
      seen.add(`${theme}:${pair}`);
      rows.push({
        theme,
        pair,
        value: ratio(token(theme, tokens, ink), token(theme, tokens, base)),
        min: 4.5,
        note: `admin console TONE_TEXT (${tone})`,
      });
    }
  }
  for (const [tone, ink, tint, alpha] of ADMIN_TONES) {
    // An opaque fill hides whatever is under it, so one base says everything.
    const bases = alpha === 1 ? ADMIN_BASES.slice(1, 2) : ADMIN_BASES;
    for (const [baseName, nested] of bases) {
      const base = nested
        ? composite(
            token(theme, tokens, nested[0]),
            token(theme, tokens, nested[2]),
            nested[1],
          )
        : token(theme, tokens, baseName);
      const surface =
        alpha === 1 ? token(theme, tokens, tint) : composite(token(theme, tokens, tint), base, alpha);
      rows.push({
        theme,
        pair: `admin ${tone}: ${ink} / ${tint}@${Math.round(alpha * 100)} on ${baseName}`,
        value: ratio(token(theme, tokens, ink), surface),
        min: 4.5,
        note: "admin console TONE_SOFT pill",
      });
    }
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
