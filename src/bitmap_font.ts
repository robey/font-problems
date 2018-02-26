import { arrayGrouped, range } from "./arrays";
import { Framebuffer } from "./framebuffer";
import { sniffBoundaries } from "./tools";
import { unicodeFromRanges } from "./unicodes";

/*
 * representation of a bitmap font.
 * each glyph is a packed Buffer of (y, x) to 1 or 0 (on or off).
 * x, y are left to right, top to bottom.
 * characters are indexed by unicode index (int), for example "A" is 65.
 */
export class BitmapFont {
  glyphs = new Map<number, Glyph>();
  order: number[] = [];
  cellHeight = 0;

  constructor(public isMonospace: boolean = false) {
    // pass
  }

  maxCellWidth(): number {
    if (this.isMonospace) {
      const glyph = this.glyphs.get(this.order[0]);
      return glyph ? glyph.width : 0;
    }
    return Math.max(...Array.from(this.glyphs.values()).map(g => g.width));
  }

  add(char: number, glyph: Glyph) {
    if (this.cellHeight == 0) this.cellHeight = glyph.height;
    this.glyphs.set(char, glyph);
    this.order.push(char);
  }






  /*
   * make a 2D grid (y, x) of the entire font, fitting as many glyphs into
   * each horizontal "line" as possible.
   */
  // __dumpIntoGrid(width: number): number[][] {
  //   let rows: number[][] = [];
  //   const charsPerRow = Math.floor(width / this.maxCellWidth());
  //   arrayGrouped(this.order, charsPerRow).forEach(chars => {
  //     const charRow: number[][] = new Array(this.cellHeight);
  //     chars.forEach(char => {
  //       const data = this.get(char);
  //       for (let i = 0; i < charRow.length; i++) charRow[i] = charRow[i].concat(data[i]);
  //     });
  //     rows = rows.concat(charRow);
  //   });
  //   return rows;
  // }

  /*
   * load a bitmap font from a framebuffer.
   *
   * the font must be in a regular grid. (for proportional fonts, align the
   * left edges and leave the extra space on the right.) the grid dimensions
   * can be determined heuristically if they aren't provided.
   *
   * the unicode code-point generator should be some iterable (usually
   * provided by `unicodeFromRanges`) that provides the sequence of code
   * points (as numbers) to assign to each glyph in order. the default
   * generator starts from code-point zero.
   */
  static importFromImage(image: Framebuffer, options: ImportOptions = {}) {
    if (!(options.cellWidth && options.cellHeight)) {
      const { width, height } = sniffBoundaries(image);
      options.cellWidth = width;
      options.cellHeight = height;
    }
    if (options.isMonospace === undefined) options.isMonospace = true;
    if (!options.codePoints) options.codePoints = unicodeFromRanges("0-");

    const charRows = image.height / options.cellHeight;
    const charColumns = image.width / options.cellWidth;
    const font = new BitmapFont(options.isMonospace);

    const unicode = options.codePoints[Symbol.iterator]();
    for (let y = 0; y < charRows; y++) {
      for (let x = 0; x < charColumns; x++) {
        const px = x * options.cellWidth, py = y * options.cellHeight;
        const view = image.view(px, py, px + options.cellWidth, py + options.cellHeight);
        font.add(unicode.next().value, Glyph.fromFramebuffer(view, options.isMonospace));
      }
    }
    return font;
  }
}


export interface ImportOptions {
  // width of each cell in the grid (default: guess)
  cellWidth?: number;

  // height of each cell in the grid (default: guess)
  cellHeight?: number;

  // if false, extra padding on the right of each glyph will be removed (default: true)
  isMonospace?: boolean;

  // assign unicode code points to each glyph in order
  codePoints?: Iterable<number>;
}


export class Glyph {
  constructor(public data: Uint8Array, public width: number, public height: number) {
    // pass
  }

  get rawHex(): string {
    return range(0, this.data.length).map(i => ("0" + this.data[i].toString(16)).slice(-2)).join("");
  }

  getPixel(x: number, y: number): boolean {
    const offset = y * this.width + x;
    return (this.data[Math.floor(offset / 8)] & (1 << (offset % 8))) != 0;
  }

