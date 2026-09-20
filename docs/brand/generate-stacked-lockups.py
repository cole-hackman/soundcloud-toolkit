#!/usr/bin/env python3
"""Generate outlined stacked Track Toolkit lockups from Space Grotesk SemiBold."""

from __future__ import annotations

import argparse
from pathlib import Path

from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

TEXT = "Track Toolkit"
MARK_WIDTH = 76
MARK_HEIGHT = 76
BAR_HEIGHT = 20
TEXT_WIDTH = MARK_WIDTH * 1.6


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


def glyph_path(glyph_set, glyph_name: str) -> str:
    pen = SVGPathPen(glyph_set)
    glyph_set[glyph_name].draw(pen)
    return pen.getCommands()


def build_lockup(font_path: Path, mark_fill: str, text_fill: str) -> str:
    font = instantiateVariableFont(TTFont(font_path), {"wght": 600}, inplace=False)
    glyph_set = font.getGlyphSet()
    cmap = font.getBestCmap()
    hmtx = font["hmtx"]
    tracking = -0.01 * font["head"].unitsPerEm

    placements = []
    cursor = 0.0
    min_x, max_x = float("inf"), float("-inf")
    min_y, max_y = float("inf"), float("-inf")
    for char in TEXT:
        glyph_name = cmap[ord(char)]
        pen = BoundsPen(glyph_set)
        glyph_set[glyph_name].draw(pen)
        if pen.bounds:
            x0, y0, x1, y1 = pen.bounds
            min_x, max_x = min(min_x, cursor + x0), max(max_x, cursor + x1)
            min_y, max_y = min(min_y, y0), max(max_y, y1)
        placements.append((cursor, glyph_path(glyph_set, glyph_name)))
        cursor += hmtx[glyph_name][0] + tracking

    scale = TEXT_WIDTH / (max_x - min_x)
    canvas_width = TEXT_WIDTH + BAR_HEIGHT * 2
    mark_x = (canvas_width - MARK_WIDTH) / 2
    mark_y = BAR_HEIGHT
    text_left = BAR_HEIGHT
    text_top = mark_y + MARK_HEIGHT + BAR_HEIGHT
    text_origin_x = text_left - min_x * scale
    baseline_y = text_top + max_y * scale
    canvas_height = text_top + (max_y - min_y) * scale + BAR_HEIGHT

    text_paths = "\n".join(
        f'  <path d="{commands}" transform="translate({text_origin_x + x * scale:.6f} {baseline_y:.6f}) scale({scale:.9f} {-scale:.9f})" fill="{text_fill}"/>'
        for x, commands in placements
        if commands
    )
    bars = "\n".join(
        f'  <path d="{rounded_bar_path(x, y, width)}" fill="{mark_fill}"/>'
        for x, y, width in (
            (mark_x, mark_y, 76),
            (mark_x, mark_y + 28, 33),
            (mark_x + 39, mark_y + 28, 37),
            (mark_x, mark_y + 56, 76),
        )
    )
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {canvas_width:.6f} {canvas_height:.6f}">
{bars}
{text_paths}
</svg>
'''


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("font", type=Path, help="SpaceGrotesk[wght].ttf from the official Google Fonts repository")
    parser.add_argument("--output", type=Path, default=Path(__file__).parent)
    args = parser.parse_args()
    variants = {
        "wordmark-stacked.svg": ("#FF5500", "#0F1729"),
        "wordmark-stacked-dark.svg": ("#FF5500", "#FFFFFF"),
        "stamp-white.svg": ("#FFFFFF", "#FFFFFF"),
        "stamp-ink.svg": ("#0F1729", "#0F1729"),
    }
    for name, (mark_fill, text_fill) in variants.items():
        (args.output / name).write_text(build_lockup(args.font, mark_fill, text_fill), encoding="utf-8")


if __name__ == "__main__":
    main()
