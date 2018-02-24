import * as fs from "fs";
import { readBmp, writeBmp } from "../bmp";
import { Framebuffer } from "../framebuffer";

import "should";
import "source-map-support/register";

describe("bmp", () => {
  it("read a test image", () => {
    let f = readBmp(fs.readFileSync("./src/test/data/test.bmp"));
    f.width.should.eql(4);
    f.height.should.eql(4);
    Array.prototype.slice.call(f.pixels).should.eql([
      0xffffffff, 0xff000000, 0xffffffff, 0xff000000,
      0xff000000, 0xffffffff, 0xff000000, 0xffffffff,
      0xff336699, 0xffccff00, 0xff00ffcc, 0xff996633,
      0xffff0000, 0xff00ff00, 0xff0000ff, 0xff112233
    ])
  });

  it("writes a test image", () => {
    let f = new Framebuffer(2, 2, 24);
    f.setPixel(0, 0, 0x112233);
    f.setPixel(0, 1, 0x445566);
    f.setPixel(1, 0, 0x778899);
    f.setPixel(1, 1, 0xaabbcc);

    const data = writeBmp(f);
    let f2 = readBmp(data);
    f2.width.should.eql(2);
    f2.height.should.eql(2);
    Array.prototype.slice.call(f2.pixels).should.eql([
      0xff112233, 0xff778899, 0xff445566, 0xffaabbcc
    ]);
  });
});
