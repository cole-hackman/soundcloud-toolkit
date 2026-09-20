# Brand tools

Helper scripts for the Track Toolkit identity work. Everything under
`frontend-UI/public/brand/` is generated from the SVG sources by these scripts.

## Dependencies

Not part of the project's `package.json`. Install once into any directory and
point `BRAND_DEPS` at it:

```sh
mkdir -p /tmp/brand-deps && cd /tmp/brand-deps && npm init -y && npm i --no-audit --no-fund sharp fontkit
BRAND_DEPS=/tmp/brand-deps node docs/brand/tools/verify-png.cjs frontend-UI/public/brand/*.png
```

- `sharp` rasterizes SVG to PNG with a real alpha channel (libvips/librsvg).
- `fontkit` reads the variable font and instantiates `wght=600` outlines.

## Font

`fonts/SpaceGrotesk[wght].ttf` is Space Grotesk 2.000 by Florian Karsten,
SIL OFL 1.1 (`fonts/OFL.txt`). SHA-256
`acad6de1fc93436f5c0f1f4137751ef04f1aea3063e7036535970ffcfbd79f72`, byte-identical
between the Google Fonts repo (`ofl/spacegrotesk/`) and the 2.0.0 GitHub release.
There is no static SemiBold cut; weight 600 is an instance of the variable axis
(300–700), which is exactly what Google Fonts serves for `font-weight: 600`.

## Scripts

| Script | Purpose |
|---|---|
| `deps.cjs` | Resolves `sharp` / `fontkit` from `BRAND_DEPS` (or fallbacks) |
| `verify-png.cjs` | Alpha, corner, edge and bounding-box check for exported PNGs |
| `mark-spec.cjs` | The one parametric spec (bar size, gap, candidate geometries, colours) both builders read |
| `build-mark.cjs` | Generates `mark.svg`, `mark-white.svg`, `mark-ink.svg`, the icon PNGs, `preview/mark-alt.svg` and the review sheets; runs the alpha and maskable checks |
| `text-outline.cjs` | Shared typography: loads Space Grotesk at wght 600, lays out the string with kerning and -0.01 em tracking, emits outlines; `assertCleanSvg` (outline-only, no root fill/style, no background rect) |
| `build-wordmark.cjs` | Generates the four wordmark SVGs (text as Space Grotesk 600 outlines), the 1200 px and 28 px PNGs and `preview/wordmark-contact-sheet.png`; asserts the SVGs are outline-only |
| `build-stacked.cjs` | Generates the stacked lockup (`wordmark-stacked*.svg/.png`), the monochrome stamps (`stamp-ink`, `stamp-white`, 256 px PNGs) and `preview/stacked-contact-sheet.png` |
| `build-og.cjs` | Generates the opaque 1200x630 social card `og-image.png` (+ layered `og-image.svg`, `preview/og-image-check.png`, `preview/og-image-half.png`) and verifies dimensions, opacity, corner colour, wordmark ink width/offset, safe area and illustration clearance |

## Icon framing

`mark.svg` is a tight 48-unit canvas (bars 10 thick, gaps 5, mark 40x40). The
PNG icons are exported from it with maskable framing: the mark is scaled so
every rounded cap sits at least 5 px inside the 410 px safe circle of a 512
canvas, and 192/180 use the same relative framing. `icon-24.png` is the mark's
own canvas at 24 px (a legibility check, not the padded framing).

## Wordmark layout

Same units as the mark (one bar = 10). Mark ink box at (10,10) 40x40, gap of
one bar, then "Track Toolkit" at a font size of 37.143 units so the cap height
is 26 units (65 % of the mark), tracking -0.01 em, font kerning on, cap-height
box centred on the mark (baseline y = 43). Canvas is the artwork plus one
bar-height of padding on every side: viewBox `0 0 290.294 60`.

## Stacked lockup and stamp

Mark centred above the text on a shared vertical axis. The font size is
derived from the width ratio: text ink width = 1.6 x the mark's 40 units = 64
units, which gives a font size of 10.837 units (cap height 7.586, 19 % of the
mark). Gap from the mark's bottom bar to the cap line is one bar-height, and
the canvas is the artwork plus one bar-height of padding. The stamps are the
same lockup in one flat colour.

## Social card

`og-image.png` is the one opaque asset: `#0E121A` background, the dark
horizontal wordmark scaled so its ink is 480 px wide starting 96 px from the
left, a two-line tagline in Space Grotesk 500 (28 px cap height, white at
70 %) one wordmark bar-height below it, and a playlist-split illustration of
rounded bars on the right. `og-image.svg` is the editable layered source
(outline-only; the tagline lines are the `TAGLINE` array in `build-og.cjs`).

## Regenerate everything

```sh
BRAND_DEPS=/tmp/brand-deps node docs/brand/tools/build-all.cjs
```
