"use strict";

const bitmap_font = require("./bitmap_font");
const bmp = require("./bmp");
const fs = require("fs");
const minimist = require("minimist");
const path = require("path");
const unicodes = require("./unicodes");
const util = require("util");

require("source-map-support").install();

const MINIMIST_OPTIONS = {
  default: {
    map: "0-"
  },
  alias: {
    A: "ascii",
    B: "bmp",
    F: "fmap",
    H: "header",
    P: "psf",
    i: "import",
    m: "monospace"
  },
  string: [
    "canaryfile",
    "loglevel",
    "stack"
  ],
  boolean: [
    "monospace",
    "ascii",
    "header",
    "psf",
    "fmap",
    "bmp",
    "import"
  ]
};

const USAGE = `
font-problems: generate bitmap font files from a BMP image
    usage: font-problems [options] <bmp-file>

Read a font out of a bitmap file, and optionally generate a font file in
various (mostly made-up) formats. The bitmap is assumed to be a grid of
glyph cells, and the cell size can usually be guessed by an advanced AI.

examples:
    font-problems -m tom-thumb.bmp -A
        Read a font and display it as ascii art.

    font-problems -m lola.bmp -P -m 0-127,x2500-
        Generate a PSF with the first 128 chars as ascii, then the next 128
        starting at code-point 0x2500.

options:
    -o <filename>
        output file
    --monospace, -m
        treat font as monospace
    --ascii, -A
        dump the font back out as ascii art
    --header, -H
        dump a header file in "matrix LED" format
    --psf, -P
        dump a PSF v2 file (linux console format)
    --fmap, -F
        also dump out an fmap file of codepoint maps
    --bmp, -B
        also write a BMP of the font
    --import, -i
        import font from an existing PSF file
    --map <map>
        comma-separated list of unicode ranges for PSF files, or filename
`;

function main() {
  let options = minimist(process.argv.slice(2), MINIMIST_OPTIONS);
  if (options.help) {
    console.log(USAGE);
    return die();
  }

  const filenames = options._;
  if (filenames.length < 1) {
    console.log(USAGE);
    return die();
  }

  // PSF files must be monospace.
  if (options.psf) options.monospace = true;

  // is --map a file?
  if (fs.existsSync(options.map)) {
    options.map = fs.readFileSync(options.map).toString().trim().split("\n").join(",");
  }

  filenames.forEach(filename => {
    const name = path.basename(filename, path.extname(filename)).replace(/[^\w]/g, "_");
    let outname = options.o;
    const font = options.import ? psf.read(fs.readFileSync(filename)) : loadBmp(filename, options);

    if (options.ascii) {
      font.dumpToAscii(process.stdout.isTTY ? process.stdout.columns : 80).forEach(line => console.log(line));
    }
    if (options.header) {
      if (!outname) outname = replaceExtension(filename, "h");
      fs.writeFileSync(outname, font.generateHeaderFile(name));
      console.log(`Wrote header: ${outname}`);
    }
  });



  //   if options.psf
  //     if not outname? then outname = replaceExtension(filename, "psf")
  //     fs.writeFileSync(outname, psf.write(font, true))
  //     console.log "Wrote PSF: #{outname}"
  //   if options.fmap
  //     if not outname? then outname = filename
  //     outname = replaceExtension(outname, "fmap")
  //     data = font.charsDefined().map((ch) -> sprintf("x%x", ch)).join("\n") + "\n"
  //     fs.writeFileSync(outname, data)
  //     console.log "Wrote fmap: #{outname}"
  //   if options.bmp
  //     if not outname? then outname = filename
  //     outname = replaceExtension(outname, "bmp")
  //     cellWidth = font.cellWidth(font.charsDefined()[0])
  //     framebuffer = new bmp.Framebuffer(null, cellWidth * 32, font.cellHeight * 8, 24)
  //     for ch, i in font.charsDefined()
  //       font.drawToFramebuffer(ch, framebuffer, (i % 32) * cellWidth, Math.floor(i / 32) * font.cellHeight, 0xffffff, 0)
  //     data = bmp.writeBmp(framebuffer)
  //     fs.writeFileSync(outname, data)
  //     console.log "Wrote bmp: #{outname}"

}

function die(error) {
  if (error) process.stderr.write(error.stack + "\n");
  process.exit(error ? 1 : 0);
}

function loadBmp(filename, options) {
  const framebuffer = bmp.readBmp(filename);
  const font = bitmap_font.loadFromFramebuffer(framebuffer, {
    isMonospace: options.monospace,
    generator: unicodes.fromRanges(options.map)
  });
  console.log(`Using cell dimensions ${font.gridCellWidth} x ${font.gridCellHeight}`);
  return font;
}

function replaceExtension(filename, newExtension) {
  const ext = path.extname(filename);
  return path.join(path.dirname(filename), path.basename(filename, ext)) + "." + newExtension;
}


exports.main = main;
