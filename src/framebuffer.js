"use strict";

const util = require("util");
const _ = require("lodash");

class Framebuffer {
  /*
   * Create a new framebuffer with `width` x `height` pixels.
   * `colorDepth` is informational only. The pixels are stored as 32-bit
   * values, as xRGB: 8 bits per color, big-endian (blue in the lowest 8 bits),
   * with the highest 8 bits unused.
   */
  constructor(width, height, colorDepth) {
    // pixels are stored in (y, x) order, top to bottom, left to right.
    this.buffer = new ArrayBuffer(4 * width * height);
    this.pixels = new Uint32Array(this.buffer);
    this.width = width;
    this.height = height;
    this.colorDepth = colorDepth;
  }

  toGray(x, y) {
    // 0.21 R + 0.72 G + 0.07 B
    const pixel = this.pixels[y * this.width + x];
    return 0.21 * ((pixel >> 16) & 0xff) + 0.72 * ((pixel >> 8) & 0xff) + 0.07 * (pixel & 0xff);
  }

  isOn(x, y) {
    return this.toGray(x, y) >= 127;
  }

  /*
   * for an (x1, y1) inclusive -> (x2, y2) exclusive box, what is the average
   * brightness of all the pixels?
   */
  averageBrightness(x1, y1, x2, y2) {
    let count = 0;
    let brightness = 0;
    for (let y = y1; y < y2; y++) {
      for (let x = x1; x < x2; x++) {
        count += 1;
        brightness += this.toGray(x, y);
      }
    }
    return brightness / count;
  }

  putPixel(x, y, color) {
    this.pixels[y * this.width + x] = color;
  }

  getPixel(x, y) {
    return this.pixels[y * this.width + x];
  }

  fill(color) {
    // uhhhhh why is `fill` not implemented?
    for (let i = 0; i < this.pixels.length; i++) this.pixels[i] = color;
  }

  // detect cell boundaries by finding rows & columns that are mostly on.
  sniffBoundaries() {
    const rows = _.range(this.height).map(y => this.averageBrightness(0, y, this.width, y + 1));
    const columns = _.range(this.width).map(x => this.averageBrightness(x, 0, x + 1, this.height));
    return {
      width: detectSpacing(columns, _.range(4, 13)),
      height: detectSpacing(rows, _.range(6, 17))
    };
  }
}


/*
 * for a range of N, look at every Nth line and average them together, to find
 * the N that's most often bright. for example, if there's a pattern of every
 * 8th row being brighter than the rest, then the cells are probably 8 pixels
 * tall, and the bottom line is the space between glyphs.
 * lines: each row or column, in average brightness across that line
 * range: guesses to try for the number of lines per cell
 */
function detectSpacing(lines, range) {
  const guesses = range.map(n => {
    if (lines.length % n != 0) {
      // if it isn't evenly divisible by this guess, then the guess is wrong.
      return { n, weight: 0 };
    } else {
      const candidates = _.range(0, lines.length, n).map(i => lines[i + n - 1]);
      // penalize the weight slightly by how wide the spacing is.
      const weight = candidates.reduce((a, b) => a + b) / candidates.length * Math.pow(0.99, n);
      return { n, weight };
    }
  });
  guesses.sort((a, b) => {
    // by highest weight, and in case of tie, by smallest n.
    return (a.weight == b.weight) ? a.n - b.n : b.weight - a.weight;
  });
  return guesses[0].n;
}


exports.Framebuffer = Framebuffer;
