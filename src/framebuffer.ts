export class Framebuffer {
  buffer: ArrayBuffer;
  pixels: Uint32Array;

  /*
   * Create a new framebuffer with `width` x `height` pixels.
   * `colorDepth` is informational only. The pixels are stored as 32-bit
   * values, as aRGB: 8 bits per color, big-endian (blue in the lowest 8
   * bits), with the highest 8 bits as alpha (transparency).
   */
  constructor(public width: number, public height: number, public colorDepth: number) {
    // pixels are stored in (y, x) order, top to bottom, left to right.
    this.buffer = new ArrayBuffer(4 * width * height);
    this.pixels = new Uint32Array(this.buffer);
  }

  inspect() {
    return `Framebuffer(width=${this.width}, height=${this.height}, depth=${this.colorDepth})`;
  }

  setPixel(x: number, y: number, color: number) {
    this.pixels[y * this.width + x] = color;
  }

  getPixel(x: number, y: number) {
    return this.pixels[y * this.width + x];
  }

  getPixelAsGray(x: number, y: number) {
    // 0.21 R + 0.72 G + 0.07 B
    const pixel = this.getPixel(x, y);
    return 0.21 * ((pixel >> 16) & 0xff) + 0.72 * ((pixel >> 8) & 0xff) + 0.07 * (pixel & 0xff);
  }

  /*
   * estimate whether a pixel is "on" (light) or "off" (dark), according to
   * its approximate grayscale intensity.
   */
  isOn(x: number, y: number) {
    return this.getPixelAsGray(x, y) >= 127;
  }

  /*
   * inside a box of (x1, y1) -> (x2, y2) (inclusive to exclusive), what's
   * the average brightness of all the pixels?
   */
  averageBrightness(x1: number, y1: number, x2: number, y2: number): number {
    let count = 0;
    let brightness = 0;
    for (let y = y1; y < y2; y++) {
      for (let x = x1; x < x2; x++) {
        count += 1;
        brightness += this.getPixelAsGray(x, y);
      }
    }
    return brightness / count;
  }

  fill(color: number) {
    for (let i = 0; i < this.pixels.length; i++) this.pixels[i] = color;
  }

  /*
   * remove the alpha channel by rendering each pixel against a given
   * background color.
   */
  renderAlpha(backgroundColor: number) {
    for (let i = 0; i < this.pixels.length; i++) {
      const alpha = (this.pixels[i] >> 24) & 0xff;
      if (alpha == 255) continue;

      const color = this.pixels[i] & 0xffffff;
      const blend = alpha / 255;
      const mix = (shift: number) => {
        const pc = (color >> shift) & 0xff;
        const bc = (backgroundColor >> shift) & 0xff;
        return ((pc * blend + bc * (1.0 - blend)) & 0xff) << shift;
      };

      this.pixels[i] = 0xff000000 | mix(16) | mix(8) | mix(0);
    }
  }

  /*
   * walk a flood-fill algorithm starting from a single point (default 0, 0).
   * for each pixel, call `f(x, y, pixel)`. the `f` function should return
   * `true` if the given pixel is "inside" the region, and we should keep
   * exploring in this direction. additionally, `f` may modify the image.
   * each pixel will only be called once.
   */
  walk(f: (x: number, y: number, pixel: number) => boolean, x: number = 0, y: number = 0) {
    const used = new Uint8Array(this.width * this.height);
    const workQueue = [ (y * this.width + x) ];

    while (workQueue.length > 0) {
      const offset = workQueue.pop() || 0;
      if (used[offset] > 0) continue;

      used[offset] = 1;
      const py = Math.floor(offset / this.width);
      const px = offset % this.width;
      const included = f(px, py, this.pixels[offset]);
      if (included) {
        // add work for any pixel nearby that's still in range.
        if (px > 0) workQueue.push(offset - 1);
        if (px < this.width - 1) workQueue.push(offset + 1);
        if (py > 0) workQueue.push(offset - this.width);
        if (py < this.height - 1) workQueue.push(offset + this.width);
      }
    }
  }
}
