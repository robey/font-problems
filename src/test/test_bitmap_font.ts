import * as fs from "fs";
import { BitmapFont } from "../bitmap_font";
import { readBmp } from "../bmp";
import { Framebuffer } from "../framebuffer";

import "should";
import "source-map-support/register";

describe("BitmapFont", () => {
  const IMAGE = new Framebuffer(8, 8, 24);
  IMAGE.fillData([
    1, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 1, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 1, 0, 0, 0, 0, 0,
    0, 1, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 1,
  ].map(n => n == 1 ? 0 : 0xffffff));

  it("reads a normal cell", () => {
    const font = new BitmapFont();
    font.add(32, IMAGE.crop(0, 0, 6, 6));
    font.cellHeight.should.eql(6);
    font.cellWidth(32).should.eql(6);
    font.getRaw(32).should.eql("0108008400");

    const fb = new Framebuffer(6, 6, 24);
    font.draw(32, fb, 0, 0, 1, 0);
    Array.from(fb.pixels).should.eql([
      1, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 1,
      0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0,
      0, 0, 1, 0, 0, 0,
      0, 1, 0, 0, 0, 0,
    ]);
  });

  it("trims a proportional font", () => {
    const font = new BitmapFont();
    font.add(32, IMAGE.crop(0, 0, 5, 6));
    font.cellHeight.should.eql(6);
    font.cellWidth(32).should.eql(3);

    const fb = new Framebuffer(3, 6, 24);
    font.draw(32, fb, 0, 0, 1, 0);
    Array.from(fb.pixels).should.eql([
      1, 0, 0,
      0, 0, 0,
      0, 0, 0,
      0, 0, 0,
      0, 0, 1,
      0, 1, 0,
    ]);
  });

  it("doesn't trim a monospace font", () => {
    const font = new BitmapFont(true);
    font.add(32, IMAGE.crop(0, 0, 3, 3));
    font.cellHeight.should.eql(3);
    font.cellWidth(32).should.eql(3);

    const fb = new Framebuffer(3, 3, 24);
    font.draw(32, fb, 0, 0, 1, 0);
    Array.from(fb.pixels).should.eql([
      1, 0, 0,
      0, 0, 0,
      0, 0, 0,
    ]);
  });

  it("loads from a framebuffer", () => {
    const fb = readBmp(fs.readFileSync("src/test/data/lolathin.bmp"));
    const font = BitmapFont.importFromImage(fb, { isMonospace: false });
    font.isMonospace.should.eql(false);
    font.cellHeight.should.eql(8);
    font.cellWidth("M".codePointAt(0) || 0).should.eql(5);
    font.charsDefined().length.should.eql(128);
    font.cellWidth("!".codePointAt(0) || 0).should.eql(1);

    const fb2 = new Framebuffer(1, 8, 24);
    font.draw("!".codePointAt(0) || 0, fb2, 0, 0, 1, 0);
    Array.from(fb2.pixels).should.eql([ 1, 1, 1, 1, 1, 0, 1, 0 ]);
  });

});
