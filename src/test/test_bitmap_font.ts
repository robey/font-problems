import * as fs from "fs";
import { BitmapFont, sniffBoundaries } from "../bitmap_font";
import { readBmp } from "../bmp";
import { Framebuffer } from "../framebuffer";
import { BitDirection, Glyph } from "../glyph";

import "should";
import "source-map-support/register";

const CODE_bang = "!".codePointAt(0) ?? 0;
const CODE_E = "E".codePointAt(0) ?? 0;
const CODE_J = "J".codePointAt(0) ?? 0;
const CODE_M = "M".codePointAt(0) ?? 0;
const CODE_x = "x".codePointAt(0) ?? 0;

describe("BitmapFont", () => {
  const IMAGE = new Framebuffer(8, 8, 24);
  IMAGE.fillData([
    1, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 1, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 1, 0, 0, 0, 0, 0,
    0, 1, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 1,
  ].map(n => n == 1 ? 0 : 0xffffff));

  it("reads a normal cell", () => {
    const font = new BitmapFont();
    font.add(Glyph.fromFramebuffer(IMAGE.view(0, 0, 6, 6), true), [ CODE_x ]);
    font.cellHeight.should.eql(6);
    const glyph = font.glyphs[0];
    if (!glyph) throw new Error("uhhhhh");
    glyph.width.should.eql(6);
    glyph.rawHex.should.eql("0108008400");

    const fb = new Framebuffer(6, 6, 24);
    glyph.draw(fb, 1, 0);
    Array.from(fb.pixels).should.eql([
      1, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 1,
      0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0,
      0, 0, 1, 0, 0, 0,
      0, 1, 0, 0, 0, 0,
    ]);
  });

  it("trims a proportional font", () => {
    const font = new BitmapFont();
    font.add(Glyph.fromFramebuffer(IMAGE.view(0, 0, 5, 6), false), [ CODE_x ]);
    font.cellHeight.should.eql(6);
    const glyph = font.glyphs[0];
    if (!glyph) throw new Error("uhhhhh");
    glyph.width.should.eql(3);

    const fb = new Framebuffer(3, 6, 24);
    glyph.draw(fb, 1, 0);
    Array.from(fb.pixels).should.eql([
      1, 0, 0,
      0, 0, 0,
      0, 0, 0,
      0, 0, 0,
      0, 0, 1,
      0, 1, 0,
    ]);
  });

  it("doesn't trim a monospace font", () => {
    const font = new BitmapFont(true);
    font.add(Glyph.fromFramebuffer(IMAGE.view(0, 0, 3, 3), true), [ CODE_x ]);
    font.cellHeight.should.eql(3);
    const glyph = font.glyphs[0];
    if (!glyph) throw new Error("uhhhhh");
    glyph.width.should.eql(3);

    const fb = new Framebuffer(3, 3, 24);
    glyph.draw(fb, 1, 0);
    Array.from(fb.pixels).should.eql([
      1, 0, 0,
      0, 0, 0,
      0, 0, 0,
    ]);
  });

  it("sniffBoundaries", () => {
    function loadBmp(filename: string): Framebuffer {
      return readBmp(fs.readFileSync(`src/test/data/${filename}`));
    }

    sniffBoundaries(loadBmp("tom-thumb-256.bmp")).should.eql({ width: 4, height: 6 });
    sniffBoundaries(loadBmp("lolathin.bmp")).should.eql({ width: 6, height: 8 });
    sniffBoundaries(loadBmp("lola12.bmp")).should.eql({ width: 6, height: 12 });
  });

  it("loads from a framebuffer", () => {
    const fb = readBmp(fs.readFileSync("src/test/data/lolathin.bmp"));
    const font = BitmapFont.importFromImage(fb, { isMonospace: false });
    font.isMonospace.should.eql(false);
    font.cellHeight.should.eql(8);

    const em = font.glyphs[CODE_M];
    const bang = font.glyphs[CODE_bang];
    if (!em || !bang) throw new Error("uhhhhh");

    em.width.should.eql(5);
    font.glyphs.length.should.eql(128);
    bang.width.should.eql(1);

    const fb2 = new Framebuffer(1, 8, 24);
    bang.draw(fb2, 1, 0);
    Array.from(fb2.pixels).should.eql([ 1, 1, 1, 1, 1, 0, 1, 0 ]);
  });

  it("packs into rows", () => {
    const fb = readBmp(fs.readFileSync("src/test/data/tom-thumb-256.bmp"));
    const font = BitmapFont.importFromImage(fb);
    const ee = font.glyphs[0x45];
    const jay = font.glyphs[0x4a];
    if (!ee || !jay) throw new Error("uhhhhh");

    ee.packIntoRows(BitDirection.LE).should.eql([ 0x7, 0x1, 0x7, 0x1, 0x7, 0 ]);
    jay.packIntoRows(BitDirection.LE).should.eql([ 0x4, 0x4, 0x4, 0x5, 0x2, 0 ]);
    ee.packIntoRows(BitDirection.BE).should.eql([ 0xe0, 0x80, 0xe0, 0x80, 0xe0, 0 ]);
    jay.packIntoRows(BitDirection.BE).should.eql([ 0x20, 0x20, 0x20, 0xa0, 0x40, 0 ]);
  });

  it("packs into columns", () => {
    const fb = readBmp(fs.readFileSync("src/test/data/tom-thumb-256.bmp"));
    const font = BitmapFont.importFromImage(fb);
    const ee = font.glyphs[0x45];
    const jay = font.glyphs[0x4a];
    if (!ee || !jay) throw new Error("uhhhhh");

    ee.packIntoColumns(BitDirection.LE).should.eql([ 0x1f, 0x15, 0x15, 0 ]);
    jay.packIntoColumns(BitDirection.LE).should.eql([ 0x08, 0x10, 0x0f, 0 ]);
    ee.packIntoColumns(BitDirection.BE).should.eql([ 0xf8, 0xa8, 0xa8, 0 ]);
    jay.packIntoColumns(BitDirection.BE).should.eql([ 0x10, 0x08, 0xf0, 0 ]);
  });

  it("addFromRows", () => {
    const font = new BitmapFont(true);
    font.add(Glyph.fromRows([ 0x7, 0x1, 0x7, 0x1, 0x7, 0 ], 4, BitDirection.LE), [ CODE_E ]);
    font.add(Glyph.fromRows([ 0x20, 0x20, 0x20, 0xa0, 0x40, 0 ], 4, BitDirection.BE), [ CODE_J ]);
    const ee = font.find("E");
    const jay = font.find("J");
    if (!ee || !jay) throw new Error("uhhhhh");

    ee.rawHex.should.eql("171707");
    jay.rawHex.should.eql("445402");
  });

  it("addFromColumns", () => {
    const font = new BitmapFont(true);
    font.add(Glyph.fromColumns([ 0x1f, 0x15, 0x15, 0 ], 6, BitDirection.LE), [ CODE_E ]);
    font.add(Glyph.fromColumns([ 0x10, 0x08, 0xf0, 0 ], 6, BitDirection.BE), [ CODE_J ]);

    const ee = font.find("E");
    const jay = font.find("J");
    if (!ee || !jay) throw new Error("uhhhhh");

    ee.rawHex.should.eql("171707");
    jay.rawHex.should.eql("445402");
  });

  it("handle duplicates and split out", () => {
    const font = new BitmapFont(true);
    font.add(Glyph.fromColumns([ 0x1f, 0x15, 0x15, 0 ], 6, BitDirection.LE), [ CODE_E ]);
    font.add(Glyph.fromColumns([ 0x10, 0x08, 0xf0, 0 ], 6, BitDirection.BE), [ CODE_J ]);
    font.add(Glyph.fromColumns([ 0x1f, 0x15, 0x15, 0 ], 6, BitDirection.LE), [ CODE_M ]);

    font.findDuplicates();
    font.glyphs.length.should.eql(2);
    font.codemap.should.eql([ [ CODE_E, CODE_M ], [ CODE_J ] ]);
    (font.find("J")?.rawHex ?? "").should.eql("445402");
    (font.find("E")?.rawHex ?? "").should.eql("171707");
    (font.find("M")?.rawHex ?? "").should.eql("171707");

    font.splitOut();
    font.glyphs.length.should.eql(3);
    font.codemap.should.eql([ [ CODE_E ], [ CODE_J ], [ CODE_M ] ]);
    (font.find("J")?.rawHex ?? "").should.eql("445402");
    (font.find("E")?.rawHex ?? "").should.eql("171707");
    (font.find("M")?.rawHex ?? "").should.eql("171707");
  });
});
