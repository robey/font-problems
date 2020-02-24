import { range } from "./arrays";
import { BitmapFont } from "./bitmap_font";
import { BitDirection, Glyph } from "./glyph";

export function read_bdf(buffer: Uint8Array, monospace: boolean): BitmapFont {
  const lines = (new TextDecoder()).decode(buffer).split("\n");
  if (lines[0] != "STARTFONT 2.1") throw new Error("Not a BDF file");

  const font = new BitmapFont(true);
  let box_width = 0;
  let box_height = 0;
  let properties: Map<string, string> = new Map();
  let current_glyph = " ";  // so if we have to guess, start at space
  let current_width = 0;
  let current_height = 0;
  let current_x_offset = 0;
  let current_y_offset = 0;

  let i = 1;
  while (i < lines.length) {
    const sp = lines[i].indexOf(" ");
    const keyword = sp > 0 ? lines[i].slice(0, sp) : lines[i];
    let args = sp > 0 ? parse_args(lines[i].slice(sp + 1)) : [];

    if (keyword == "FONTBOUNDINGBOX") {
      box_width = parseInt(args[0]);
      box_height = parseInt(args[1]);
    } else if (keyword == "STARTPROPERTIES") {
      const count = parseInt(args[0]);
      for (let n = 0; n < count; n++) {
        i++;
        args = parse_args(lines[i]);
        properties.set(args[0], args[1]);
      }
    } else if (keyword == "ENCODING") {
      current_glyph = String.fromCodePoint(parseInt(args[0], 10));
    } else if (keyword == "BBX") {
      current_width = parseInt(args[0]);
      current_height = parseInt(args[1]);
      current_x_offset = parseInt(args[2]);
      current_y_offset = parseInt(args[3]);
    } else if (keyword == "BITMAP") {
      // hackity hack-hack: if the x offset is positive, it means "assume
      // the presence of N missing 0 bits on the left".
      const left_shift = current_x_offset <= 0 || current_x_offset % 8 == 0 ? 0 : 8 - current_x_offset % 8;
      const expected_bit_length = Math.ceil((monospace ? box_width : current_width) / 8) * 8;
      const rows: number[] = [];
      for (const n of range(0, current_height)) {
        i++;
        const bit_length = 4 * lines[i].length + left_shift;
        let row = parseInt(lines[i], 16) << left_shift;
        // if we shift left so many places that we add an unnecessary byte,
        // we have to backtrack.
        if (bit_length > expected_bit_length) row >>= 8;
        rows.push(row);
      }
      // hackity hack-hack: if the y offset is positive instead of negative,
      // it means "assume the presence of N missing rows of all zeros".
      while (rows.length < box_height) rows.push(0);
      console.log(monospace, box_width, current_glyph.codePointAt(0), rows.map(n => n.toString(16)))
      font.add(Glyph.fromRows(rows, monospace ? box_width : current_width, BitDirection.BE), [ current_glyph ]);
    } else if (keyword == "ENDCHAR") {
      current_glyph = String.fromCodePoint((current_glyph.codePointAt(0) ?? 0) + 1);
    }

    i++;
  }

  return font;
}

// i'm not sure why this format is so annoying, but it is
function parse_args(s: string): string[] {
  const rv: string[] = [];
  let start = 0, quoted = false;

  while (start < s.length) {
    let n = start;
    if (s[n] == '"') {
      do {
        n = s.indexOf('"', n + 1);
      } while (n > 0 && s[n - 1] == "\\");
      n++;
    } else {
      n = s.indexOf(" ", n);
    }
    if (n < 0) n = s.length;

    let arg = s.slice(start, n);
    if (arg[0] == '"') arg = arg.slice(1, arg.length - 1);
    rv.push(arg);
    start = n + 1;
  }

  return rv;
}
