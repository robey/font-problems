import { BitDirection, Glyph } from "./glyph";
import { BitmapFont } from "./bitmap_font";
import { range } from "./arrays";


export interface ImportOptions {
  // width of each cell in the grid
  cellWidth: number;

  // height of each cell in the grid
  cellHeight: number;

  // rows or columns?
  columns?: boolean;

  // big or little endian?
  direction?: BitDirection;

  // add an extra row/column?
  pad?: boolean;

  // where to log debug messages
  logger?: (text: string) => void;
}

// 0xHH or DD optionally followed by commas and whitespace
// (the "g" is necessary to make matchAll work, because the ES6 engine keeps
// mutable state in the regex itself to track successive matches)  O_o
const DATA_REGEX = /\b(?:(0x[0-9a-fA-F]+|\d+)\s*(?:$|,))/g;

export function importHeader(content: string, options: ImportOptions): BitmapFont {
  let data: number[] = [];
  let found_data = false;

  const lines = content.split("\n").map(line => line.trim());
  lines.forEach((line, i) => {
    // get rid of C-style comments
    line = line.replace(/\/\/(.*?)$/, "");
    const fields = matchAll(DATA_REGEX, line).map(m => {
      if (m[1].startsWith("0x")) {
        return parseInt(m[1].slice(2), 16);
      } else {
        return parseInt(m[1], 10);
      }
    });

    if (fields.length >= 1) {
      if (!found_data) {
        found_data = true;
        if (options.logger) options.logger(`Found data starting at line ${i + 1}`);
      }
      data.push(...fields);
    }
  });

  // is this plausible?
  const glyph_size = options.columns ? options.cellWidth : options.cellHeight;
  if (data.length % glyph_size != 0) {
    if (options.logger) options.logger(`Expected multiple of ${glyph_size} bytes, found ${data.length}`);
    throw new Error("Invalid data");
  }
  const glyph_count = data.length / glyph_size;
  options.logger?.(`Found ${glyph_count} glyphs (${options.cellWidth} x ${options.cellHeight})`);

  const font = new BitmapFont(true);
  for (const i of range(0, glyph_count)) {
    const offset = i * glyph_size;
    const glyph_data = data.slice(offset, offset + glyph_size);
    if (options.pad) glyph_data.push(0);
    const glyph = options.columns ?
      Glyph.fromColumns(glyph_data, options.cellHeight, options.direction) :
      Glyph.fromRows(glyph_data, options.cellWidth, options.direction);
    font.add(glyph, [ i ]);
  }
  return font;
}


// not all ES6 engines have matchAll (?!)
function matchAll(r: RegExp, s: string): RegExpExecArray[] {
  const rv: RegExpExecArray[] = [];
  let m = r.exec(s);
  while (m != null) {
    rv.push(m);
    m = r.exec(s);
  }
  return rv;
}
