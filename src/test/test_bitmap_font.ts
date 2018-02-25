import * as fs from "fs";
import { BitmapFont, cutGrid } from "../bitmap_font";
import { readBmp } from "../bmp";
import { framebufferToGrid } from "../grid";

import "should";
import "source-map-support/register";

describe("BitmapFont", () => {
  const GRID: number[][] = [
    [ 1, 0, 0, 0, 0, 0, 0, 0 ],
    [ 0, 0, 0, 0, 0, 1, 0, 0 ],
    [ 0, 0, 0, 0, 0, 0, 0, 0 ],
    [ 0, 0, 0, 0, 0, 0, 0, 0 ],
    [ 0, 0, 1, 0, 0, 0, 0, 0 ],
    [ 0, 1, 0, 0, 0, 0, 0, 0 ],
    [ 0, 0, 0, 0, 0, 0, 0, 0 ],
    [ 0, 0, 0, 0, 0, 0, 0, 1 ],
  ];

  it("reads a normal cell", () => {
    const font = new BitmapFont();
    font.add(32, cutGrid(GRID, 0, 0, 6, 6));
    font.cellHeight.should.eql(6);
    font.cellWidth(32).should.eql(6);
    font.getRaw(32).should.eql("0108008400");
    font.get(32).should.eql([
      [ 1, 0, 0, 0, 0, 0 ],
      [ 0, 0, 0, 0, 0, 1 ],
      [ 0, 0, 0, 0, 0, 0 ],
      [ 0, 0, 0, 0, 0, 0 ],
      [ 0, 0, 1, 0, 0, 0 ],
      [ 0, 1, 0, 0, 0, 0 ],
    ]);
  });

  it("trims a proportional font", () => {
    const font = new BitmapFont();
    font.add(32, cutGrid(GRID, 0, 0, 5, 6));
    font.cellHeight.should.eql(6);
    font.cellWidth(32).should.eql(3);
    font.get(32).should.eql([
      [ 1, 0, 0 ],
      [ 0, 0, 0 ],
      [ 0, 0, 0 ],
      [ 0, 0, 0 ],
      [ 0, 0, 1 ],
      [ 0, 1, 0 ],
    ]);
  });

  it("doesn't trim a monospace font", () => {
    const font = new BitmapFont(true);
    font.add(32, cutGrid(GRID, 0, 0, 3, 3));
    font.cellHeight.should.eql(3);
    font.cellWidth(32).should.eql(3);
    font.get(32).should.eql([
      [ 1, 0, 0 ],
      [ 0, 0, 0 ],
      [ 0, 0, 0 ],
    ]);
  });

  // it("loads from a framebuffer", () => {
  //   const fb = readBmp(fs.readFileSync("src/test/data/lolathin.bmp"));
  //   const font = .loadFromFramebuffer(bmp.readBmp("fonts/lolathin.bmp"), { isMonospace: false });
  //   font.isMonospace.should.eql(false);
  //   font.cellHeight.should.eql(8);
  //   font.gridCellHeight.should.eql(8);
  //   font.gridCellWidth.should.eql(6);
  //   Object.keys(font.chars).length.should.eql(128);
  //   Array.prototype.slice.call(font.chars[33]).map(x => x > 0 ? "+" : "-").join("").should.eql("+++++-+-");
  // });

});
