"use strict";

const sprintf = require("sprintf");
const unicodes = require("./unicodes");
const util = require("util");
const _ = require("lodash");

const LE = "little-endian";
const BE = "big-endian";

/*
 * representation of a bitmap font.
 * each glyph is a packed array of (y, x) to 1 or 0 (on or off) -- very simple.
 * x, y are left to right, top to bottom.
 * characters are indexed by unicode index (int), for example "A" is 65.
 */
class BitmapFont {
  constructor(isMonospace = false) {
    this.isMonospace = isMonospace;
    this.chars = {};
    this.order = [];
  }

  add(char, cell, height) {
    this.chars[char] = cell;
    this.order.push(char);
    if (!this.cellHeight) this.cellHeight = height;
  }

  get(char) {
    return this.chars[char];
  }

  /*
   * read a character cell out of a framebuffer, given (x, y) offset and
   * (width, height). black or dark cells are considered "on".
   */
  getFromFramebuffer(char, framebuffer, xOffset, yOffset, width, height) {
    // determine the true width of the cell.
    let cellWidth = width;
    if (!this.isMonospace) {
      while (cellWidth > 0 && _.all(_.range(height).map(y => framebuffer.isOn(xOffset + cellWidth - 1, yOffset + y)))) {
        cellWidth -= 1;
      }

      // what about "space"? for a proportional font, use 1/2 the total width.
      if (cellWidth == 0) cellWidth = Math.round(width / 2);
    }

    const cell = new Uint8Array(cellWidth * height);
    for (let py = 0; py < height; py++) {
      for (let px = 0; px < cellWidth; px++) {
        cell[py * cellWidth + px] = framebuffer.isOn(xOffset + px, yOffset + py) ? 0 : 1;
      }
    }

    this.add(char, cell, height);
    return cell;
  }

  drawToFramebuffer(char, framebuffer, xOffset, yOffset, offColor, onColor) {
    const cell = this.chars[char];
    const cellWidth = cell.length / this.cellHeight;
    for (py = 0; py < this.cellHeight; py++) {
      for (px = 0; px < cellWidth; px++) {
        framebuffer.putPixel(xOffset + px, yOffset + py, cell[py * cellWidth + px] > 0 ? onColor : offColor);
      }
    }
  }

  // pack each glyph into an array of ints, each int as one row.
  // LE = smallest bit on the left
  // BE = smallest bit on the right
  packIntoRows(direction = LE) {
    const rv = {};
    for (let char in this.chars) {
      const cell = this.chars[char];
      const cellWidth = cell.length / this.cellHeight;
      rv[char] = [];
      for (let y = 0; y < this.cellHeight; y++) {
        let line = 0;
        for (let x = 0; x < cellWidth; x++) {
          const px = direction == LE ? cellWidth - x - 1 : x;
          line = (line << 1) | cell[y * cellWidth + px];
        }
        if (direction == BE && cellWidth % 8 != 0) {
          // pad on the right so the left pixel aligns with a byte boundary!
          line <<= (8 - cellWidth % 8);
        }
        rv[char].push(line);
      }
    }
    return rv;
  }

  // pack each glyph into an array of ints, each int as one column.
  // LE = smallest bit on top
  // BE = smallest bit on bottom
  packIntoColumns(direction = LE) {
    const rv = {};
    for (let char in this.chars) {
      const cell = this.chars[char];
      const cellWidth = cell.length / this.cellHeight;
      rv[char] = [];
      for (let x = 0; x < cellWidth; x++) {
        let line = 0;
        for (let y = 0; y < this.cellHeight; y++) {
          const py = direction == LE ? this.cellHeight - y - 1 : y;
          line = (line << 1) | cell[py * cellWidth + x];
        }
        if (direction == BE && this.cellHeight % 8 != 0) {
          // pad on the bottom so the top pixel aligns with a byte boundary!
          line <<= (8 - this.cellHeight % 8);
        }
        rv[char].push(line);
      }
    }
    return rv;
  }

  charsDefined() {
    return this.order;
  }

  cellWidth(char) {
    return this.chars[char].length / this.cellHeight;
  }

