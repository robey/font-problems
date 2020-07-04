import { range } from "./arrays";
import { Framebuffer } from "./framebuffer";

export enum BitDirection {
  LE, BE
}

/*
 * the pixel data for a glyph, stored as a bitfield in (y, x) order starting
 * at the upper left.
 */
export class Glyph {
  constructor(public data: Uint8Array, public width: number, public height: number) {
    // pass
  }

  identity(): string {
    return `${this.width},${this.height},${this.data.length},${this.rawHex}`;
  }

  get rawHex(): string {
    return range(0, this.data.length).map(i => ("0" + this.data[i].toString(16)).slice(-2)).join("");
  }

  debug(joiner: string = "\n"): string {
    return range(0, this.height).map(y => range(0, this.width).map(x => this.getPixel(x, y) ? "@" : " ").join("")).join(joiner);
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

  // make a larger version of this glyph, with each pixel turned into an NxN square.
  scale(factor: number): Glyph {
    const rv = new Glyph(new Uint8Array(this.data.length * factor * factor), this.width * factor, this.height * factor);
    for (let py = 0; py < this.height; py++) {
      for (let px = 0; px < this.width; px++) {
        if (this.getPixel(px, py)) {
          for (let dx = 0; dx < factor; dx++) {
            for (let dy = 0; dy < factor; dy++) {
              rv.setPixel(px * factor + dx, py * factor + dy);
            }
          }
        }
      }
    }
    return rv;
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
