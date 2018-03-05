import { range } from "./arrays";
import { BitmapFont } from "./bitmap_font";

// various ways to lossily export a font.

export function exportAscii(font: BitmapFont, lineWidth: number = 80): string[] {
  const buffer: string[][] = [];
  let px = 0, py = 0;

  font.glyphs.forEach((glyph, index) => {
    const width = glyph.width + (font.isMonospace ? 0 : 1);
    if (px + width >= lineWidth) {
      py += font.cellHeight + 1;
      px = 0;
    }

    for (let y = 0; y < glyph.height; y++) {
      if (!buffer[py + y]) buffer[py + y] = [];
      for (let x = 0; x < glyph.width; x++) {
        buffer[py + y].push(glyph.getPixel(x, y) ? "@" : " ");
      }
      // space between chars
      if (!font.isMonospace) buffer[py + y].push(" ");
    }
    px += width;

    if (!buffer[py + font.cellHeight]) buffer[py + font.cellHeight] = [];
    const label = (font.codemap[index][0].codePointAt(0) || 0).toString(16);
    buffer[py + font.cellHeight].push(label);
    range(label.length, width).forEach(_ => buffer[py + font.cellHeight].push(" "));
  });
  return buffer.map(line => line.join(""));
}
