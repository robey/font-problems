"use strict";

const unicodes = require("../../lib/unicodes");
const util = require("util");

require("should");
require("source-map-support").install();

describe("unicodes", () => {
  it("generates infinite code points", () => {
    const generator = unicodes.from(23);
    unicodes.flatten(generator, 10).should.eql([ 23, 24, 25, 26, 27, 28, 29, 30, 31, 32 ]);
  });

  it("knows hex", () => {
    const generator = unicodes.fromRanges("x19-x1c");
    unicodes.flatten(generator, 10).should.eql([ 25, 26, 27, 28 ]);
  });

  it("handles a range", () => {
    const generator = unicodes.fromRange(9, 11);
    unicodes.flatten(generator, 10).should.eql([ 9, 10, 11 ]);
  });

  it("handles sets of ranges", () => {
    const generator = unicodes.fromRanges("9-11,x20-x22,99,4");
    unicodes.flatten(generator, 10).should.eql([ 9, 10, 11, 32, 33, 34, 99, 4 ]);
  });

  it("handles arrays", () => {
    const generator = unicodes.fromArray([ 10, 11, 15, 17 ]);
    unicodes.flatten(generator, 10).should.eql([ 10, 11, 15, 17 ]);
  });

  it("handles infinite ranges", () => {
    const generator = unicodes.fromRanges("9-");
    unicodes.flatten(generator, 5).should.eql([ 9, 10, 11, 12, 13 ]);
  });
});
