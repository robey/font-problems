"use strict";

const util = require("util");

/*
 * A unicode code-point generator is just a function that returns the next
 * code point (as a number) each time it's called.
 */

/*
 * parse a line like "32-90,127,x200-x207" into a code-point generator.
 * each segment is:
 *     <number> [ "-" <number> ]
 * and segments are joined by ",". ranges are inclusive.
 * numbers can be decimal or "x" followed by hex.
 */
function fromRanges(line) {
  const blocks = line.split(",").map(range => {
    const m = range.trim().match(/(x[\da-f]+|\d+)(\-(x[\da-f]+|\d+)?)?/);
    const start = parsePossibleHex(m[1]);
    const end = m[3] ? parsePossibleHex(m[3]) : (m[2] ? 0x10ffff : start);
    return fromRange(start, end);
  });
  return concat(blocks);
}

function fromRange(start, end) {
  let nextUp = start;
  return () => {
    const rv = nextUp;
    if (rv > end) return null;
    nextUp += 1;
    return rv;
  };
}

function parsePossibleHex(s) {
  return s[0] == "x" ? parseInt(s.slice(1), 16) : parseInt(s);
}

function from(start) {
  let nextUp = start;
  return () => {
    const rv = nextUp;
    nextUp += 1;
    return rv;
  }
}

function fromArray(array) {
  let i = 0;
  return () => {
    if (i >= array.length) return null;
    const rv = array[i];
    i += 1;
    return rv;
  }
}

/*
 * concat one or more generators.
 */
function concat(generators) {
  let i = 0;
  function loop() {
    if (i >= generators.length) return null;
    const rv = generators[i]();
    if (rv == null) {
      i += 1;
      return loop();
    }
    return rv;
  }
  return loop;
}

/*
 * turn one of these generators into an array.
 * this is for testing.
 */
function flatten(generator, max = 100) {
  const rv = [];
  while (rv.length < max) {
    const n = generator();
    if (n == null) return rv;
    rv.push(n);
  }
  return rv;
}


exports.flatten = flatten;
exports.from = from;
exports.fromArray = fromArray;
exports.fromRange = fromRange;
exports.fromRanges = fromRanges;
