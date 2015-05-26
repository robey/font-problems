"use strict";

const bitmap_font = require("../../lib/bitmap_font");
const bmp = require("../../lib/bmp");
const framebuffer = require("../../lib/framebuffer");
const util = require("util");

require("should");
require("source-map-support").install();

describe("BitmapFont", () => {
  const f = new framebuffer.Framebuffer(8, 8, 32);
  f.fill(0xffffff);
  f.putPixel(0, 0, 0);
  f.putPixel(5, 1, 0);
  f.putPixel(2, 4, 0);
  f.putPixel(1, 5, 0);
  f.putPixel(7, 7, 0);

  it("reads a normal cell", () => {
    const font = new bitmap_font.BitmapFont();
    const cell = font.getFromFramebuffer(32, f, 0, 0, 6, 6);
    font.cellHeight.should.eql(6);
    font.cellWidth(32).should.eql(6);
    Array.prototype.slice.call(cell).should.eql([
      1, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 1,
      0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0,
      0, 0, 1, 0, 0, 0,
      0, 1, 0, 0, 0, 0,
    ]);
  });

  it("trims a proportional font", () => {
    const font = new bitmap_font.BitmapFont();
    const cell = font.getFromFramebuffer(32, f, 0, 0, 5, 6);
    font.cellHeight.should.eql(6);
    font.cellWidth(32).should.eql(3);
    Array.prototype.slice.call(cell).should.eql([
      1, 0, 0,
      0, 0, 0,
      0, 0, 0,
      0, 0, 0,
      0, 0, 1,
      0, 1, 0,
    ]);
  });

  it("doesn't trim a monospace font", () => {
    const font = new bitmap_font.BitmapFont(true);
    const cell = font.getFromFramebuffer(32, f, 0, 0, 3, 3);
    font.cellHeight.should.eql(3);
    font.cellWidth(32).should.eql(3);
    Array.prototype.slice.call(cell).should.eql([
      1, 0, 0,
      0, 0, 0,
      0, 0, 0,
    ]);
  });

  it("detects boundaries", () => {
    bmp.readBmp("fonts/tom-thumb-256.bmp").sniffBoundaries().should.eql({ width: 4, height: 6 });
    bmp.readBmp("fonts/lolathin.bmp").sniffBoundaries().should.eql({ width: 6, height: 8 });
    bmp.readBmp("fonts/lola12.bmp").sniffBoundaries().should.eql({ width: 6, height: 12 });
  })
});
