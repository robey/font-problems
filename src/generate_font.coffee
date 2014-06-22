#!/usr/bin/env coffee

antsy = require "antsy"
bmp = require "./bmp"
bitmap_font = require "./bitmap_font"
fs = require "fs"
path = require "path"
sprintf = require "sprintf"
util = require "util"
yargs = require "yargs"


USAGE = """
$0 [options] <bmp-file>
    Read a font out of a bitmap file, and optionally generate a font file in
    various (mostly made-up) formats. The bitmap is assumed to be a grid of
    glyph cells, and the cell size can usually be guessed by an advanced AI.
"""

main = ->
  yargs = yargs
    .usage(USAGE)
    .example("$0 -m tom-thumb.bmp -A", "read a font and display it as ascii art")
    .options("monospace", alias: "m", describe: "treat font as monospace")
    .options("ascii", alias: "A", describe: "dump the font back out as ascii art")
    .options("header", alias: "H", describe: "dump a header file in 'matrix LED' format")
    .options("psf", alias: "P", describe: "dump a PSF v2 file (linux console format)")
    .boolean([ "monospace", "ascii" ])

  options = yargs.argv
  filenames = options._
  if filenames.length < 1
    yargs.showHelp()
    process.exit 1
  # PSF files must be monospace.
  if options.psf? then options.monospace = true
  for filename in filenames
    name = path.basename(filename, path.extname(filename)).replace(/[^\w]/g, "_")
    framebuffer = bmp.readBmp(filename)
    font = decodeFont(framebuffer, options.monospace)
    if options.ascii
      for line in font.dumpToAscii(if process.stdout.isTTY then process.stdout.columns else 80) then console.log line
    if options.header?
      fs.writeFileSync(options.header, generateHeaderFile(font, name))
      console.log "Wrote header: #{options.header}"
    if options.psf?
      fs.writeFileSync(options.psf, generatePsf(font))
      console.log "Wrote PSF: #{options.psf}"

decodeFont = (framebuffer, isMonospace) ->
  [ cellWidth, cellHeight ] = sniffBoundaries(framebuffer)
  console.log "Assuming cell dimensions #{cellWidth} x #{cellHeight}"
  charRows = framebuffer.height / cellHeight
  charColumns = framebuffer.width / cellWidth
  font = new bitmap_font.BitmapFont(isMonospace)
  for y in [0 ... charRows]
    for x in [0 ... charColumns]
      font.getFromFramebuffer(y * charColumns + x, framebuffer, x * cellWidth, y * cellHeight, cellWidth, cellHeight)
  font

# detect cell boundaries by finding rows & columns that are mostly on
sniffBoundaries = (framebuffer) ->
  rows = [0 ... framebuffer.height].map (y) -> framebuffer.averageBrightness(0, y, framebuffer.width, y + 1)
  columns = [0 ... framebuffer.width].map (x) -> framebuffer.averageBrightness(x, 0, x + 1, framebuffer.height)
  cellHeight = detectSpacing(rows, [6 .. 16])
  cellWidth = detectSpacing(columns, [4 .. 12])
  [ cellWidth, cellHeight ]

# for a range of N, look at every Nth line and average them together, to find
# the N that's most often bright. for example, if there's a pattern of every
# 8th row being brighter than the rest, then the cells are probably 8 pixels
# tall, and the bottom line is the space between glyphs.
# lines: each row or column, in average brightness across that line
# range: guesses to try for the number of lines per cell
detectSpacing = (lines, range) ->
  guesses = for n in range
    if lines.length % n != 0
      # if it isn't evenly divisible by this guess, then the guess is wrong.
      { n, weight: 0 }
    else
      count = lines.length / n
      { n, weight: ([1 ... count].map((i) -> lines[i * n - 1]).reduce (a, b) -> a + b) / count }
  guesses.sort (a, b) ->
    # by highest weight, and in case of tie, by smallest n
    if a.weight == b.weight then a.n - b.n else b.weight - a.weight
  guesses[0].n

# generate a header file for the LED matrix: left to right, bottom to top,
# a word for each column, with the LSB being the top bit.
generateHeaderFile = (font, name) ->
  text = ""
  lookups = [ 0 ]
  total = 0
  chars = font.packIntoColumns(bitmap_font.LE)
  for char, cell of chars
    total += cell.length
    lookups.push total
  text += "const int #{name}_font_height = #{font.cellHeight};\n"
  text += "const int #{name}_font_offsets[#{Object.keys(chars).length + 1}] = { " + lookups.join(", ") + " };\n"
  text += "const int #{name}_font_data[#{total}] = {\n"
  for char, cell of chars
    text += "  " + (for col in cell then sprintf("0x%08x", col)).join(", ") + ", \n"
  text += "};\n"
  text

PSF_MAGIC = 0x72b54a86
PSF_VERSION = 0
PSF_HEADER_SIZE = 32
PSF_FLAG_HAS_UNICODE_TABLE = 0x01
PSF_UNICODE_SEPARATOR = 0xff
PSF_UNICODE_STARTSEQ = 0xfe

# generate a linux PSF (console font) data file
generatePsf = (font, withMap = false) ->
  chars = font.charsDefined()
  if chars.length != 256 and chars.length != 512
    throw new Error("PSF appears to support only 256 or 512 characters, not #{chars.length}")
  # PSF files are monospace, so all chars have the same width.
  cellWidth = font.cellWidth(chars[0])
  rowsize = Math.ceil(cellWidth / 8)
  if rowsize > 2 then throw new Error("I don't support such wide glyphs yet (max 16 pixels)")
  charsize = font.cellHeight * rowsize
  header = new Buffer(PSF_HEADER_SIZE)
  header.writeUInt32BE(PSF_MAGIC, 0)
  header.writeUInt32LE(PSF_VERSION, 4)
  header.writeUInt32LE(PSF_HEADER_SIZE, 8)
  header.writeUInt32LE((if withMap then PSF_FLAG_HAS_UNICODE_TABLE else 0), 12) # flags
  header.writeUInt32LE(chars.length, 16)
  header.writeUInt32LE(charsize, 20)
  header.writeUInt32LE(font.cellHeight, 24)
  header.writeUInt32LE(cellWidth, 28)
  # now write glyph data and unicode data
  data = new Buffer(chars.length * charsize)
  mapData = new Buffer(chars.length * 5)
  i = 0
  mi = 0
  for char, rows of font.packIntoRows(bitmap_font.BE)
    for row in rows
      if rowsize > 1
        data.writeUInt8((row >> 8) & 0xff, i)
        i += 1
      data.writeUInt8(row & 0xff, i)
      i += 1
    if withMap
      ch = utf8(char)
      ch.copy(mapData, mi)
      mi += ch.length
      mapData.writeUInt8(PSF_UNICODE_SEPARATOR, mi)
      mi += 1
  Buffer.concat([ header, data, mapData.slice(0, mi) ])

utf8 = (n) -> new Buffer(String.fromCharCode(n), "UTF-8")

exports.main = main
