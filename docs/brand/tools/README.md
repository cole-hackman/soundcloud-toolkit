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
