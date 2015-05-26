"use strict";

const bmp = require("../../lib/bmp");
const framebuffer = require("../../lib/framebuffer");
const util = require("util");

require("should");
require("source-map-support").install();

describe("bmp", () => {
  it("read a test image", () => {
    let f = bmp.readBmp("test/test.bmp");
    f.width.should.eql(4);
    f.height.should.eql(4);
    Array.prototype.slice.call(f.pixels).should.eql([
      0xffffff, 0x000000, 0xffffff, 0x000000,
      0x000000, 0xffffff, 0x000000, 0xffffff,
      0x336699, 0xccff00, 0x00ffcc, 0x996633,
      0xff0000, 0x00ff00, 0x0000ff, 0x112233
    ])
  });

  it("writes a test image", () => {
    let f = new framebuffer.Framebuffer(2, 2, 24);
    f.putPixel(0, 0, 0x112233);
    f.putPixel(0, 1, 0x445566);
    f.putPixel(1, 0, 0x778899);
    f.putPixel(1, 1, 0xaabbcc);

    const data = bmp.writeBmp(f);
    let f2 = bmp.readBmp(data);
    f2.width.should.eql(2);
    f2.height.should.eql(2);
    Array.prototype.slice.call(f2.pixels).should.eql([
      0x112233, 0x778899, 0x445566, 0xaabbcc
    ]);
  });
});
