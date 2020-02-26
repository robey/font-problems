import * as fs from "fs";
import { read_bdf } from "../bdf";

import "should";
import "source-map-support/register";

describe("bdf", () => {
  it("guess glyph names", () => {
  });

  it("parse tom thumber", () => {
    // from: https://twitter.com/carad0/status/1127632356158865408
    // or: http://carado.moe/up/9c56eef5-tom-thumber.bdf
    // this tests a lot of edge cases because the generated bdf uses smaller box sizes a lot.
    const bdf = fs.readFileSync("./src/test/data/9c56eef5-tom-thumber.bdf");
    const font = read_bdf(bdf, true);
    font.find("!")?.rawHex.should.eql("222000");
    font.find("\"")?.rawHex.should.eql("550000");
    font.find("7")?.rawHex.should.eql("471200");
    font.find("A")?.rawHex.should.eql("525700");
    font.find("x")?.rawHex.should.eql("250500");
  });
});
