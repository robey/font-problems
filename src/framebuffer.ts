import { range } from "./arrays";

export class Framebuffer {
  pixels: Uint32Array;

  // might be a view into a larger framebuffer:
  stride: number;
  offset: number;

  /*
   * Create a new framebuffer with `width` x `height` pixels.
   * `colorDepth` is informational only. The pixels are stored as 32-bit
   * values, as aRGB: 8 bits per color, big-endian (blue in the lowest 8
   * bits), with the highest 8 bits as alpha (transparency).
   */
  constructor(public width: number, public height: number, public colorDepth: number, parent?: Framebuffer) {
    // pixels are stored in (y, x) order, top to bottom, left to right.
    if (parent) {
      this.pixels = parent.pixels;
      this.stride = parent.stride;
    } else {
      this.pixels = new Uint32Array(width * height);
      this.stride = width;
    }
    this.offset = 0;
  }

  inspect() {
    return `Framebuffer(width=${this.width}, height=${this.height}, depth=${this.colorDepth})`;
  }

  setPixel(x: number, y: number, color: number) {
    this.pixels[this.offset + y * this.stride + x] = color;
  }

  getPixel(x: number, y: number): number {
    return this.pixels[this.offset + y * this.stride + x];
  }

  getPixelAsGray(x: number, y: number): number {
    // 0.21 R + 0.72 G + 0.07 B
    const pixel = this.getPixel(x, y);
    return Math.round(0.21 * ((pixel >> 16) & 0xff) + 0.72 * ((pixel >> 8) & 0xff) + 0.07 * (pixel & 0xff));
  }

  /*
   * estimate whether a pixel is "on" (light) or "off" (dark), according to
   * its approximate grayscale intensity.
   */
  isOn(x: number, y: number) {
    return this.getPixelAsGray(x, y) >= 127;
  }

  // compute the average brightness of every pixel (more useful on views).
  averageBrightness(): number {
    return range(0, this.height).reduce((sum, y) => {
      return sum + range(0, this.width).reduce((sum, x) => sum + this.getPixelAsGray(x, y), 0);
    }, 0) / (this.width * this.height);
  }

  fill(color: number) {
    let offset = this.offset;
    for (let y = 0; y < this.height; y++) {
      this.pixels.fill(color, offset, offset + this.width);
      offset += this.stride;
    }
  }

  // fill from an array of pixel values.
  fillData(data: number[]) {
    if (data.length != this.height * this.width) throw new Error(`Mismatched data size`);
    let offset = this.offset, localOffset = 0;
    for (let y = 0; y < this.height; y++) {
      this.pixels.set(data.slice(localOffset, localOffset + this.width), offset);
      offset += this.stride;
      localOffset += this.width;
    }
  }

  /*
   * remove the alpha channel by rendering each pixel against a given
   * background color.
   */
  renderAlpha(backgroundColor: number) {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const pixel = this.getPixel(x, y);
        const alpha = (pixel >> 24) & 0xff;
        if (alpha == 255) continue;

        const color = pixel & 0xffffff;
        const blend = alpha / 255;
        const mix = (shift: number) => {
          const pc = (color >> shift) & 0xff;
          const bc = (backgroundColor >> shift) & 0xff;
          return ((pc * blend + bc * (1.0 - blend)) & 0xff) << shift;
        };

        this.setPixel(x, y, 0xff000000 | mix(16) | mix(8) | mix(0));
      }
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
    // bit 0: enqueued. bit 1: visited.
    const tracking = new Uint8Array(this.width * this.height);
    const workQueue: [ number, number ][] = [];

    const enqueue = (px: number, py: number) => {
      const offset = py * this.width + px;
      if ((tracking[offset] & 1) != 0) return;
      tracking[offset] |= 1;
      workQueue.push([ px, py ]);
    };

    enqueue(x, y);
    while (workQueue.length > 0) {
      const [ px, py ] = workQueue.pop() || [ 0, 0 ];
      const offset = py * this.width + px;
      if ((tracking[offset] & 2) != 0) continue;
      tracking[offset] |= 2;

      const included = f(px, py, this.getPixel(px, py));
      if (included) {
        // add work for any pixel nearby that's still in range.
        if (px > 0) enqueue(px - 1, py);
        if (px < this.width - 1) enqueue(px + 1, py);
        if (py > 0) enqueue(px, py - 1);
        if (py < this.height - 1) enqueue(px, py + 1);
      }
    }
  }

  /*
   * create a new Framebuffer out of the box from (x1, y1) inclusive to
   * (x2, y2) exclusive. the new Framebuffer is a view into the same buffer.
   */
  view(x1: number, y1: number, x2: number, y2: number): Framebuffer {
    const fb = new Framebuffer(x2 - x1, y2 - y1, this.colorDepth, this);
    fb.offset = y1 * this.width + x1;
    return fb;
  }
}