  // returns an array of ascii lines filled with @ or space
  dumpToAscii(lineWidth = 80) {
    const buffer = [ ];
    let bufferY = 0;
    this.charsDefined().forEach(char => {
      const cell = this.chars[char];
      const width = this.cellWidth(char);
      const height = this.cellHeight;
      if (!buffer[bufferY] || buffer[bufferY].length + width >= lineWidth) {
        // new "virtual line"
        bufferY = buffer.length;
      }
      for (let y = 0; y < height; y++) {
        if (!buffer[bufferY + y]) buffer[bufferY + y] = [];
        for (let x = 0; x < width; x++) {
          buffer[bufferY + y].push(cell[y * width + x] > 0 ? "@" : " ");
        }
        // space between chars
        if (!this.isMonospace) buffer[bufferY + y].push(" ");
      }
      if (!buffer[bufferY + height]) buffer[bufferY + height] = [];
      buffer[bufferY + height].push(sprintf(`%-${width}x`, char));
    });
    return buffer.map(line => line.join(""));
  }

  /*
   * generate a header file for the LED matrix: left to right, bottom to top,
   * a word for each column, with the LSB being the top bit.
   */
  generateHeaderFile(name) {
    let text = "";
    const lookups = [ 0 ];
    let total = 0;
    const chars = this.packIntoColumns(LE);
    for (let char in chars) {
      const cell = chars[char];
      total += cell.length;
      lookups.push(total);
    }
    text += `const int ${name}_font_height = ${this.cellHeight};\n`;
    text += `const int ${name}_font_offsets[${Object.keys(chars).length + 1}] = { ${lookups.join(", ")} };\n`;
    text += `const int ${name}_font_data[${total}] = {\n`;
    for (let char in chars) {
      const cell = chars[char];
      text += "  " + cell.map(col => sprintf("0x%06x", col)).join(", ") + ", \n";
    }
    text += "};\n";
    return text;
  }

// # unpack each glyph from an array of ints, each int as one row.
// # LE = smallest bit on the left
// # BE = smallest bit on the right
// unpackRows = (rows, cellWidth, direction = LE) ->
//   rows.map (row) ->
//     if direction == BE and cellWidth % 8 != 0
//       # remove padding from the right
//       row >>= (8 - cellWidth % 8)
//     row = [0 ... cellWidth].map (i) -> (row >> i) & 0x01
//     if direction == BE then row = row.reverse()
//     row
//
//
}

/*
 * load a bitmap font from a framebuffer.
 * the font must be in a regular grid. (for proportional fonts, align the left
 * edges and leave the extra space on the right.) the grid dimensions can be
 * determined heuristically if they aren't provided.
 *
 * the unicode code-point generator should be some function (usually provided
 * by one of the helpers in `unicodes.js`) that provides the sequence of code
 * points (as numbers) to assign to each glyph in order. the default generator
 * starts from code-point zero.
 *
 * options:
 * - cellWidth: width of each cell in the grid (default: guess)
 * - cellHeight: height of each cell in the grid (default: guess)
 * - isMonospace: if false, extra padding on the right of each glyph will be
 *   removed (default: true)
 * - generator: a function that returns unicode code points (as numbers) to
 *   assign to each glyph in order
 */
function loadFromFramebuffer(framebuffer, options = {}) {
  if (!(options.cellWidth && options.cellHeight)) {
    const { width, height } = framebuffer.sniffBoundaries();
    options.cellWidth = width;
    options.cellHeight = height;
  }
  if (options.isMonospace === undefined) options.isMonospace = true;
  if (!options.generator) options.generator = unicodes.from(0);

  const charRows = framebuffer.height / options.cellHeight;
  const charColumns = framebuffer.width / options.cellWidth;
  const font = new BitmapFont(options.isMonospace);
  for (let y = 0; y < charRows; y++) {
    for (let x = 0; x < charColumns; x++) {
      font.getFromFramebuffer(options.generator(), framebuffer, x * options.cellWidth, y * options.cellHeight, options.cellWidth, options.cellHeight);
    }
  }
  font.gridCellWidth = options.cellWidth;
  font.gridCellHeight = options.cellHeight;
  return font;
}


exports.BE = BE;
exports.BitmapFont = BitmapFont;
exports.LE = LE;
exports.loadFromFramebuffer = loadFromFramebuffer;
// exports.unpackRows = unpackRows
