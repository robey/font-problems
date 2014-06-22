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
  options = yargs
    .usage(USAGE)
    .example("$0 -m tom-thumb.bmp -A", "read a font and display it as ascii art")
    .options("monospace", alias: "m", describe: "treat font as monospace")
    .options("ascii", alias: "A", describe: "dump the font back out as ascii art")
    .options("header", alias: "H", describe: "dump a header file in 'matrix LED' format")
    .boolean([ "monospace", "ascii" ])

  argv = options.argv
  filenames = argv._
  if filenames.length < 1
    options.showHelp()
    process.exit 1
  for filename in filenames
    name = path.basename(filename, path.extname(filename)).replace(/[^\w]/g, "_")
    framebuffer = bmp.readBmp(filename)
    font = decodeFont(framebuffer, argv.monospace)
    if argv.ascii
      for line in font.dumpToAscii(if process.stdout.isTTY then process.stdout.columns else 80) then console.log line
    if argv.header?
      fs.writeFileSync(argv.header, generateHeaderFile(font, name))
      console.log "Wrote: #{argv.header}"

    # for k, v of font.font.packIntoRows(bitmap_font.BE)
    #   console.log sprintf("%3d: ", parseInt(k)) + v.map((row) -> sprintf("%02x", row)).join(" ")
#  dumpFont(font, process.argv[3])

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
  chars = font.packIntoColumns(font.LE)
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




# scan a char cell, left to right, bottom to top, so that we have a word for
# each column (left to right), with the LSB being the top bit.
decodeFontChar = (framebuffer, x, y, width, height) ->
  cols = []
  for px in [0 ... width]
    ch = 0
    for py in [0 ... height]
      pixel = framebuffer[y + height - py - 1][x + px]
      ch = (ch << 1) | (if (pixel & 0xffffff) == 0 then 1 else 0)
    cols.push ch
  # for proportional fonts, remove redundant empty cols on the right
  while cols.length > 1 and cols[cols.length - 1] == 0 then cols = cols[... cols.length - 1]
  # what about "space"? for a proportional font, use 2/3 the total width
  if cols.length == 1 and cols[0] == 0 then cols = (for i in [0 ... Math.round(width / 2)] then 0)
  cols

dumpFont = (font, name) ->
  text = ""
  lookups = [ 0 ]
  total = 0
  for ch in font.chars
    total += ch.length
    lookups.push total
  text += "const int #{name}_font_height = #{font.cellHeight};\n"
  text += "const int #{name}_font_offsets[#{font.chars.length + 1}] = { " + lookups.join(", ") + " };\n"
  text += "const int #{name}_font_data[#{total}] = {\n"
  for ch in font.chars
    text += "  " + (for col in ch then sprintf("0x%08x", col)).join(", ") + ", \n"
  text += "};\n"
  fs.writeFileSync("src/#{name}_font.h", text)


displayFont = (font) ->
  framebuffer = (for i in [0 ... font.cellHeight] then [])
  for ch in font.chars
    if framebuffer[0].length > 80
      flushDisplay(framebuffer)
      framebuffer = (for i in [0 ... font.cellHeight] then [])
    for col in ch
      for y in [0 ... font.cellHeight]
        framebuffer[y].push(if (col & 1) != 0 then "@" else " ")
        col >>= 1
    # space between chars
    for y in [0 ... font.cellHeight] then framebuffer[y].push " "
  flushDisplay(framebuffer)

flushDisplay = (framebuffer) ->
  for line in framebuffer
    console.log line.join("")

display = (framebuffer) ->
  for row in framebuffer
    line = row.map (pixel) ->
      c = antsy.get_color('#' + (pixel & 0xffffff).toString(16))
      "\u001b[38;5;#{c}m%"
    console.log line.join("") + "\u001b[0m"


exports.main = main
