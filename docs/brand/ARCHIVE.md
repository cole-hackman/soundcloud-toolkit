# Codex branding run — archive

This branch preserves the Track Toolkit identity candidate produced by a
Codex agent on 2026-09-20 from the same prompt pack (`logo-prompts.md`) that
drove the `claude-branding` branch. It is kept as a reference, not as a
candidate: the shifted-bar mark from `claude-branding` was chosen on
2026-09-20 (see STATE.md "Decisions" on that branch).

What is here:

- `mark.svg`, `mark-white.svg`, `mark-ink.svg` — split-bar mark (three
  equal-length bars, middle one cut in two; the split piece is `#E64A00` in
  the icon but `#FF5500` in the wordmarks, an inconsistency never resolved).
- `icon-*.png` — transparent exports; 512 passes the maskable safe-circle
  check, 192/180 use a tighter (non-maskable) framing.
- `wordmark*.svg/png`, `wordmark-stacked*`, `stamp-*.svg` — Space Grotesk
  600 outlines via fontTools' variable-font instancer.
- `og-image.png` + `og-image.svg` (text, not outlined) + `og-image-render.svg`
  (outlined) — 1200x630 card, one-line tagline, two-column illustration.
- `contact-sheet.png` — preview.
- `generate-*.py`, `export-*.mjs` — the generators. They take the Space
  Grotesk variable TTF as a path argument; the font itself is not in this
  branch (the `claude-branding` branch carries a hash-verified copy under
  `docs/brand/tools/fonts/`).

Compare against the chosen set with:

    git diff codex-branding claude-branding -- docs/brand frontend-UI/public/brand
