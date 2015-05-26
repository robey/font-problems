"use strict";

const sprintf = require("sprintf");
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

//   # pack each glyph into an array of ints, each int as one row.
//   # LE = smallest bit on the left
//   # BE = smallest bit on the right
//   packIntoRows: (direction = LE) ->
//     rv = {}
//     for char, rows of @chars
//       rv[char] = rows.map (row) ->
//         line = 0
//         for x in [0 ... row.length]
//           line = (line << 1) | row[if direction == LE then row.length - x - 1 else x]
//         if direction == BE and row.length % 8 != 0
//           # pad on the right so the left pixel aligns with a byte boundary!
//           line <<= (8 - row.length % 8)
//         line
//     rv
//
//   # pack each glyph into an array of ints, each int as one column.
//   # LE = smallest bit on top
//   # BE = smallest bit on bottom
//   packIntoColumns: (direction = LE) ->
//     rv = {}
//     for char, rows of @chars
//       rv[char] = [0 ... rows[0].length].map (x) ->
//         line = 0
//         for y in [0 ... rows.length]
//           line = (line << 1) | rows[if direction == LE then rows.length - y - 1 else y][x]
//         if direction == BE and rows.length % 8 != 0
//           # pad on the bottom so the top pixel aligns with a byte boundary!
//           line <<= (8 - rows.length % 8)
//         line
//     rv

  charsDefined() {
    return this.order;
  }

  cellWidth(char) {
    return this.chars[char].length / this.cellHeight;
  }

//   # returns an array of ascii lines filled with @ or space
//   dumpToAscii: (lineWidth = 80) ->
//     buffer = [ [] ]
//     bufferY = 0
//     for char in @charsDefined()
//       cell = @chars[char]
//       width = cell[0].length
//       height = cell.length
//       if buffer[bufferY].length + width >= lineWidth
//         # new "virtual line"
//         bufferY = buffer.length
//       for y in [0 ... height]
//         if not buffer[bufferY + y]? then buffer[bufferY + y] = []
//         for x in [0 ... width]
//           buffer[bufferY + y].push(if cell[y][x] == 1 then "@" else " ")
//         # space between chars
//         if not @isMonospace then buffer[bufferY + y].push " "
//       if not buffer[bufferY + height]? then buffer[bufferY + height] = []
//       buffer[bufferY + height].push sprintf("%-#{width}x", char)
//     buffer.map (line) -> line.join("")
//
// toGray = (pixel) ->
//   # 0.21 R + 0.72 G + 0.07 B
//   0.21 * ((pixel >> 16) & 0xff) + 0.72 * ((pixel >> 8) & 0xff) + 0.07 * (pixel & 0xff)
//
// isOn = (pixel) -> toGray(pixel) >= 0.5
//
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


exports.BE = BE;
exports.BitmapFont = BitmapFont;
exports.LE = LE;
// exports.unpackRows = unpackRows
