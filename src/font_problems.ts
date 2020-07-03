import * as fs from "fs";
import * as minimist from "minimist";
import * as path from "path";
import { read_bdf, write_bdf } from "./bdf";
import { BitmapFont, ImportOptions } from "./bitmap_font";
import { readBmp, writeBmp } from "./bmp";
import { dumpCodemap, parseCodemap } from "./codemap";
import { exportAscii, exportBin, exportC, ExportOptions, exportRust } from "./export_font";
import { Framebuffer } from "./framebuffer";
import { BitDirection } from "./glyph";
import { importHeader } from "./import_font";
import { readPsf, writePsf } from "./psf";

import "source-map-support/register";

const USAGE = `
font-problems: read/write bitmap console fonts as either BMP images or PSF

Usage:
    font-problems [options] <in-file> [out-file]

Read a bitmap console font from one format and optionally write it out in a
different format. Formats are normally inferred from the filename extension.

Supported formats are:
    .bmp    grid of glyphs
    .psf    portable screen font (used by unix terminal consoles)
    .bdf    bitmap distribution format (used by X11 and many others)
    .h      C header (output anything, input must be monospace)
    .rs     Rust header (output anything, input must be monospace)
    .bin    raw binary data (output only)

Input options:
    --monospace, -m
        treat an imported image as monospace instead of proportional
    --reversed
        the BMP is white-on-black, instead of black-on-white
    --width <number>
        specify the width of the grid when loading a font from a BMP file
        (by default, it will try to guess)
    --height <number>
        specify the height of the grid when loading a font from a BMP file
        (by default, it will try to guess)
    --map <filename>
        read a "psfmap" file describing the mapping of unicode code-points
        to each glyph (see docs for a description of this format)
    --vertical
        with a source or binary file, use vertical columns as the values
        for each glyph (horizontal rows are default)
    --pad
        when importing raw data from a source file, add a blank row or
        column to each glyph (in case a 6x8 font is encoded as 5x8, for
        example)

Output options:
    --verbose, -v
        describe to stdout what it's doing
    --ascii
        dump out the font in ASCII, using @ for pixels
    --termwidth <N>
        width of the terminal when dumping ASCII
    --write-map
        also write a ".psfmap" file with the glyph-to-unicode maps
    --rowsize <N>
        how many glyphs to draw on each line for BMP
    --vertical
        (same as on input)
    --big-endian, -B
        when exporting a source or binary file, write the left or top pixels
        into the high bits (little-endian, the low bits, is the default)
    --offsets
        when exporting to C or Rust, include a table of the offsets of each
        glyph in the data table (by default, this only happens with
        proportional fonts in vertical mode)
    --codemap
        when exporting to C or Rust, include a table of the unicode codepoint
        mappings
    --datatype <name>
        when exporting to C or Rust, use this named int type for the cell
        data instead of "unsigned int" in C, or "u8", "u16", "u32" (depending
        on data size) in Rust
    --fg <hex>
        foreground color (default "000000") when writing a BMP file
    --bg <hex>
        background color (default "ffffff") when writing a BMP file
    --sample <text>
        instead of writing a BMP of the font contents, write a BMP of some
        sample text
    --margin <N>
        when drawing sample text, leave an N-pixel margin around the edge
    --scale <N>
        turn each pixel into an NxN square in the output
    --sort
        split out each codepoint into its own glyph (even when it's the same
        as another) and sort by codepoint

Examples:
    font-problems -m tom-thumb.bmp --ascii
        import a font from a BMP file and display it as ASCII art

    font-problems --vertical terminal.psf terminal.h
        read a PSF file and export a C header file describing each glyph as
        a series of ints that each describe one column (useful for embedded
        projects)
`;

const MINIMIST_OPTIONS = {
  default: {
    ascii: false,
    bg: "ffffff",
    codemap: false,
    debug: false,
    fg: "000000",
    margin: "0",
    monospace: false,
    pad: false,
    reversed: false,
    rowsize: "16",
    termwidth: "80",
    verbose: false,
  },
  alias: {
    m: "monospace",
    v: "verbose",
    B: "big-endian",
  },
  string: [
    "bg",
    "datatype",
    "fg",
    "height",
    "map",
    "rowsize",
    "sample",
    "scale",
    "width",
  ],
  boolean: [
    "ascii",
    "big-endian",
    "codemap",
    "debug",
    "monospace",
    "offsets",
    "pad",
    "reversed",
    "verbose",
    "vertical",
    "write-map",
  ]
};

