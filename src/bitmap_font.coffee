util = require "util"

LE = "little-endian"
BE = "big-endian"

# representation of a bitmap font.
# each glyph is a 2D array of [y][x] to 1 or 0 (on or off) -- very simple.
# x, y are left to right, top to bottom.
# characters are indexed by unicode index (int), for example "A" is 65.
class BitmapFont
  constructor: ->
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
    @chars[char] = rows

  # pack each glyph into an array of ints, each int as one row.
  # LE = smallest bit on the left
  # BE = smallest bit on the right
  packIntoRows: (direction = LE) ->
    rv = {}
    for k, v of @chars
      rows = v.map (row) ->
        line = 0
        for x in [0 ... row.length]
          line = (line << 1) | row[if direction == LE then row.length - x - 1 else x]
        line
      rv[k] = rows
    rv

  charsDefined: -> Object.keys(@chars).map((c) -> parseInt(c)).sort((a, b) -> a - b)

  # returns an array of ascii lines filled with @ or space
  dumpToAscii: (lineWidth = 80) ->
    buffer = [ [] ]
    bufferY = 0
    for char in @charsDefined()
      cell = @chars[char]
      width = cell[0].length
      height = cell.length
      if buffer[bufferY].length + width > lineWidth
        # new "virtual line"
        bufferY = buffer.length
      for y in [0 ... height]
        if not buffer[bufferY + y]? then buffer[bufferY + y] = []
        for x in [0 ... width]
          buffer[bufferY + y].push(if cell[y][x] == 1 then "@" else " ")
        # space between chars
        buffer[bufferY + y].push " "
    buffer.map (line) -> line.join("")

toGray = (pixel) ->
  # 0.21 R + 0.72 G + 0.07 B
  0.21 * ((pixel >> 16) & 0xff) + 0.72 * ((pixel >> 8) & 0xff) + 0.07 * (pixel & 0xff)

isOn = (pixel) -> toGray(pixel) >= 0.5


exports.BE = BE
exports.BitmapFont = BitmapFont
exports.LE = LE




# # scan a char cell, left to right, bottom to top, so that we have a word for
# # each column (left to right), with the LSB being the top bit.
# decodeFontChar = (framebuffer, x, y, width, height) ->
#   cols = []
#   for px in [0 ... width]
#     ch = 0
#     for py in [0 ... height]
#       pixel = framebuffer[y + height - py - 1][x + px]
#       ch = (ch << 1) | (if (pixel & 0xffffff) == 0 then 1 else 0)
#     cols.push ch
#   # for proportional fonts, remove redundant empty cols on the right
#   while cols.length > 1 and cols[cols.length - 1] == 0 then cols = cols[... cols.length - 1]
#   # what about "space"? for a proportional font, use 2/3 the total width
#   if cols.length == 1 and cols[0] == 0 then cols = (for i in [0 ... Math.round(width / 2)] then 0)
#   cols
