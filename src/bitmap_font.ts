import { arrayGrouped, range } from "./arrays";

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
   * given a 2D array (y, x) of on/off bits, add this glyph to the font.
   */
  add(char: number, data: number[][]) {
    if (this.cellHeight == 0) this.cellHeight = data.length;

    // determine the true width of the cell.
    let width = data[0].length;
    if (!this.isMonospace) {
      while (width > 0 && range(0, this.cellHeight).every(y => data[y][width - 1] == 0)) width--;

      // what about "space"? for a proportional font, use 1/2 the total width.
      if (width == 0) width = Math.round(data[0].length / 2);
    }

    const size = this.cellHeight * width;
    const glyph = Buffer.alloc(Math.ceil(size / 8), 0);
    let offset = 0;
    for (let y = 0; y < this.cellHeight; y++) {
      for (let x = 0; x < width; x++) {
        if (data[y][x] != 0) {
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
   * dump glyph data back into a 2D array (y, x) of on/off bits.
   */
  get(char: number): number[][] {
    const glyph = this.chars.get(char);
    const width = this.widths.get(char);
    if (!glyph || !width) throw new Error("No such char");

    const data = new Array<number[]>(this.cellHeight);
    let offset = 0;
    for (let y = 0; y < this.cellHeight; y++) {
      data[y] = new Array<number>(width);
      for (let x = 0; x < width; x++) {
        data[y][x] = (glyph[Math.floor(offset / 8)] & (1 << (offset % 8))) != 0 ? 1 : 0;
        offset++;
      }
    }
    return data;
  }

  /*
   * make a 2D grid (y, x) of the entire font, fitting as many glyphs into
   * each horizontal "line" as possible.
   */
  dumpIntoGrid(width: number): number[][] {
    let rows: number[][] = [];
    const charsPerRow = Math.floor(width / this.maxCellWidth());
    arrayGrouped(this.order, charsPerRow).forEach(chars => {
      const charRow: number[][] = new Array(this.cellHeight);
      chars.forEach(char => {
        const data = this.get(char);
        for (let i = 0; i < charRow.length; i++) charRow[i] = charRow[i].concat(data[i]);
      });
      rows = rows.concat(charRow);
    });
    return rows;
  }
}


// grab a box out of a 2D grid.
export function cutGrid(data: number[][], x1: number, y1: number, x2: number, y2: number): number[][] {
  const rv: number[][] = [];
  for (let y = y1; y < y2; y++) {
    rv.push(data[y].slice(x1, x2));
  }
  return rv;
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