export function main() {
  let options = minimist(process.argv.slice(2), MINIMIST_OPTIONS);
  if (options.help || options._.length < 1 || options._.length > 2) {
    console.log(USAGE);
    return die();
  }

  const inFilename = options._[0];
  const outFilename = options._[1];

  try {
    const font = loadFont(options, inFilename);
    verbose(options, `Loaded font ${inFilename}: ${font.glyphs.length} glyphs, ` +
      (font.isMonospace ? "monospace" : "proportional") + `, ${font.maxCellWidth()} x ${font.cellHeight}`);

    if (options.scale) font.scale(parseInt(options.scale, 10));
    if (options.sort) font.sort();

    if (options.debug) {
      font.removeDead();
      for (let i = 0; i < font.glyphs.length; i++) {
        const points = font.codemap[i].map(cp => cp.toString(16)).join(", ");
        console.log(`${points}:`);
        console.log(font.glyphs[i].debug());
        console.log("");
      }
    }

    if (outFilename) {
      if (options.sample !== undefined) {
        const fb = writeSample(options, font, options.sample);
        fs.writeFileSync(outFilename, writeBmp(fb));
        verbose(options, `Wrote sample text (${fb.width} x ${fb.height}) to file: ${outFilename}`);
      } else {
        saveFont(options, font, outFilename);
        if (options["write-map"]) {
          const mapFilename = outFilename.replace(/\.\w+$/, ".psfmap");
          fs.writeFileSync(mapFilename, dumpCodemap(font.codemap));
          verbose(options, `Wrote codemap file: ${mapFilename}`);
        }
      }
    }
    if (options.ascii) {
      const rowsize = parseInt(options.termwidth, 10);
      exportAscii(font, rowsize).forEach(line => process.stdout.write(line + "\n"));
    }
  } catch (error) {
    die(error);
  }
}

function loadFont(options: minimist.ParsedArgs, filename: string, ext?: string): BitmapFont {
  if (!ext) ext = path.extname(filename);

  switch (ext) {
    case ".psf":
      return readPsf(fs.readFileSync(filename));

    case ".bdf":
      return read_bdf(fs.readFileSync(filename), options.monospace);

    case ".bmp":
      const fb = readBmp(fs.readFileSync(filename));
      const importOptions: ImportOptions = { isMonospace: options.monospace, reversed: options.reversed };
      if (options.width) importOptions.cellWidth = parseInt(options.width, 10);
      if (options.height) importOptions.cellHeight = parseInt(options.height, 10);
      const font = BitmapFont.importFromImage(fb, importOptions);
      if (options.map) font.codemap = parseCodemap(font.glyphs.length, fs.readFileSync(options.map).toString());
      return font;

    case ".c":
    case ".h":
    case ".rs":
      const headerImportOptions = {
        cellWidth: parseInt(options.width ?? "8", 10),
        cellHeight: parseInt(options.height ?? "8", 10),
        columns: options.vertical,
        pad: options.pad,
        direction: options["big-endian"] ? BitDirection.BE : BitDirection.LE,
        logger: (text: string) => verbose(options, text),
      };
      return importHeader(fs.readFileSync(filename).toString(), headerImportOptions);

    default:
      throw new Error(`Unsupported input file type: ${ext}`);
  }
}

