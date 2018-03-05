import * as fs from "fs";
import * as minimist from "minimist";
import * as path from "path";
import { BitmapFont, ImportOptions } from "./bitmap_font";
import { readBmp, writeBmp } from "./bmp";
import { dumpCodemap, parseCodemap } from "./codemap";
import { exportAscii } from "./export_font";
import { Framebuffer } from "./framebuffer";
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
    .h      C header (output only)
    .rs     rust header (output only)

Input options:
    --width <number>
        specify the width of the grid when loading a font from a BMP file
        (by default, it will try to guess)
    --height <number>
        specify the height of the grid when loading a font from a BMP file
        (by default, it will try to guess)
    --map <filename>
        read a "psfmap" file describing the mapping of unicode code-points
        to each glyph (see docs for a description of this format)

Output options:
    --ascii
        dump out the font in ASCII, using @ for pixels
    --termwidth <N>
        width of the terminal when dumping ASCII
    --write-map
        also write a ".psfmap" file with the glyph-to-unicode maps
    --rowsize <N>
        how many glyphs to draw on each line for BMP
    --fg <hex>
        foreground color (default "000000") when writing a BMP file
    --bg <hex>
        background color (default "ffffff") when writing a BMP file
    --sample <text>
        instead of writing a BMP of the font contents, write a BMP of some
        sample text
`;


// examples:
//     font-problems -m tom-thumb.bmp -A
//         Read a font and display it as ascii art.
//
//     font-problems -m lola.bmp -P -m 0-127,x2500-
//         Generate a PSF with the first 128 chars as ascii, then the next 128
//         starting at code-point 0x2500.
//
// options:
//     -o <filename>
//         output file
//     --monospace, -m
//         treat font as monospace
//     --ascii, -A
//         dump the font back out as ascii art
//     --header, -H
//         dump a header file in "matrix LED" format
//     --rust, -R
//         dump a rust header file in "matrix LED" format
//     --psf, -P
//         dump a PSF v2 file (linux console format)
//     --fmap, -F
//         also dump out an fmap file of codepoint maps
//     --bmp, -B
//         also write a BMP of the font
//     --import, -i
//         import font from an existing PSF file
// `;

const MINIMIST_OPTIONS = {
  default: {
    ascii: false,
    bg: "ffffff",
    fg: "000000",
    monospace: false,
    rowsize: "16",
    termwidth: "80",
    verbose: false,
  },
  alias: {
    m: "monospace",
    v: "verbose",
  },
  string: [
    "bg",
    "fg",
    "height",
    "map",
    "rowsize",
    "sample",
    "width",
  ],
  boolean: [
    "monospace",
    "ascii",
    "verbose",
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
    let codemap: string[][] | undefined;

    const font = loadFont(options, inFilename);
    verbose(options, `Loaded font ${inFilename}: ${font.glyphs.length} glyphs, ` +
      (font.isMonospace ? "monospace" : "proportional") + `, ${font.maxCellWidth()} x ${font.cellHeight}`);
    if (outFilename) {
      if (options.sample) {
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

    case ".bmp":
      const fb = readBmp(fs.readFileSync(filename));
      const importOptions: ImportOptions = { isMonospace: options.monospace };
      if (options.width) importOptions.cellWidth = parseInt(options.width, 10);
      if (options.height) importOptions.cellHeight = parseInt(options.height, 10);
      const font = BitmapFont.importFromImage(fb, importOptions);
      if (options.map) font.codemap = parseCodemap(font.glyphs.length, fs.readFileSync(options.map).toString());
      return font;

    default:
      throw new Error(`Unsupported input file type: ${ext}`);
  }
}

function saveFont(options: minimist.ParsedArgs, font: BitmapFont, filename: string, ext?: string) {
  if (!ext) ext = path.extname(filename);

  switch (ext) {
    case ".psf":
      fs.writeFileSync(filename, writePsf(font));
      verbose(options, `Wrote PSF file: ${filename}`);
      return;

    case ".bmp":
      const rowsize = parseInt(options.rowsize, 10);
      const fg = parseInt(options.fg, 16), bg = parseInt(options.bg, 16);
      const fb = font.dumpIntoFramebuffer(rowsize, fg, bg);
      fs.writeFileSync(filename, writeBmp(fb));
      verbose(options, `Wrote ${fb.width} x ${fb.height} BMP file: ${filename}`);
      return;

    default:
      throw new Error(`Unsupported input file type: ${ext}`);
  }
}

function writeSample(options: minimist.ParsedArgs, font: BitmapFont, text: string): Framebuffer {
  const lines = text.split(/\n|\\n/);
  const glyphLines = lines.map(line => {
    return Array.from(line).map(char => font.find(char) || font.find("\ufffd") || font.glyphs[0]);
  });

  const fg = parseInt(options.fg, 16), bg = parseInt(options.bg, 16);
  const width = Math.max(...glyphLines.map(glyphLine => glyphLine.reduce((sum, glyph) => {
    return sum + glyph.width + (font.isMonospace ? 0 : 1);
  }, 0)));
  const height = glyphLines.length * font.cellHeight;

  const fb = new Framebuffer(width, height, 24);
  fb.fill(bg);

  let y = 0;
  glyphLines.forEach(glyphLine => {
    let x = 0;
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
