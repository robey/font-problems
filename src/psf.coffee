bitmap_font = require "./bitmap_font"

# PSF is a small bitmap font format originally used for PC DOS, and now the
# Linux console. It supports exactly 256 or 512 glyphs, with an optional
# table to map glyphs to unicode code points. The files are never more than
# a few kilobytes, so we just read/write them to/from buffers.

PSF_MAGIC = 0x72b54a86
PSF_VERSION = 0
PSF_HEADER_SIZE = 32
PSF_FLAG_HAS_UNICODE_TABLE = 0x01
PSF_UNICODE_SEPARATOR = 0xff
PSF_UNICODE_STARTSEQ = 0xfe

write = (font, withMap = false) ->
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

read = (buffer) ->
  magic = buffer.readUInt32BE(0)
  if magic != PSF_MAGIC
    throw new Error("Not a PSF file")
  version = buffer.readUInt32LE(4)
  headerSize = buffer.readUInt32LE(8)
  flags = buffer.readUInt32LE(12)
  chars = buffer.readUInt32LE(16)
  charsize = buffer.readUInt32LE(20)
  cellHeight = buffer.readUInt32LE(24)
  cellWidth = buffer.readUInt32LE(28)
  if version != PSF_VERSION or headerSize != PSF_HEADER_SIZE
    throw new Error("Unable to parse PSF version #{version}, header size #{headerSize}")
  rowsize = Math.ceil(cellWidth / 8)
  if rowsize > 2 then throw new Error("I don't support such wide glyphs yet (max 16 pixels)")
  console.log "Importing PSF: #{chars} chars, #{cellWidth}x#{cellHeight} #{if flags & PSF_FLAG_HAS_UNICODE_TABLE > 0 then "(unicode)" else ""}"
  font = new bitmap_font.BitmapFont(true)
  cells = [0 ... chars].map (i) ->
    buf = buffer.slice(headerSize + i * charsize, headerSize + (i + 1) * charsize)
    rows = [0 ... cellHeight].map (y) ->
      row = if rowsize == 2 then buf.readUInt16BE(y * rowsize) else buf.readUInt8(y * rowsize)
    bitmap_font.unpackRows(rows, cellWidth, bitmap_font.BE)
  codePoints = if flags & PSF_FLAG_HAS_UNICODE_TABLE == 0
    [0 ... chars]
  else
    mapIndex = headerSize + chars * charsize
    [0 ... chars].map (i) ->
      index = mapIndex
      loop
        b = buffer.readUInt8(index)
        break if b == PSF_UNICODE_SEPARATOR || b == PSF_UNICODE_STARTSEQ
        index += 1
      ch = buffer.slice(mapIndex, index).toString("UTF-8").charCodeAt(0)
      loop
        b = buffer.readUInt8(index)
        break if b == PSF_UNICODE_SEPARATOR
        index += 1
      mapIndex = index + 1
      ch
  for i in [0 ... chars]
    font.add codePoints[i], cells[i]
  font

utf8 = (n) -> new Buffer(String.fromCharCode(n), "UTF-8")

exports.read = read
exports.write = write
