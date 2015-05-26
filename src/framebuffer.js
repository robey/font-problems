"use strict";

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
}


exports.Framebuffer = Framebuffer;