function saveFont(options: minimist.ParsedArgs, font: BitmapFont, filename: string, ext?: string) {
  if (!ext) ext = path.extname(filename);

  switch (ext) {
    case ".psf":
      fs.writeFileSync(filename, writePsf(font, { withMap: true }));
      verbose(options, `Wrote PSF file: ${filename}`);
      return;

    case ".bdf":
      fs.writeFileSync(filename, write_bdf(font, path.basename(filename)));
      verbose(options, `Wrote BDF file: ${filename}`);
      return;

    case ".bmp": {
      const rowsize = parseInt(options.rowsize, 10);
      const fg = parseInt(options.fg, 16), bg = parseInt(options.bg, 16);
      const fb = font.dumpIntoFramebuffer(rowsize, fg, bg);
      fs.writeFileSync(filename, writeBmp(fb));
      verbose(options, `Wrote ${fb.width} x ${fb.height} BMP file: ${filename}`);
      return;
    }

    case ".h": {
      const cOptions: ExportOptions = { columns: false, direction: BitDirection.LE };
      if (options.vertical) cOptions.columns = true;
      if (options["big-endian"]) cOptions.direction = BitDirection.BE;
      if (options.offsets) cOptions.includeOffsets = true;
      if (options.datatype) cOptions.datatype = options.datatype;
      if (options.codemap) cOptions.includeCodemap = true;
      fs.writeFileSync(filename, exportC(path.basename(filename, ext), font, cOptions));
      const endian = cOptions.direction == BitDirection.LE ? "little" : "big";
      const orientation = cOptions.columns ? "columns" : "rows";
      verbose(options, `Wrote C header file (${endian}-endian ${orientation}): ${filename}`);
      return;
    }

    case ".rs": {
      const cOptions: ExportOptions = { columns: false, direction: BitDirection.LE };
      if (options.vertical) cOptions.columns = true;
      if (options["big-endian"]) cOptions.direction = BitDirection.BE;
      if (options.offsets) cOptions.includeOffsets = true;
      if (options.datatype) cOptions.datatype = options.datatype;
      if (options.codemap) cOptions.includeCodemap = true;
      fs.writeFileSync(filename, exportRust(path.basename(filename, ext), font, cOptions));
      const endian = cOptions.direction == BitDirection.LE ? "little" : "big";
      const orientation = cOptions.columns ? "columns" : "rows";
      verbose(options, `Wrote Rust header file (${endian}-endian ${orientation}): ${filename}`);
      return;
    }

    case ".bin": {
      const bOptions: ExportOptions = { columns: false, direction: BitDirection.LE };
      if (options.vertical) bOptions.columns = true;
      if (options["big-endian"]) bOptions.direction = BitDirection.BE;
      fs.writeFileSync(filename, exportBin(font, bOptions));
      const endian = bOptions.direction == BitDirection.LE ? "little" : "big";
      const orientation = bOptions.columns ? "columns" : "rows";
      verbose(options, `Wrote binary bitmap file (${endian}-endian ${orientation}): ${filename}`);
      return;
    }

    default:
      throw new Error(`Unsupported output file type: ${ext}`);
  }
}

function writeSample(options: minimist.ParsedArgs, font: BitmapFont, text: string): Framebuffer {
  const lines = (text[0] != "@" ? text : fs.readFileSync(text.slice(1)).toString()).split(/\n|\\n/);
  const glyphLines = lines.map(line => {
    return [...line].map(char => font.find(char) || font.find("\ufffd") || font.glyphs[0]);
  });

  const fg = parseInt(options.fg, 16), bg = parseInt(options.bg, 16);
  const margin = parseInt(options.margin);
  const width = Math.max(...glyphLines.map(glyphLine => glyphLine.reduce((sum, glyph) => {
    return sum + glyph.width + (font.isMonospace ? 0 : 1);
  }, 0)));
  const height = glyphLines.length * font.cellHeight;

  const fb = new Framebuffer(width + 2 * margin, height + 2 * margin, 24);
  fb.fill(bg);

  let y = margin;
  glyphLines.forEach(glyphLine => {
    let x = margin;
    glyphLine.forEach(glyph => {
      glyph.draw(fb.view(x, y, x + glyph.width, y + glyph.height), fg, bg);
      x += glyph.width + (font.isMonospace ? 0 : 1);
    });
    y += font.cellHeight;
  });
  return fb;
}

function verbose(options: minimist.ParsedArgs, message: string) {
  if (!options.verbose) return;
  process.stdout.write(message + "\n");
}

function die(error?: Error) {
  if (error) process.stderr.write(error.stack + "\n");
  process.exit(error ? 1 : 0);
}
