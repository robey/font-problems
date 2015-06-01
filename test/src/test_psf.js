"use strict";

const fs = require("fs");
const psf = require("../../lib/psf");
const util = require("util");

require("should");
require("source-map-support").install();

describe("psf", () => {
  it("reads a font", () => {
    const font = psf.read(fs.readFileSync("./fonts/tom-thumb-256.psf"));
    font.cellHeight.should.eql(6);
    font.cellWidth(0x4d).should.eql(4);
    Array.prototype.slice.call(font.chars[0x21]).map(x => x > 0 ? "+" : "-").should.eql("-+---+---+-------+------");
  });

  it("preserves all data through read/write", () => {
    const data1 = fs.readFileSync("fonts/tom-thumb-256.psf");
    const font = psf.read(data1);
    const data2 = psf.write(font, { withMap: true });
    data1.toString("hex").should.eql(data2.toString("hex"));
  });
});
