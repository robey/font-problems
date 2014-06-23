sprintf = require "sprintf"
util = require "util"

LE = "little-endian"
BE = "big-endian"

# representation of a bitmap font.
# each glyph is a 2D array of [y][x] to 1 or 0 (on or off) -- very simple.
# x, y are left to right, top to bottom.
# characters are indexed by unicode index (int), for example "A" is 65.
class BitmapFont
  constructor: (@isMonospace = false) ->
    @chars = {}

  # read a character cell out of a framebuffer, given (x, y) offset and
  # width, height.
  # black or dark cells are considered "on".
  getFromFramebuffer: (char, framebuffer, xOffset, yOffset, width, height) ->
    rows = []
    for py in [0 ... height]
      cols = []
      for px in [0 ... width]
        cols.push(if framebuffer.isOn(xOffset + px, yOffset + py) then 0 else 1)
      rows.push cols

    # for proportional fonts, remove redundant empty cols on the right
    if not @isMonospace
      while rows[0].length > 1 and rows.map((row) -> row[row.length - 1]).reduce((a, b) -> a + b) == 0
        rows = rows.map (row) -> row[... row.length - 1]
      # what about "space"? for a proportional font, use 2/3 the total width
      if rows[0].length == 1 and rows.map((row) -> row[row.length - 1]).reduce((a, b) -> a + b) == 0
        rows = [0 ... rows.length].map (i) -> ([0 ... Math.round(width / 2)].map (j) -> 0)

    @chars[char] = rows
    @cellHeight = height

  # pack each glyph into an array of ints, each int as one row.
  # LE = smallest bit on the left
  # BE = smallest bit on the right
  packIntoRows: (direction = LE) ->
    rv = {}
    for char, rows of @chars
      rv[char] = rows.map (row) ->
        line = 0
        for x in [0 ... row.length]
          line = (line << 1) | row[if direction == LE then row.length - x - 1 else x]
        if direction == BE and row.length % 8 != 0
          # pad on the right so the left pixel aligns with a byte boundary!
          line <<= (8 - row.length % 8)
        line
    rv

  # pack each glyph into an array of ints, each int as one column.
  # LE = smallest bit on top
  # BE = smallest bit on bottom
  packIntoColumns: (direction = LE) ->
    rv = {}
    for char, rows of @chars
      rv[char] = [0 ... rows[0].length].map (x) ->
        line = 0
        for y in [0 ... rows.length]
          line = (line << 1) | rows[if direction == LE then rows.length - y - 1 else y][x]
        if direction == BE and rows.length % 8 != 0
          # pad on the bottom so the top pixel aligns with a byte boundary!
          line <<= (8 - rows.length % 8)
        line
    rv

  charsDefined: -> Object.keys(@chars).map((c) -> parseInt(c)).sort((a, b) -> a - b)

  cellWidth: (char) -> @chars[char][0].length

  # returns an array of ascii lines filled with @ or space
  dumpToAscii: (lineWidth = 80) ->
    buffer = [ [] ]
    bufferY = 0
    for char in @charsDefined()
      cell = @chars[char]
      width = cell[0].length
      height = cell.length
      if buffer[bufferY].length + width >= lineWidth
        # new "virtual line"
        bufferY = buffer.length
      for y in [0 ... height]
        if not buffer[bufferY + y]? then buffer[bufferY + y] = []
        for x in [0 ... width]
          buffer[bufferY + y].push(if cell[y][x] == 1 then "@" else " ")
        # space between chars
        if not @isMonospace then buffer[bufferY + y].push " "
      if not buffer[bufferY + height]? then buffer[bufferY + height] = []
      buffer[bufferY + height].push sprintf("%-#{width}x", char)
    buffer.map (line) -> line.join("")

toGray = (pixel) ->
  # 0.21 R + 0.72 G + 0.07 B
  0.21 * ((pixel >> 16) & 0xff) + 0.72 * ((pixel >> 8) & 0xff) + 0.07 * (pixel & 0xff)

isOn = (pixel) -> toGray(pixel) >= 0.5


exports.BE = BE
exports.BitmapFont = BitmapFont
exports.LE = LE
