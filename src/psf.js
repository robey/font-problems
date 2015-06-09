"use strict";

const bitmap_font = require("./bitmap_font");
const unicodes = require("./unicodes");

/*
 * PSF is a small bitmap font format originally used for PC DOS, and now the
 * Linux console. It supports exactly 256 or 512 glyphs, with an optional
 * table to map glyphs to unicode code points. The files are never more than
 * a few kilobytes, so we just read/write them to/from buffers.
 */

const PSF_MAGIC = 0x72b54a86;
const PSF_VERSION = 0;
const PSF_HEADER_SIZE = 32;
const PSF_FLAG_HAS_UNICODE_TABLE = 0x01;
const PSF_UNICODE_SEPARATOR = 0xff;
const PSF_UNICODE_STARTSEQ = 0xfe;

const PSF1_MAGIC = 0x3604;
const PSF1_MODE512 = 0x01;
const PSF1_MODEHASTAB = 0x02;
const PSF1_UNICODE_SEPARATOR = 0xffff;
const PSF1_UNICODE_STARTSEQ = 0xfffe;

function write(font, options = { withMap: false }) {
  const chars = font.charsDefined();
  if (chars.length != 256 && chars.length != 512) {
    throw new Error(`PSF appears to support only 256 or 512 characters, not ${chars.length}`);
  }
  // PSF files are monospace, so all chars have the same width.
  const cellWidth = font.cellWidth(chars[0]);
  const rowsize = Math.ceil(cellWidth / 8);
  if (rowsize > 2) throw new Error("I don't support such wide glyphs yet (max 16 pixels)");
  const charsize = font.cellHeight * rowsize;
  const header = new Buffer(PSF_HEADER_SIZE);
  header.writeUInt32BE(PSF_MAGIC, 0);
  header.writeUInt32LE(PSF_VERSION, 4);
  header.writeUInt32LE(PSF_HEADER_SIZE, 8);
  header.writeUInt32LE(options.withMap ? PSF_FLAG_HAS_UNICODE_TABLE : 0, 12); // flags
  header.writeUInt32LE(chars.length, 16);
  header.writeUInt32LE(charsize, 20);
  header.writeUInt32LE(font.cellHeight, 24);
  header.writeUInt32LE(cellWidth, 28);
  // now write glyph data and unicode data
  const data = new Buffer(chars.length * charsize);
  const mapData = new Buffer(chars.length * 5);
  let i = 0;
  let mi = 0;
  const table = font.packIntoRows(bitmap_font.BE);
  for (let char in table) {
    table[char].forEach(row => {
      if (rowsize > 1) {
        data.writeUInt8((row >> 8) & 0xff, i);
        i += 1;
      }
      data.writeUInt8(row & 0xff, i);
      i += 1;
    });
    if (options.withMap) {
      const ch = utf8(char);
      ch.copy(mapData, mi);
      mi += ch.length;
      mapData.writeUInt8(PSF_UNICODE_SEPARATOR, mi);
      mi += 1;
    }
  }
  return Buffer.concat([ header, data, mapData.slice(0, mi) ]);
}

function read(buffer) {
  const magic = buffer.readUInt32BE(0);
  if (magic != PSF_MAGIC) {
    if (magic >> 16 == PSF1_MAGIC) return readVersion1(buffer);
    throw new Error("Not a PSF file");
  }
  const version = buffer.readUInt32LE(4);
  const headerSize = buffer.readUInt32LE(8);
  const flags = buffer.readUInt32LE(12);
  const chars = buffer.readUInt32LE(16);
  const charsize = buffer.readUInt32LE(20);
  const cellHeight = buffer.readUInt32LE(24);
  const cellWidth = buffer.readUInt32LE(28);
  if (version != PSF_VERSION || headerSize != PSF_HEADER_SIZE) {
    throw new Error(`Unable to parse PSF version ${version}, header size ${headerSize}`);
  }
  const rowsize = Math.ceil(cellWidth / 8);
  if (rowsize > 2) throw new Error("I don't support such wide glyphs yet (max 16 pixels)");

  const font = new bitmap_font.BitmapFont(true);
  const generator = (flags & PSF_FLAG_HAS_UNICODE_TABLE > 0) ?
    readUnicodeTable(buffer, headerSize + chars * charsize, chars) :
    unicodes.from(0);

  for (let i = 0; i < chars; i++) {
    const buf = buffer.slice(headerSize + i * charsize, headerSize + (i + 1) * charsize);
    const rows = [];
    for (let y = 0; y < cellHeight; y++) {
      rows.push(rowsize == 2 ? buf.readUInt16BE(y * rowsize) : buf.readUInt8(y * rowsize));
    }
    font.unpackRows(generator(), rows, cellWidth, cellHeight, bitmap_font.BE);
  }

  return font;
}

function readVersion1(buffer) {
  const mode = buffer[2];
  const charsize = buffer[3];
  const chars = (mode & PSF1_MODE512 > 0) ? 512 : 256;
  const generator = (mode & PSF1_MODEHASTAB > 0) ?
    readUnicodeTable1(buffer, 4 + chars * charsize, chars) :
    unicodes.from(0);

  const font = new bitmap_font.BitmapFont(true);
  for (let i = 0; i < chars; i++) {
    const buf = buffer.slice(4 + i * charsize, 4 + (i + 1) * charsize);
    const rows = [];
    for (let y = 0; y < charsize; y++) {
      rows.push(buf[y]);
    }
    font.unpackRows(generator(), rows, 8, charsize, bitmap_font.BE);
  }

  return font;
}

function readUnicodeTable(buffer, offset, charCount) {
  const charmap = [];
  for (let i = 0; i < charCount; i++) {
    let index = offset;
    while (true) {
      const b = buffer.readUInt8(index);
      if (b == PSF_UNICODE_SEPARATOR || b == PSF_UNICODE_STARTSEQ) break;
      index += 1;
    }
    const ch = buffer.slice(offset, index).toString("UTF-8").charCodeAt(0);
    while (true) {
      const b = buffer.readUInt8(index);
      if (b == PSF_UNICODE_SEPARATOR) break;
      index += 1;
    }
    offset = index + 1;
    charmap.push(ch);
  }
  return unicodes.fromArray(charmap);
}

function readUnicodeTable1(buffer, offset, charCount) {
  const charmap = [];
  for (let i = 0; i < charCount; i++) {
    let index = offset;
    while (true) {
      const b = buffer.readUInt16LE(index);
      if (b == PSF1_UNICODE_SEPARATOR || b == PSF1_UNICODE_STARTSEQ) break;
      index += 2;
    }
    const ch = buffer.readUInt16LE(index);
    while (true) {
      const b = buffer.readUInt16LE(index);
      if (b == PSF1_UNICODE_SEPARATOR) break;
      index += 2;
    }
    offest = index + 2;
    charmap.push(ch);
  }
  return unicodes.fromArray(charmap);
}

function utf8(n) {
  return new Buffer(String.fromCharCode(n), "UTF-8");
}


exports.read = read
exports.write = write
