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
  private chars = new Map<number, Buffer>();
  private widths = new Map<number, number>();
  private order: number[] = [];
  public cellHeight = 0;

  constructor(public isMonospace: boolean = false) {
    // pass
  }

  charsDefined() {
    return this.order;
  }

  getRaw(char: number): string {
    const buffer = this.chars.get(char);
    if (!buffer) return "";
    return range(0, buffer.length).map(i => ("0" + buffer[i].toString(16)).slice(-2)).join("");
  }

  cellWidth(char: number): number {
    return this.widths.get(char) || 0;
  }

  maxCellWidth(): number {
    if (this.isMonospace) return this.widths.get(this.order[0]) || 0;
    return Math.max(...this.widths.values());
  }

  /*
   * given a framebuffer of a glyph, add it to the font.
   */
  add(char: number, image: Framebuffer) {
    if (this.cellHeight == 0) this.cellHeight = image.height;

    // determine the true width of the cell.
    let width = image.width;
    if (!this.isMonospace) {
      while (width > 0 && range(0, this.cellHeight).every(y => image.isOn(width - 1, y))) width--;

      // what about "space"? for a proportional font, use 1/2 the total width.
      if (width == 0) width = Math.round(image.width / 2);
    }

    const size = this.cellHeight * width;
    const glyph = Buffer.alloc(Math.ceil(size / 8), 0);
    let offset = 0;
    for (let y = 0; y < this.cellHeight; y++) {
      for (let x = 0; x < width; x++) {
        if (!image.isOn(x, y)) {
          glyph[Math.floor(offset / 8)] |= (1 << (offset % 8));
        }
        offset++;
      }
    }

    this.widths.set(char, width);
    this.chars.set(char, glyph);
    this.order.push(char);
  }

  /*
   * draw glyph data into a framebuffer.
   */
  draw(char: number, fb: Framebuffer, x: number, y: number, fgColor: number, bgColor: number) {
    const glyph = this.chars.get(char);
    const width = this.widths.get(char);
    if (!glyph || !width) throw new Error("No such char");

    let offset = 0;
    for (let py = 0; py < this.cellHeight; py++) {
      for (let px = 0; px < width; px++) {
        fb.setPixel(x + px, y + py, (glyph[Math.floor(offset / 8)] & (1 << (offset % 8))) != 0 ? fgColor : bgColor);
        offset++;
      }
    }
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
        const glyph = image.crop(px, py, px + options.cellWidth, py + options.cellHeight);
        font.add(unicode.next().value, glyph);
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




//
// const cell = new Uint8Array(cellWidth * height);
// for (let py = 0; py < height; py++) {
//   for (let px = 0; px < cellWidth; px++) {
//     cell[py * cellWidth + px] = framebuffer.isOn(xOffset + px, yOffset + py) ? 0 : 1;
//   }
// }
//
// this.add(char, cell, height);
// return cell;
// }

//
// // pack each glyph into an array of ints, each int as one row.
// // LE = smallest bit on the left
// // BE = smallest bit on the right
// packIntoRows(direction = LE) {
//   const rv = {};
//   for (let char in this.chars) {
//     const cell = this.chars[char];
//     const cellWidth = cell.length / this.cellHeight;
//     rv[char] = [];
//     for (let y = 0; y < this.cellHeight; y++) {
//       let line = 0;
//       for (let x = 0; x < cellWidth; x++) {
//         const px = direction == LE ? cellWidth - x - 1 : x;
//         line = (line << 1) | cell[y * cellWidth + px];
//       }
//       if (direction == BE && cellWidth % 8 != 0) {
//         // pad on the right so the left pixel aligns with a byte boundary!
//         line <<= (8 - cellWidth % 8);
//       }
//       rv[char].push(line);
//     }
//   }
//   return rv;
// }