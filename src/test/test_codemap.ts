import * as fs from "fs";
import { dumpCodemap, parseCodemap } from "../codemap";

import "should";
import "source-map-support/register";

describe("codemap", () => {
  it("dumpCodemap", () => {
    const map = [
      [ 64 ], [ 65 ], [ 66 ], [ 67 ],
      [ 0x44, 0x64 ],
      [ 0x45, 0x65 ]
    ];
    dumpCodemap(map).should.eql(
      "0: 40\n" +
      "1: 41\n" +
      "2: 42\n" +
      "3: 43\n" +
      "4: 44, 64\n" +
      "5: 45, 65\n"
    );
  });

  describe("parseCodemap", () => {
    it("empty", () => {
      parseCodemap(2, "").should.eql([ [ ], [ ] ]);
    });

    it("comments and whitespace", () => {
      parseCodemap(3, "    # wut\n\n 1 : 0040  \n\n0:20   \n").should.eql([ [ 0x20 ], [ 0x40 ], [ ] ]);
    });

    it("ranges", () => {
      parseCodemap(10, "0: 41\n1: 42 - 44\n6: 45-47").should.eql([
        [ 0x41 ], [ 0x42 ], [ 0x43 ], [ 0x44 ], [ ], [ ], [ 0x45 ], [ 0x46 ], [ 0x47 ], [ ]
      ]);
    });
  });

  it("round trip", () => {
    const description = fs.readFileSync("./src/test/data/Lat15-Terminus32x16.psfmap").toString();
    dumpCodemap(parseCodemap(256, description)).should.eql(description);
  });
});