  setPixel(x: number, y: number) {
    const offset = y * this.width + x;
    this.data[Math.floor(offset / 8)] |= (1 << (offset % 8));
  }

  draw(fb: Framebuffer, fgColor: number, bgColor: number) {
    for (let py = 0; py < this.height; py++) {
      for (let px = 0; px < this.width; px++) {
        fb.setPixel(px, py, this.getPixel(px, py) ? fgColor : bgColor);
      }
    }
  }

  /*
   * pack into an array of ints, each int as one row.
   * LE = smallest bit on the left.
   * BE = smallest bit on the right.
   */
  packIntoRows(direction: BitDirection = BitDirection.LE): number[] {
    const rv = [];
    for (let y = 0; y < this.height; y++) {
      let line = 0;
      for (let x = 0; x < this.width; x++) {
        const px = direction == BitDirection.LE ? this.width - x - 1 : x;
        line = (line << 1) | (this.getPixel(px, y) ? 1 : 0);
      }
      if (direction == BitDirection.BE && this.width % 8 != 0) {
        // pad on the right so the left pixel aligns with a byte boundary!
        line <<= (8 - this.width % 8);
      }
      rv.push(line);
    }
    return rv;
  }

  /*
   * pack into an array of ints, each int as one column.
   * LE = smallest bit on top.
   * BE = smallest bit on bottom.
   */
  packIntoColumns(direction: BitDirection = BitDirection.LE): number[] {
    const rv = [];
    for (let x = 0; x < this.width; x++) {
      let line = 0;
      for (let y = 0; y < this.height; y++) {
        const py = direction == BitDirection.LE ? this.height - y - 1 : y;
        line = (line << 1) | (this.getPixel(x, py) ? 1 : 0);
      }
      if (direction == BitDirection.BE && this.height % 8 != 0) {
        // pad on the bottom so the top pixel aligns with a byte boundary!
        line <<= (8 - this.height % 8);
      }
      rv.push(line);
    }
    return rv;
  }

  static fromFramebuffer(fb: Framebuffer, isMonospace: boolean): Glyph {
    // determine the true width of the cell.
    let width = fb.width;
    if (!isMonospace) {
      while (width > 0 && range(0, fb.height).every(y => fb.isOn(width - 1, y))) width--;

      // what about "space"? for a proportional font, use 1/2 the total width.
      if (width == 0) width = Math.round(fb.width / 2);
    }

    const size = fb.height * width;
    const glyph = new Glyph(new Uint8Array(Math.ceil(size / 8)), width, fb.height);
    for (let y = 0; y < fb.height; y++) {
      for (let x = 0; x < width; x++) {
        if (!fb.isOn(x, y)) glyph.setPixel(x, y);
      }
    }
    return glyph;
  }

  // the opposite of `packIntoRows`.
  static fromRows(rows: number[], width: number, direction: BitDirection = BitDirection.LE): Glyph {
    const size = rows.length * width;
    const glyph = new Glyph(new Uint8Array(Math.ceil(size / 8)), width, rows.length);

    rows.forEach((row, y) => {
      if (direction == BitDirection.BE && width % 8 != 0) {
        // remove padding from the right
        row >>= (8 - width % 8);
      }
      for (let i = 0; i < width; i++) {
        const px = direction == BitDirection.BE ? width - i - 1 : i;
        if (((row >> i) & 1) != 0) glyph.setPixel(px, y);
      }
    });
    return glyph;
  }

  // the opposite of `packIntoColumns`.
  static fromColumns(columns: number[], height: number, direction: BitDirection = BitDirection.LE): Glyph {
    const size = height * columns.length;
    const glyph = new Glyph(new Uint8Array(Math.ceil(size / 8)), columns.length, height);

    columns.forEach((col, x) => {
      if (direction == BitDirection.BE && height % 8 != 0) {
        // remove padding from the bottom
        col >>= (8 - height % 8);
      }
      for (let i = 0; i < height; i++) {
        const py = direction == BitDirection.BE ? height - i - 1 : i;
        if (((col >> i) & 1) != 0) glyph.setPixel(x, py);
      }
    });
    return glyph;
  }
}

export enum BitDirection {
  LE, BE
}
