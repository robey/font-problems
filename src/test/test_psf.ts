import * as fs from "fs";
import { Framebuffer } from "../framebuffer";
import { readPsf, writePsf } from "../psf";
import { writeBmp } from "../bmp";

import "should";
import "source-map-support/register";

describe("psf", () => {
  // it("robey", () => {
  //   const font = readPsf(fs.readFileSync("/Users/robey/Desktop/Lat15-Terminus32x16.psf"));
  //   // font.scale(2);
  //   const fb = font.dumpIntoFramebuffer(16, 0, 0xffffff);
  //   fs.writeFileSync("/Users/robey/Desktop/Lat15-Terminus32x16.bmp", writeBmp(fb));
  // });

  it("reads a font", () => {
    const font = readPsf(fs.readFileSync("./src/test/data/tom-thumb-256.psf"));
    font.cellHeight.should.eql(6);
    font.glyphs[0x4d].width.should.eql(4);

    const fb = new Framebuffer(4, 6, 24);
    font.glyphs[0x21].draw(fb, 1, 0);
    Array.from(fb.pixels).should.eql([
      0, 1, 0, 0,
      0, 1, 0, 0,
      0, 1, 0, 0,
      0, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 0, 0,
    ]);
  });

  it("preserves all data through read/write", () => {
    const data1 = fs.readFileSync("./src/test/data/tom-thumb-256.psf");
    const font = readPsf(data1);
    const data2 = writePsf(font, { withMap: true });
    data1.toString("hex").should.eql(data2.toString("hex"));
  });
});
