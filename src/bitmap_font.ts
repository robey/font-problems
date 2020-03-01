import { range } from "./arrays";
import { Framebuffer } from "./framebuffer";
import { Glyph } from "./glyph";

export interface ImportOptions {
  // width of each cell in the grid (default: guess)
  cellWidth?: number;

  // height of each cell in the grid (default: guess)
  cellHeight?: number;

  // if false, extra padding on the right of each glyph will be removed (default: true)
  isMonospace?: boolean;

  // if true, the image is white-on-black, instead of black-on-white
  reversed?: boolean;
}

/*
 * representation of a bitmap font.
 *
 * each `Glyph` is a packed bitfield of the on/off data, indexed by the order
 * it was added. `codemap` maps each glyph to a set of unicode sequences.
 */
export class BitmapFont {
  glyphs: Glyph[] = [];
  codemap: number[][] = [];
  cellHeight = 0;

  constructor(public isMonospace: boolean = true) {
    // pass
  }

  maxCellWidth(): number {
    if (this.isMonospace) {
      const glyph = this.glyphs[0];
      return glyph ? glyph.width : 0;
    }
    return Math.max(...Array.from(this.glyphs).map(g => g.width));
  }

  add(glyph: Glyph, codes: number[]) {
    if (this.cellHeight == 0) this.cellHeight = glyph.height;
    if (this.isMonospace && glyph.width != this.maxCellWidth()) this.isMonospace = false;
    this.glyphs.push(glyph);
    this.codemap.push(codes);
  }

  // find the glyph for a character.
  find(code: string): Glyph | undefined {
    for (let i = 0; i < this.codemap.length; i++) {
      if (this.codemap[i].includes(code.codePointAt(0) || 0)) return this.glyphs[i];
    }
    return undefined;
  }

  /*
   * scale the entire font by some whole number (2, 3, ...) by turning every
   * pixel into an NxN square.
   */
  scale(factor: number) {
    this.glyphs = this.glyphs.map(g => g.scale(factor));
    this.cellHeight *= factor;
  }

  /*
   * make a 2D grid (y, x) of the entire font, with the specified number of
   * glyphs per row.
   */
  dumpIntoFramebuffer(glyphsPerRow: number, fgColor: number, bgColor: number): Framebuffer {
    const xStride = this.maxCellWidth(), yStride = this.cellHeight;
    const width = xStride * glyphsPerRow, height = yStride * Math.ceil(this.glyphs.length / glyphsPerRow);
    const fb = new Framebuffer(width, height, 24);
    fb.fill(bgColor);

    let x = 0, y = 0;
    this.glyphs.forEach(glyph => {
      glyph.draw(fb.view(x, y, x + xStride, y + yStride), fgColor, bgColor);
      x += xStride;
      if (x >= fb.width) {
        x = 0;
        y += yStride;
      }
    });
    return fb;
  }

  find_duplicates() {
    for (let i = 0; i < this.glyphs.length - 1; i++) {
      for (let j = i + 1; j < this.glyphs.length; j++) {
        if (this.glyphs[i].is_identical_to(this.glyphs[j])) {
          this.codemap[i].concat(this.codemap[j]);
          this.codemap.splice(j, 1);
          this.glyphs.splice(j, 1);
          j--;
        }
      }
    }
  }

  // remove any glyphs that have no codepoints (or an invalid one)
  remove_dead() {
    for (let i = 0; i < this.glyphs.length; i++) {
      if (this.codemap[i].length == 0) {
        this.codemap.splice(i, 1);
        this.glyphs.splice(i, 1);
        i--;
      }
    }
  }

  // copy glyphs so that there are dupes, but each has only one codepoint
  split_out() {
    for (let i = 0; i < this.glyphs.length; i++) {
      while (this.codemap[i].length > 1) {
        const codepoint = this.codemap[i].splice(1, 1);
        this.codemap.concat(codepoint);
        this.glyphs.concat(this.glyphs[i]);
      }
    }
  }

  // sort by codepoint
  sort() {
    // only works after split_out, so each glyph has one codepoint
    this.remove_dead();
    this.split_out();
    // first, make a single array, so `sort` doesn't poop its pants.
    const full_array = range(0, this.glyphs.length).map(i => {
      return [ this.codemap[i][0], this.glyphs[i] ] as [ number, Glyph ]
    });
    full_array.sort((a, b) => a[0] - b[0]);
    // re-inflate
    this.glyphs = full_array.map(x => x[1]);
    this.codemap = full_array.map(x => [ x[0] ]);
  }

  /*
   * load a bitmap font from a framebuffer.
   *
   * the font must be in a regular grid. (for proportional fonts, align the
   * left edges and leave the extra space on the right.) the grid dimensions
   * can be determined heuristically if they aren't provided.
   *
   * the codemap should be set separately.
   */
  static importFromImage(image: Framebuffer, options: ImportOptions = {}) {
    if (options.reversed) {
      range(0, image.height).map(py => range(0, image.width).map(px => {
        image.setPixel(px, py, image.isOn(px, py) ? 0 : 0xffffff);
      }));
    }

    if (!(options.cellWidth && options.cellHeight)) {
      const { width, height } = sniffBoundaries(image);
      if (!options.cellWidth) options.cellWidth = width;
      if (!options.cellHeight) options.cellHeight = height;
    }
    if (options.isMonospace === undefined) options.isMonospace = true;

    const charRows = image.height / options.cellHeight;
    const charColumns = image.width / options.cellWidth;
    const font = new BitmapFont(options.isMonospace);

    let i = 0;
    for (let y = 0; y < charRows; y++) {
      for (let x = 0; x < charColumns; x++) {
        const px = x * options.cellWidth, py = y * options.cellHeight;
        const view = image.view(px, py, px + options.cellWidth, py + options.cellHeight);
        font.add(Glyph.fromFramebuffer(view, options.isMonospace), [ i ]);
        i++;
      }
    }
    return font;
  }
}


/*
 * detect cell boundaries by finding rows & columns that are mostly empty.
 *
 * calculate the average brightness of all pixels along each row and column,
 * then look for intervals where the rows or columns spaced out along that
 * interval are brighter. for example, if there's a pattern of every 8th row
 * being brighter than the rest, then the cells are probably 8 pixels tall,
 * and the bottom line is the space between glyphs.
 */
export function sniffBoundaries(image: Framebuffer): { width: number, height: number } {
  function average(list: number[]): number {
    return list.reduce((a, b) => a + b, 0) / list.length;
  }

  // convert each row & column into a number representing the "average brightness".
  const rows = range(0, image.height).map(y => average(range(0, image.width).map(x => image.getPixelAsGray(x, y))));
  const columns = range(0, image.width).map(x => average(range(0, image.height).map(y => image.getPixelAsGray(x, y))));

  // average the "average brightness" values for every line along an
  // interval, with a small penalty to larger intervals.
  function checkInterval(lines: number[], interval: number): number {
    return average(range(interval, lines.length, interval).map(i => lines[i - 1])) * Math.pow(0.995, interval);
  }

  function pickBestInterval(lines: number[], low: number, high: number): number {
    // try intervals that evenly divide into the number of lines.
    const intervals = range(low, high).filter(n => n < lines.length && lines.length % n == 0);
    return intervals.map(n => ({ n, weight: checkInterval(lines, n) })).sort((a, b) => {
      // by highest weight, and in case of tie, by smallest n.
      return (a.weight == b.weight) ? a.n - b.n : b.weight - a.weight;
    })[0].n;
  }

  return {
    width: pickBestInterval(columns, 4, 17),
    height: pickBestInterval(rows, 6, 33)
  };
}
