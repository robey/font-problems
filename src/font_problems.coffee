#!/usr/bin/env coffee

antsy = require "antsy"
bmp = require "./bmp"
bitmap_font = require "./bitmap_font"
fs = require "fs"
path = require "path"
psf = require "./psf"
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
    .example("$0 -m lola.bmp -P -m 0-127,x2500-", "generate a PSF with the first 128 chars as ascii, then the next 128 starting at 0x2500")
    .options("monospace", alias: "m", describe: "treat font as monospace")
    .options("ascii", alias: "A", describe: "dump the font back out as ascii art")
    .options("header", alias: "H", describe: "dump a header file in 'matrix LED' format")
    .options("psf", alias: "P", describe: "dump a PSF v2 file (linux console format)")
    .options("fmap", alias: "F", describe: "also dump out an fmap file of codepoint maps")
    .options("bmp", alias: "B", describe: "also write a BMP of the font")
    .options("import", alias: "i", describe: "import font from an existing PSF file")
    .options("o", describe: "output file")
    .options("map", describe: "comma-separated list of unicode ranges for PSF files", default: "0-")
    .boolean([ "monospace", "ascii", "header", "psf", "fmap", "import" ])

  options = yargs.argv
  filenames = options._
  if filenames.length < 1
    yargs.showHelp()
    process.exit 1
  # PSF files must be monospace.
  if options.psf? then options.monospace = true
  generator = parseRanges(options.map)
  for filename in filenames
    name = path.basename(filename, path.extname(filename)).replace(/[^\w]/g, "_")
    outname = options.o
    font = if options.import
      psf.read(fs.readFileSync(filename))
    else
      decodeFont(bmp.readBmp(filename), options.monospace, generator)
    if options.ascii
      for line in font.dumpToAscii(if process.stdout.isTTY then process.stdout.columns else 80) then console.log line
    if options.header
      if not outname? then outname = replaceExtension(filename, "h")
      fs.writeFileSync(outname, generateHeaderFile(font, name))
      console.log "Wrote header: #{outname}"
    if options.psf
      if not outname? then outname = replaceExtension(filename, "psf")
      fs.writeFileSync(outname, psf.write(font, true))
      console.log "Wrote PSF: #{outname}"
    if options.fmap
      if not outname? then outname = filename
      outname = replaceExtension(outname, "fmap")
      data = font.charsDefined().map((ch) -> sprintf("x%x", ch)).join("\n") + "\n"
      fs.writeFileSync(outname, data)
      console.log "Wrote fmap: #{outname}"
    if options.bmp
      if not outname? then outname = filename
      outname = replaceExtension(outname, "bmp")
      cellWidth = font.cellWidth(font.charsDefined()[0])
      framebuffer = new bmp.Framebuffer(null, cellWidth * 32, font.cellHeight * 8, 24)
      for ch, i in font.charsDefined()
        font.drawToFramebuffer(ch, framebuffer, (i % 32) * cellWidth, Math.floor(i / 32) * font.cellHeight, 0xffffff, 0)
      data = bmp.writeBmp(framebuffer)
      fs.writeFileSync(outname, data)
      console.log "Wrote bmp: #{outname}"

parseRanges = (s) ->
  if fs.existsSync(s)
    # it's a file!
    s = fs.readFileSync(s).toString().trim().split("\n").join(",")
  blocks = s.split(",").map (range) ->
    m = range.trim().match(/(x[\da-f]+|\d+)(\-(x[\da-f]+|\d+)?)?/)
    start = parsePossibleHex(m[1])
    end = if m[3]? then parsePossibleHex(m[3]) else start
    { start, end }
  # return a function that generates unicode ranges
  nextUp = blocks[0].start
  ->
    rv = nextUp
    nextUp += 1
    if blocks.length > 1 and nextUp > blocks[0].end
      blocks.shift()
      nextUp = blocks[0].start
    rv

parsePossibleHex = (s) ->
  if s[0] == "x" then parseInt(s[1...], 16) else parseInt(s)

replaceExtension = (filename, newExtension) ->
  ext = path.extname(filename)
  path.join(path.dirname(filename), path.basename(filename, ext)) + "." + newExtension

decodeFont = (framebuffer, isMonospace, generator) ->
  [ cellWidth, cellHeight ] = sniffBoundaries(framebuffer)
  console.log "Assuming cell dimensions #{cellWidth} x #{cellHeight}"
  charRows = framebuffer.height / cellHeight
  charColumns = framebuffer.width / cellWidth
  font = new bitmap_font.BitmapFont(isMonospace)
  for y in [0 ... charRows]
    for x in [0 ... charColumns]
      font.getFromFramebuffer(generator(), framebuffer, x * cellWidth, y * cellHeight, cellWidth, cellHeight)
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

exports.main = main
