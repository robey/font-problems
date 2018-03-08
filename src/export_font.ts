import { range } from "./arrays";
import { BitmapFont } from "./bitmap_font";
import { BitDirection } from "./glyph";

// various ways to lossily export a font.

export function exportAscii(font: BitmapFont, lineWidth: number = 80): string[] {
  const buffer: string[][] = [];
  let px = 0, py = 0;

  font.glyphs.forEach((glyph, index) => {
    const width = glyph.width + (font.isMonospace ? 0 : 1);
    if (px + width >= lineWidth) {
      py += font.cellHeight + 1;
      px = 0;
    }

    for (let y = 0; y < glyph.height; y++) {
      if (!buffer[py + y]) buffer[py + y] = [];
      for (let x = 0; x < glyph.width; x++) {
        buffer[py + y].push(glyph.getPixel(x, y) ? "@" : " ");
      }
      // space between chars
      if (!font.isMonospace) buffer[py + y].push(" ");
    }
    px += width;

    if (!buffer[py + font.cellHeight]) buffer[py + font.cellHeight] = [];
    const label = (font.codemap[index][0].codePointAt(0) || 0).toString(16);
    buffer[py + font.cellHeight].push(label);
    range(label.length, width).forEach(_ => buffer[py + font.cellHeight].push(" "));
  });
  return buffer.map(line => line.join(""));
}


export interface ExportOptions {
  // rows or columns?
  columns?: boolean;

  // big or little endian?
  direction?: BitDirection;

  // include the offsets of each glyph in the data table?
  // (this is really only necessary for proportional fonts stored as columns)
  includeOffsets?: boolean;
}

/*
 * generate a C header file with the font data as either rows or columns, in
 * big or little endian order.
 */
export function exportC(name: string, font: BitmapFont, options: ExportOptions = {}): string {
  const { desc, glyphData, offsets, bits } = packCodeExport(font, options);

  let text = "";
  text += `/* ${desc} */\n\n`;

  text += `const int ${name}_font_glyphs = ${font.glyphs.length};\n`;
  text += `const int ${name}_font_height = ${font.cellHeight};\n`;
  if (font.isMonospace) text += `const int ${name}_font_width = ${font.maxCellWidth()};\n`;
  if (options.includeOffsets) {
    text += `const int ${name}_font_offsets[${glyphData.length + 1}] = { ${offsets.join(", ")} };\n`;
  }
  text += "\n";
  text += `const unsigned int ${name}_font_data[${offsets[offsets.length - 1]}] = {\n`;
  glyphData.forEach((cell, i) => {
    const marker = (i > 0 && (i % 5 == 0)) ? `/* ${i} */` : "";
    text += "  " + cell.map(n => "0x" + hex(n, Math.ceil(bits / 4))).join(", ") + ", " + marker + "\n";
  });
  text += "};\n";
  return text;
}

/*
 * generate a rust code file with the font data as either rows or columns, in
 * big or little endian order.
 */
export function exportRust(name: string, font: BitmapFont, options: ExportOptions = {}): string {
  const { desc, glyphData, offsets, bits } = packCodeExport(font, options);
  const caps = name.toUpperCase();
  const dead = `#[allow(dead_code)]\n`;

  let text = "";
  text += `// ${desc}\n\n`;

  text += `${dead}pub const ${caps}_FONT_GLYPHS: usize = ${font.glyphs.length};\n`;
  text += `${dead}pub const ${caps}_FONT_HEIGHT: usize = ${font.cellHeight};\n`;
  if (font.isMonospace) text += `${dead}pub const ${caps}_FONT_WIDTH: usize = ${font.maxCellWidth()};\n`;
  if (options.includeOffsets) {
    text += `${dead}pub const ${caps}_FONT_OFFSETS: [usize; ${glyphData.length + 1}] = [ ${offsets.join(", ")} ];\n`;
  }
  text += "\n";
  text += `${dead}pub const ${caps}_FONT_DATA: [u32; ${offsets[offsets.length - 1]}] = [\n`;
  glyphData.forEach((cell, i) => {
    const marker = (i > 0 && (i % 5 == 0)) ? `// ${i}` : "";
    text += "  " + cell.map(n => "0x" + hex(n, Math.ceil(bits / 4))).join(", ") + ", " + marker + "\n";
  });
  text += "];\n";
  return text;
}

interface Exported {
  desc: string;
  glyphData: number[][];
  offsets: number[];
  bits: number;
}

function packCodeExport(font: BitmapFont, options: ExportOptions = {}): Exported {
  if (options.columns === undefined) options.columns = false;
  if (options.direction === undefined) options.direction = BitDirection.LE;
  if (options.includeOffsets === undefined) options.includeOffsets = options.columns && !font.isMonospace;

  const descEndian = (options.direction == BitDirection.LE ? "little" : "big") + "-endian";
  const edgeEndian = (options.direction == BitDirection.LE ?
    (options.columns ? "top" : "left") :
    (options.columns ? "bottom" : "right"));
  const explainEndian = `smallest bit on ${edgeEndian}`;
  const desc = `${options.columns ? "column" : "row"} data, ${descEndian} (${explainEndian})`;

  const bits = options.columns ? font.cellHeight : font.maxCellWidth();

  let total = 0;
  const offsets: number[] = [ 0 ];
  const glyphData = font.glyphs.map(g => {
    const data = options.columns ? g.packIntoColumns(options.direction) : g.packIntoRows(options.direction);
    total += data.length;
    offsets.push(total);
    return data;
  });
  return { desc, glyphData, offsets, bits };
}

function hex(n: number, width: number): string {
  return ("0000000000" + n.toString(16)).slice(-width);
}
