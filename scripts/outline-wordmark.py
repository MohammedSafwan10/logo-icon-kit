"""Outline simple left-to-right labels from a font supplied by the caller."""
import argparse
import html
import json
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--font", required=True)
    parser.add_argument("--text", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--tracking", type=float, default=0)
    args = parser.parse_args()
    if not args.text.strip():
        parser.error("text must not be empty")
    try:
        from fontTools.ttLib import TTFont
        from fontTools.pens.svgPathPen import SVGPathPen
        from fontTools.pens.transformPen import TransformPen
        from fontTools.pens.boundsPen import BoundsPen
    except ImportError:
        parser.error("fontTools is required: install it in the chosen Python environment")
    font = TTFont(args.font)
    glyphs = font.getGlyphSet()
    cmap = font.getBestCmap()
    scale = 100 / font["head"].unitsPerEm
    pen = SVGPathPen(glyphs)
    bounds = BoundsPen(glyphs)
    x = 0
    for char in args.text:
        if ord(char) not in cmap:
            parser.error(f"font has no glyph for {char!r}")
        glyph = glyphs[cmap[ord(char)]]
        transform = (scale, 0, 0, -scale, x, 100)
        glyph.draw(TransformPen(pen, transform))
        glyph.draw(TransformPen(bounds, transform))
        x += glyph.width * scale + args.tracking
    if not bounds.bounds:
        parser.error("the text has no visible glyphs")
    x_min, y_min, x_max, y_max = bounds.bounds
    margin = 4
    viewbox = f"{x_min - margin:g} {y_min - margin:g} {x_max - x_min + 2 * margin:g} {y_max - y_min + 2 * margin:g}"
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{viewbox}" role="img" aria-label="{html.escape(args.text, quote=True)}"><path d="{pen.getCommands()}" fill="#000000"/></svg>\n'
    target = Path(args.output)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(svg, encoding="utf-8")
    print(json.dumps({"output": str(target), "font": font["name"].getDebugName(1), "text": args.text}))


if __name__ == "__main__":
    main()
