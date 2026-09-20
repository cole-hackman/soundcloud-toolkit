#!/usr/bin/env python3
"""Generate outlined Track Toolkit wordmarks from Space Grotesk SemiBold."""

from __future__ import annotations

import argparse
from pathlib import Path

from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

TEXT = "Track Toolkit"
MARK_X = 20
MARK_Y = 20
MARK_WIDTH = 76
MARK_HEIGHT = 76
BAR_HEIGHT = 20
TEXT_LEFT = MARK_X + MARK_WIDTH + BAR_HEIGHT
TARGET_CAP_HEIGHT = MARK_HEIGHT * 0.65


def glyph_path(glyph_set, glyph_name: str) -> str:
    pen = SVGPathPen(glyph_set)
    glyph_set[glyph_name].draw(pen)
    return pen.getCommands()


def rounded_bar_path(x: float, y: float, width: float) -> str:
    r = BAR_HEIGHT / 2
    right = x + width
    bottom = y + BAR_HEIGHT
    return (
        f"M {x + r:g} {y:g} H {right - r:g} "
        f"A {r:g} {r:g} 0 0 1 {right:g} {y + r:g} "
        f"A {r:g} {r:g} 0 0 1 {right - r:g} {bottom:g} "
        f"H {x + r:g} A {r:g} {r:g} 0 0 1 {x:g} {y + r:g} "
        f"A {r:g} {r:g} 0 0 1 {x + r:g} {y:g} Z"
    )


def build_wordmark(font_path: Path, mark_fill: str, text_fill: str) -> str:
    font = instantiateVariableFont(TTFont(font_path), {"wght": 600}, inplace=False)
    glyph_set = font.getGlyphSet()
    cmap = font.getBestCmap()
    hmtx = font["hmtx"]

    cap_pen = BoundsPen(glyph_set)
    glyph_set[cmap[ord("T")]].draw(cap_pen)
    cap_height = cap_pen.bounds[3] - cap_pen.bounds[1]
    scale = TARGET_CAP_HEIGHT / cap_height
    tracking = -0.01 * font["head"].unitsPerEm

    placements = []
    cursor = 0.0
    min_y, max_y = float("inf"), float("-inf")
    min_x, max_x = float("inf"), float("-inf")
    for char in TEXT:
        glyph_name = cmap[ord(char)]
        pen = BoundsPen(glyph_set)
        glyph_set[glyph_name].draw(pen)
        if pen.bounds:
            x0, y0, x1, y1 = pen.bounds
            min_x = min(min_x, cursor + x0)
            max_x = max(max_x, cursor + x1)
            min_y = min(min_y, y0)
            max_y = max(max_y, y1)
        placements.append((cursor, glyph_path(glyph_set, glyph_name)))
        cursor += hmtx[glyph_name][0] + tracking

    # Align the text outline—not its font box—on the requested horizontal gap
    # and vertically center the text’s real bounds on the mark.
    text_origin_x = TEXT_LEFT - min_x * scale
    baseline_y = MARK_Y + MARK_HEIGHT / 2 + (min_y + max_y) * scale / 2
    text_right = text_origin_x + max_x * scale
    canvas_width = text_right + BAR_HEIGHT
    canvas_height = MARK_Y + MARK_HEIGHT + BAR_HEIGHT

    paths = "\n".join(
        f'  <path d="{commands}" transform="translate({text_origin_x + x * scale:.6f} {baseline_y:.6f}) scale({scale:.9f} {-scale:.9f})" fill="{text_fill}"/>'
        for x, commands in placements
        if commands
    )

    bars = "\n".join(
        f'  <path d="{rounded_bar_path(x, y, width)}" fill="{mark_fill}"/>'
        for x, y, width in (
            (MARK_X, MARK_Y, 76),
            (MARK_X, 48, 33),
            (59, 48, 37),
            (MARK_X, 76, 76),
        )
    )
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {canvas_width:.6f} {canvas_height}">
{bars}
{paths}
</svg>
'''


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("font", type=Path, help="SpaceGrotesk[wght].ttf from the official Google Fonts repository")
    parser.add_argument("--output", type=Path, default=Path(__file__).parent)
    args = parser.parse_args()

    variants = {
        "wordmark.svg": ("#FF5500", "#0F1729"),
        "wordmark-dark.svg": ("#FF5500", "#FFFFFF"),
        "wordmark-mono-white.svg": ("#FFFFFF", "#FFFFFF"),
        "wordmark-mono-ink.svg": ("#0F1729", "#0F1729"),
    }
    for name, (mark_fill, text_fill) in variants.items():
        (args.output / name).write_text(build_wordmark(args.font, mark_fill, text_fill), encoding="utf-8")


if __name__ == "__main__":
    main()
