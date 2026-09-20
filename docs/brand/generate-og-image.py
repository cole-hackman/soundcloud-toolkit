#!/usr/bin/env python3
"""Generate the editable and outline-rendered Track Toolkit social preview."""

from __future__ import annotations

import argparse
from pathlib import Path

from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

ROOT = Path(__file__).parent
TAGLINE = "Bulk playlist, like and follow management for SoundCloud."


def rounded_bar(x: float, y: float, width: float, height: float, fill: str) -> str:
    r = height / 2
    right, bottom = x + width, y + height
    return (
        f'<path d="M {x+r:g} {y:g} H {right-r:g} A {r:g} {r:g} 0 0 1 {right:g} {y+r:g} '
        f'A {r:g} {r:g} 0 0 1 {right-r:g} {bottom:g} H {x+r:g} A {r:g} {r:g} 0 0 1 {x:g} {y+r:g} '
        f'A {r:g} {r:g} 0 0 1 {x+r:g} {y:g} Z" fill="{fill}"/>'
    )


def outline_tagline(font_path: Path) -> str:
    font = instantiateVariableFont(TTFont(font_path), {"wght": 500}, inplace=False)
    glyph_set, cmap, hmtx = font.getGlyphSet(), font.getBestCmap(), font["hmtx"]
    tracking, scale, cursor = -10, 0.028, 0
    placed, min_x = [], float("inf")
    for char in TAGLINE:
        glyph_name = cmap[ord(char)]
        bounds = BoundsPen(glyph_set)
        glyph_set[glyph_name].draw(bounds)
        if bounds.bounds:
            min_x = min(min_x, cursor + bounds.bounds[0])
        pen = SVGPathPen(glyph_set)
        glyph_set[glyph_name].draw(pen)
        placed.append((cursor, pen.getCommands()))
        cursor += hmtx[glyph_name][0] + tracking
    origin_x, baseline_y = 96 - min_x * scale, 420
    return "\n".join(
        f'  <path d="{commands}" transform="translate({origin_x + x * scale:.6f} {baseline_y}) scale({scale} {-scale})" fill="#FFFFFF" fill-opacity="0.7"/>'
        for x, commands in placed if commands
    )


def illustration() -> str:
    # Two path-only groups express a long playlist split at a cap. Their IDs
    # make the groups editable/selectable without adding visible numerals.
    left = [(704, 138, 212, "#FF5500"), (704, 180, 174, "#FF5500"), (704, 222, 201, "#E64A00"), (704, 264, 153, "#FF5500"), (704, 306, 191, "#FF5500")]
    right = [(946, 138, 178, "#E64A00"), (946, 180, 156, "#FF5500"), (946, 222, 193, "#FF5500"), (946, 264, 133, "#E64A00"), (946, 306, 173, "#FF5500")]
    bars = lambda rows: "\n".join(f"    {rounded_bar(x, y, w, 26, color)}" for x, y, w, color in rows)
    return f'''<g id="split-playlist-illustration" aria-label="Playlist split into group one and group two">
  <g id="playlist-group-one" aria-label="Group one">
{bars(left)}
  </g>
  <g id="playlist-group-two" aria-label="Group two">
{bars(right)}
  </g>
</g>'''


def wordmark_layer() -> str:
    svg = (ROOT / "wordmark-dark.svg").read_text(encoding="utf-8").splitlines()
    contents = "\n".join(svg[1:-1])
    # Prompt 2's source has one bar-height of transparent padding. Align and
    # size the visible artwork, not that padded viewBox.
    scale = 480 / (567.897143 - 40)
    return f'<g id="wordmark" aria-label="Track Toolkit" transform="translate({96 - 20 * scale:.6f} {315 - 58 * scale:.6f}) scale({scale:.9f})">\n{contents}\n</g>'


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("font", type=Path, help="SpaceGrotesk[wght].ttf from the official Google Fonts repository")
    args = parser.parse_args()
    art = illustration()
    wordmark = wordmark_layer()
    editable = f'''<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect id="background" width="1200" height="630" fill="#0E121A"/>
  {wordmark}
  <text id="tagline" x="96" y="420" fill="#FFFFFF" fill-opacity="0.7" font-family="Space Grotesk" font-size="28" font-weight="500" letter-spacing="-0.01em">{TAGLINE}</text>
  {art}
</svg>
'''
    rendered = editable.replace(
        f'  <text id="tagline" x="96" y="420" fill="#FFFFFF" fill-opacity="0.7" font-family="Space Grotesk" font-size="28" font-weight="500" letter-spacing="-0.01em">{TAGLINE}</text>',
        outline_tagline(args.font),
    )
    (ROOT / "og-image.svg").write_text(editable, encoding="utf-8")
    (ROOT / "og-image-render.svg").write_text(rendered, encoding="utf-8")


if __name__ == "__main__":
    main()
