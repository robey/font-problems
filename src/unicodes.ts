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


/*
 * format for unicode mappings:
 *   - code point is \d+ or x[A-Fa-f\d]+ ("99", "x20ff")
 *   - combinations separated by space ("x41 x30A": A + combining ring above)
 *   - multiple separated by ";" ("xc5; x212B": A ring, angstrom)
 *   - glyphs separated by "," or linefeed ("x41, x42, x43": A then B then C...)
 *   - optional overrides are index + "=" ("0=32": first glyph is space)
 *   - default coverage for missing values is "0-" (glyph represents the code
 *       point of its index)
 *   - spaces and tabs are all okay around , and ;
 *
 * example: x20-x7f, 33=x391
 *   96 (x60) glyphs, and the one at 33 (A, x41) is also x391 (greek alpha)
 */

// export function unicodeFromRanges(line: string): string[][] {
//   const rv: string[][] = [];
//
//   const parsePossibleHex = (s: string) => {
//     return s[0] == "x" ? parseInt(s.slice(1), 16) : parseInt(s);
//   }
//
//   for (const range of line.split(",")) {
//     const variants = range.trim().split(";")
//     const m = range.trim().match(/(x[\da-f]+|\d+)(\-(x[\da-f]+|\d+)?)?/);
//     if (m == null) throw new Error(`Invalid unicode range '${range.trim()}'`);
//     const start = parsePossibleHex(m[1]);
//     const end = m[3] ? parsePossibleHex(m[3]) : (m[2] ? 0x10ffff : start);
//
//     for (let i = start; i <= end; i++) yield i;
//   }
// }


export enum TokenType {
  END,
  LF,
  SEMICOLON,
  COMMA,
  EQUALS,
  DASH,
  HEX,
  DECIMAL
}

export class Token {
  constructor(
    public type: TokenType,
    public index: number,
    public lineno: number,
    public pos: number,
    public value: string = ""
  ) {
    // pass
  }

  toString(): string {
    return `${TokenType[this.type]}(${this.value})[${this.lineno}:${this.pos}]`;
  }
}

export class ParseState {
  constructor(
    public tokens: Token[],
    public pos: number
  ) {
    // pass
  }

  advance(n: number = 1): ParseState {
    return new ParseState(this.tokens, this.pos + n);
  }

  nextType(): TokenType {
    if (this.pos >= this.tokens.length) return TokenType.END;
    return this.tokens[this.pos].type;
  }

  nextValue(): string {
    if (this.pos >= this.tokens.length) return "";
    return this.tokens[this.pos].value;
  }
}

/*
 * mapping := zone (("," | lf) zone)*
 * zone := range | sequence
 * range := number "-" number
 * sequence := combo (";" combo)*
 * combo := number+
 */

// function parseMapping(state: ParseState): string[][]
function parseRange(state: ParseState): [ ParseState, number, number ] | undefined {
  const p1 = parseNumber(state);
  if (!p1) return undefined;
  state = p1[0];
  if (state.nextType() != TokenType.DASH) return undefined;
  state = state.advance();
  const p2 = parseNumber(state);
  if (!p2) return undefined;
  return [ p2[0], p1[1], p2[1] ];
}

function parseSequence(state: ParseState): [ ParseState, string[] ] | undefined {
  const rv: string[] = [];
  while (true) {
    const p = parseCombo(state);
    if (!p) return undefined;
    state = p[0];
    rv.push(p[1]);

    if (state.nextType() != TokenType.SEMICOLON) return [ state, rv ];
    state.advance();
  }
}

function parseCombo(state: ParseState): [ ParseState, string ] | undefined {
  const points: number[] = [];
  while (true) {
    const p = parseNumber(state);
    if (!p) {
      if (points.length == 0) return undefined;
      return [ state, String.fromCharCode(...points) ];
    }
    state = p[0];
    points.push(p[1]);
  }
}

function parseNumber(state: ParseState): [ ParseState, number ] | undefined {
  if (state.nextType() == TokenType.HEX) return [ state.advance(), parseInt(state.nextValue().slice(1), 16) ];
  if (state.nextType() == TokenType.DECIMAL) return [ state.advance(), parseInt(state.nextValue()) ];
  return undefined;
}

export function tokenize(line: string): Token[] {
  let i = 0, lastLine = 0, lineno = 1;
  const end = line.length;

  const matchToken = (type: TokenType, r: RegExp) => {
    const m = line.slice(i).match(r);
    if (!m) return undefined;
    return new Token(type, i, lineno, i - lastLine, m[0]);
  };

  const nextToken = () => {
    while (i < end && line[i].match(/[ \t]/)) i++;
    if (i == end) return new Token(TokenType.END, i, lineno, i - lastLine);
    let t = matchToken(TokenType.LF, /^\r?\n/);
    if (t) {
      lineno++;
      lastLine = i;
      return t;
    }
    return matchToken(TokenType.SEMICOLON, /^;/) ||
      matchToken(TokenType.COMMA, /^,/) ||
      matchToken(TokenType.EQUALS, /^=/) ||
      matchToken(TokenType.DASH, /^-/) ||
      matchToken(TokenType.HEX, /^x[\da-fA-F]+/) ||
      matchToken(TokenType.DECIMAL, /^\d+/);
  };

  const rv: Token[] = [];
  while (i < end) {
    const t = nextToken();
    if (!t) {
      const bad = line.slice(lastLine, i) + "[" + line[i] + "]...";
      throw new Error(`Unable to parse unicode range at (${lineno}:${lineno - lastLine}): ${bad}`);
    }
    rv.push(t);
    i += t.value.length;
  }
  return rv;
}
