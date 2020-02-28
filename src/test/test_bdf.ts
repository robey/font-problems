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
    font.find("-")?.rawHex.should.eql("000700");
    font.find("_")?.rawHex.should.eql("007000");
    font.find("7")?.rawHex.should.eql("471200");
    font.find("A")?.rawHex.should.eql("525700");
    font.find("x")?.rawHex.should.eql("505200");
  });

  it("parse some edge cases", () => {
    const bdf = fs.readFileSync("./src/test/data/steinbeck.bdf");
    const font = read_bdf(bdf, false);
    font.find(" ")?.width.should.eql(1);
    font.find(" ")?.debug().should.eql(" , , , , , , , ");
    font.find("!")?.width.should.eql(1);
    font.find("!")?.debug().should.eql(" ,@,@,@,@, ,@, ");
    font.find("#")?.width.should.eql(5);
    font.find("#")?.debug().should.eql("     ,     , @ @ ,@@@@@, @ @ ,@@@@@, @ @ ,     ");
    font.find("'")?.width.should.eql(1);
    font.find("'")?.debug().should.eql(" ,@,@, , , , , ");
    font.find("1")?.width.should.eql(3);
    font.find("1")?.debug().should.eql("   ,  @, @@,  @,  @,  @,  @,   ");
  });
});
