import { range } from "./arrays";
import { BitmapFont } from "./bitmap_font";
import { defaultCodemap } from "./codemap";
import { BitDirection, Glyph } from "./glyph";

/*
 * PSF is a small bitmap font format originally used for PC DOS, and now the
 * Linux console. It supports exactly 256 or 512 glyphs, with an optional
 * table to map glyphs to unicode code points. The files are never more than
 * a few kilobytes, so we just read/write them to/from buffers.
 *
 * the only spec i can find is: http://www.win.tue.nl/~aeb/linux/kbd/font-formats-1.html
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

export interface PsfOptions {
  withMap?: boolean;
}

export function writePsf(font: BitmapFont, options: PsfOptions = {}): Buffer {
  const withMap = options.withMap || false;
  font.removeDead();

  // PSF files are monospace, so all chars have the same width.
  const cellWidth = font.maxCellWidth();
  const rowsize = Math.ceil(cellWidth / 8);
  if (rowsize > 2) throw new Error("I don't support such wide glyphs yet (max 16 pixels)");
  const glyphSize = font.cellHeight * rowsize;
  const header = Buffer.alloc(PSF_HEADER_SIZE);
  header.writeUInt32BE(PSF_MAGIC, 0);
  header.writeUInt32LE(PSF_VERSION, 4);
  header.writeUInt32LE(PSF_HEADER_SIZE, 8);
  header.writeUInt32LE(options.withMap ? PSF_FLAG_HAS_UNICODE_TABLE : 0, 12); // flags
  header.writeUInt32LE(font.glyphs.length, 16);
  header.writeUInt32LE(glyphSize, 20);
  header.writeUInt32LE(font.cellHeight, 24);
  header.writeUInt32LE(cellWidth, 28);

  // worst-case map size
  const mapSize = font.codemap.reduce((sum, codepoints) => sum + codepoints.length * 4, 0);
  // now write glyph data and unicode data.
  const data = Buffer.alloc(font.glyphs.length * glyphSize);
  const mapData = Buffer.alloc(mapSize);

  let index = 0;
  let mapIndex = 0;
  font.glyphs.forEach((glyph, i) => {
    glyph.packIntoRows(BitDirection.BE).forEach(row => {
      if (rowsize > 1) {
        data.writeUInt8((row >> 8) & 0xff, index);
        index += 1;
      }
      data.writeUInt8(row & 0xff, index);
      index += 1;
    });

    if (withMap) {
      font.codemap[i].forEach(codepoint => {
        const b = Buffer.from(String.fromCodePoint(codepoint), "UTF-8");
        b.copy(mapData, mapIndex);
        mapIndex += b.length;
      });
      mapData[mapIndex] = PSF_UNICODE_SEPARATOR;
      mapIndex++;
    }
  });
  return Buffer.concat([ header, data, mapData.slice(0, mapIndex) ]);
}

export function readPsf(buffer: Buffer): BitmapFont {
  const magic = buffer.readUInt32BE(0);
  if (magic != PSF_MAGIC) {
    if (magic >> 16 == PSF1_MAGIC) return readVersion1(buffer);
    throw new Error("Not a PSF file");
  }

  const version = buffer.readUInt32LE(4);
  const headerSize = buffer.readUInt32LE(8);
  const flags = buffer.readUInt32LE(12);
  const glyphCount = buffer.readUInt32LE(16);
  const glyphSize = buffer.readUInt32LE(20);
  const cellHeight = buffer.readUInt32LE(24);
  const cellWidth = buffer.readUInt32LE(28);
  if (version != PSF_VERSION || headerSize != PSF_HEADER_SIZE) {
    throw new Error(`Unable to parse PSF version ${version}, header size ${headerSize}`);
  }
  const rowsize = Math.ceil(cellWidth / 8);
  if (rowsize > 2) throw new Error("I don't support such wide glyphs yet (max 16 pixels)");

  const font = new BitmapFont(true);
  const codemap: number[][] = (flags & PSF_FLAG_HAS_UNICODE_TABLE) > 0 ?
    readUnicodeTable(new Position(buffer, headerSize + glyphCount * glyphSize), glyphCount, true) :
    defaultCodemap(glyphCount);

  let index = headerSize;
  for (let i = 0; i < glyphCount; i++) {
    const rows = range(0, cellHeight).map(y => {
      return rowsize == 2 ? buffer.readUInt16BE(index + y * rowsize) : buffer.readUInt8(index + y * rowsize);
    });
    const glyph = Glyph.fromRows(rows, cellWidth, BitDirection.BE);
    font.add(glyph, codemap[i]);
    index += glyphSize;
  }

  return font;
}

function readVersion1(buffer: Buffer): BitmapFont {
  const mode = buffer[2];
  const glyphSize = buffer[3];
  const glyphCount = (mode & PSF1_MODE512) > 0 ? 512 : 256;

  const font = new BitmapFont(true);
  const codemap: number[][] = (mode & PSF1_MODEHASTAB) > 0 ?
    readUnicodeTable(new Position(buffer, 4 + glyphCount * glyphSize), glyphCount, false) :
    defaultCodemap(glyphCount);

  let index = 4;
  for (let i = 0; i < glyphCount; i++) {
    const glyph = Glyph.fromRows(Array.from(buffer.slice(index, index + glyphSize)), 8, BitDirection.BE);
    font.add(glyph, codemap[i]);
    index += glyphSize;
  }

  return font;
}


class Position {
  constructor(public buffer: Buffer, public index: number) {
    // pass
  }
}

function readUnicodeTable(pos: Position, count: number, utf8: boolean): number[][] {
  return range(0, count).map(i => {
    // each glyph has a sequence of code points, optionally followed by a
    // sequence of (STARTSEQ codepoint*), followed by SEPARATOR.
    const points: number[] = [];
    let inSeq = false;

    while (true) {
      const cp = readCodepoint(pos, utf8);
      if (cp == PSF1_UNICODE_SEPARATOR) break;
      if (inSeq) {
        // ignore sequences, nobody uses them and they're broken
      } else if (cp == PSF1_UNICODE_STARTSEQ) {
        inSeq = true;
      } else {
        points.push(cp);
      }
    }
    return points;
  });
}

function readCodepoint(pos: Position, utf8: boolean): number {
  if (utf8) {
    const b = pos.buffer.readUInt8(pos.index);
    pos.index++;
    if (b < 128) return b;
    if (b == PSF_UNICODE_SEPARATOR) return PSF1_UNICODE_SEPARATOR;
    if (b == PSF_UNICODE_STARTSEQ) return PSF1_UNICODE_STARTSEQ;

    let codepoint = 0;
    if ((b & 0xe0) == 0xc0) {
      codepoint = ((b & 0x1f) << 6) | (pos.buffer.readUInt8(pos.index) & 0x3f);
      pos.index += 1;
    } else if ((b & 0xf0) == 0xe0) {
      codepoint = ((b & 0x1f) << 12) | ((pos.buffer.readUInt8(pos.index) & 0x3f) << 6) |
        (pos.buffer.readUInt8(pos.index + 1) & 0x3f);
      pos.index += 2;
    } else if ((b & 0xf8) == 0xf0) {
      codepoint = ((b & 0x1f) << 18) | ((pos.buffer.readUInt8(pos.index) & 0x3f) << 12) |
        ((pos.buffer.readUInt8(pos.index + 1) & 0x3f) << 6) |
        (pos.buffer.readUInt8(pos.index + 2) & 0x3f);
      pos.index += 3;
    }
    return codepoint;
  } else {
    // utf16-LE
    const codepoint = pos.buffer.readUInt16LE(pos.index);
    pos.index += 2;
    return codepoint;
  }
}
