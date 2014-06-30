fs = require "fs"

BMP_HEADER = [ 0x42, 0x4d ]
HEADER_SIZE = 14

# read a BMP file into a framebuffer
readBmp = (filename) ->
  data = fs.readFileSync(filename)
  if data[0] != BMP_HEADER[0] or data[1] != BMP_HEADER[1]
    throw new Error("Not a BMP file: #{filename}")

  dataOffset = data.readUInt32LE(10)
  pixelWidth = data.readInt32LE(HEADER_SIZE + 4)
  pixelHeight = data.readInt32LE(HEADER_SIZE + 8)
  topToBottom = false
  if pixelHeight < 0
    topToBottom = true
    pixelHeight = -pixelHeight
  colorDepth = data.readUInt16LE(HEADER_SIZE + 14)

  if colorDepth != 32 and colorDepth != 24
    throw new Error("I'm out of my depth.")

  pixels = []
  offset = dataOffset
  for y in [0 ... pixelHeight]
    rowOffset = offset
    row = []
    pixels.push row
    for x in [0 ... pixelWidth]
      pixel = switch colorDepth
        when 32 then data.readUInt32LE(offset)
        when 24 then data.readUInt16LE(offset) | (data.readUInt8(offset + 2) << 16)
      row.push pixel
      offset += colorDepth / 8
    dangle = (offset - rowOffset) % 4
    offset += if dangle > 0 then 4 - dangle else 0

  if not topToBottom then pixels = pixels.reverse()
  new Framebuffer(pixels, pixelWidth, pixelHeight, colorDepth)

writeBmp = (framebuffer) ->
  header = new Buffer(54)
  header.writeUInt8(BMP_HEADER[0], 0)
  header.writeUInt8(BMP_HEADER[1], 1)
  header.writeUInt32LE(54, 10) # offset of actual data
  header.writeUInt32LE(40, 14) # size of 2nd header
  header.writeUInt32LE(framebuffer.width, 18)
  header.writeUInt32LE(framebuffer.height, 22)
  header.writeUInt16LE(1, 26)  # "color planes"
  header.writeUInt16LE(framebuffer.depth, 28)
  header.writeUInt32LE(0, 30)  # no compression
  header.writeUInt32LE(0, 34)  # no size hint
  header.writeUInt32LE(300, 38)  # pixels per meter?
  header.writeUInt32LE(300, 42)  # pixels per meter?
  header.writeUInt32LE(0, 46)  # palette color count
  header.writeUInt32LE(0, 50)  # "important" color count
  rows = [0 ... framebuffer.height].map (y) ->
    buffer = new Buffer(Math.ceil(framebuffer.depth * framebuffer.width / 32) * 4)
    offset = 0
    for x in [0 ... framebuffer.width]
      pixel = framebuffer.getPixel(x, y)
      switch framebuffer.depth
        when 32 then buffer.writeUInt32LE(pixel, offset)
        when 24
          buffer.writeUInt16LE(pixel & 0xffff, offset)
          buffer.writeUInt8((pixel >> 16) & 0xff, offset + 2)
      offset += framebuffer.depth / 8
    buffer
  Buffer.concat([ header ].concat(rows.reverse()))

class Framebuffer
  # pixels are in [y][x] order, top to bottom, left to right
  constructor: (@pixels, @width, @height, @depth) ->
    if not @pixels? then @pixels = [0 ... @height].map (y) -> ([0 ... @width].map (x) -> 0)

  toGray: (x, y) ->
    # 0.21 R + 0.72 G + 0.07 B
    pixel = @pixels[y][x]
    0.21 * ((pixel >> 16) & 0xff) + 0.72 * ((pixel >> 8) & 0xff) + 0.07 * (pixel & 0xff)

  isOn: (x, y) -> @toGray(x, y) >= 0.5

  # for an (x1, y1) inclusive -> (x2, y2) exclusive box, what is the average
  # brightness of all the pixels?
  averageBrightness: (x1, y1, x2, y2) ->
    count = 0
    brightness = 0
    for y in [y1 ... y2]
      for x in [x1 ... x2]
        count += 1
        brightness += @toGray(x, y)
    brightness / count

  putPixel: (x, y, color) ->
    @pixels[y][x] = color

  getPixel: (x, y) ->
    @pixels[y][x]


exports.Framebuffer = Framebuffer
exports.readBmp = readBmp
exports.writeBmp = writeBmp
