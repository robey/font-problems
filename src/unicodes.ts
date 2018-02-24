/*
 * parse a line like "32-90,127,x200-x207" into a code-point generator.
 * each segment is:
 *     <number> [ "-" <number> ]
 * and segments are joined by ",". ranges are inclusive.
 * numbers can be decimal or "x" followed by hex.
 */
export function* unicodeFromRanges(line: string): Iterable<number> {
  const parsePossibleHex = (s: string) => {
    return s[0] == "x" ? parseInt(s.slice(1), 16) : parseInt(s);
  }

  for (const range of line.split(",")) {
    const m = range.trim().match(/(x[\da-f]+|\d+)(\-(x[\da-f]+|\d+)?)?/);
    if (m == null) throw new Error(`Invalid unicode range '${range.trim()}'`);
    const start = parsePossibleHex(m[1]);
    const end = m[3] ? parsePossibleHex(m[3]) : (m[2] ? 0x10ffff : start);

    for (let i = start; i <= end; i++) yield i;
  }
}
