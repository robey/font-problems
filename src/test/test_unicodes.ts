import { tokenize, unicodeFromRanges } from "../unicodes";

import "should";
import "source-map-support/register";

function collect(iter: Iterable<number>, max: number = Infinity) {
  const rv: number[] = [];
  for (const item of iter) {
    rv.push(item);
    if (rv.length == max) return rv;
  }
  return rv;
}

describe("unicodes", () => {
  it("generates infinite code points", () => {
    collect(unicodeFromRanges("23-"), 10).should.eql([23, 24, 25, 26, 27, 28, 29, 30, 31, 32]);
  });

  it("knows hex", () => {
    collect(unicodeFromRanges("x19-x1c"), 10).should.eql([25, 26, 27, 28]);
  });

  it("handles a range", () => {
    collect(unicodeFromRanges("9-11"), 10).should.eql([9, 10, 11]);
  });

  it("handles sets of ranges", () => {
    collect(unicodeFromRanges("9-11,x20-x22,99,4"), 10).should.eql([9, 10, 11, 32, 33, 34, 99, 4]);
  });


  it("tokenizes", () => {
    const tokens = tokenize("45=xff,;\n9001");
    tokens.map(t => t.toString()).join(",").should.eql(
      "DECIMAL(45)[1:0],EQUALS(=)[1:2],HEX(xff)[1:3],COMMA(,)[1:6],SEMICOLON(;)[1:7]," +
      "LF(\n)[1:8],DECIMAL(9001)[2:1]"
    );
  });

});
