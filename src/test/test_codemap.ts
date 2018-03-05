import * as fs from "fs";
import { dumpCodemap, parseCodemap } from "../codemap";

import "should";
import "source-map-support/register";

describe("codemap", () => {
  it("dumpCodemap", () => {
    const map = [
      [ "@" ], [ "A" ], [ "B" ], [ "C" ],
      [ "D", "d" ],
      [ "E", "ex" ]
    ];
    dumpCodemap(map).should.eql(
      "0: 40\n" +
      "1: 41\n" +
      "2: 42\n" +
      "3: 43\n" +
      "4: 44, 64\n" +
      "5: 45, 65;78\n"
    );
  });

  describe("parseCodemap", () => {
    it("empty", () => {
      parseCodemap(2, "").should.eql([ [ "\u0000" ], [ "\u0001" ] ]);
    });

    it("empty with starting point", () => {
      parseCodemap(2, "+20").should.eql([ [ " " ], [ "!" ] ]);
    });

    it("comments and whitespace", () => {
      parseCodemap(3, "    # wut\n    +020  \n\n 1 : 0040  \n\n").should.eql([ [ " " ], [ "@" ], [ '"' ] ]);
    });

    it("sequences", () => {
      parseCodemap(3, "0: 41\n1: 42, 62\n2: 43;40, 63").should.eql([ [ "A" ], [ "B", "b" ], [ "C@", "c" ] ]);
    });
  });

  it("round trip", () => {
    const description = fs.readFileSync("./src/test/data/Lat15-Terminus32x16.psfmap").toString();
    dumpCodemap(parseCodemap(256, description)).should.eql(description);
  });
});
