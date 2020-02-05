import { Framebuffer } from "./framebuffer";

const BMP_HEADER = [ 0x42, 0x4d ];
const HEADER_SIZE = 14;

// read a BMP file into a framebuffer
export function readBmp(data: Buffer): Framebuffer {
  if (data[0] != BMP_HEADER[0] || data[1] != BMP_HEADER[1]) {
    throw new Error(`Not a BMP file`);
  }

  const dataOffset = data.readUInt32LE(10);
  const pixelWidth = data.readInt32LE(HEADER_SIZE + 4);
  let pixelHeight = data.readInt32LE(HEADER_SIZE + 8);
  let topToBottom = false;
  if (pixelHeight < 0) {
    topToBottom = true;
    pixelHeight = -pixelHeight;
  }
  const colorDepth = data.readUInt16LE(HEADER_SIZE + 14);

  if (colorDepth != 32 && colorDepth != 24) {
    throw new Error("I'm out of my depth.");
  }

  const fb = new Framebuffer(pixelWidth, pixelHeight, colorDepth);
  let offset = dataOffset;
  for (let y = 0; y < pixelHeight; y++) {
    const rowOffset = offset;
    const py = topToBottom ? y : pixelHeight - y - 1;
    for (let x = 0; x < pixelWidth; x++) {
      switch (colorDepth) {
        case 32:
          fb.setPixel(x, py, data.readUInt32LE(offset));
          offset += 4;
          break;
        case 24:
          fb.setPixel(x, py, data.readUInt16LE(offset) | (data.readUInt8(offset + 2) << 16) | 0xff000000);
          offset += 3;
          break;
      }
    }
    const dangle = (offset - rowOffset) % 4;
    offset += (dangle > 0) ? 4 - dangle : 0;
  }

  return fb;
}

export function writeBmp(framebuffer: Framebuffer): Buffer {
  const header = Buffer.alloc(70);
  header.writeUInt8(BMP_HEADER[0], 0);
  header.writeUInt8(BMP_HEADER[1], 1);
  header.writeUInt32LE(0, 6);
  header.writeUInt32LE(header.length, 10); // offset of actual data
  header.writeUInt32LE(56, 14); // size of 2nd header
  header.writeUInt32LE(framebuffer.width, 18);
  header.writeUInt32LE(framebuffer.height, 22);
  header.writeUInt16LE(1, 26);  // "color planes"
  header.writeUInt16LE(framebuffer.colorDepth, 28);
  header.writeUInt32LE(0, 30);  // no compression
  header.writeUInt32LE(0, 34);  // no size hint
  header.writeUInt32LE(0, 38);  // pixels per meter?
  header.writeUInt32LE(0, 42);  // pixels per meter?
  header.writeUInt32LE(0, 46);  // palette color count
  header.writeUInt32LE(0, 50);  // "important" color count

  // alpha channel crap:
  header.writeUInt32LE(0x00ff0000, 54);  // red
  header.writeUInt32LE(0x0000ff00, 58);  // green
  header.writeUInt32LE(0x000000ff, 62);  // blue
  header.writeUInt32LE(0xff000000, 66);  // alpha

  const rows: Buffer[] = [];
  for (let y = 0; y < framebuffer.height; y++) {
    const buffer = Buffer.alloc(Math.ceil(framebuffer.colorDepth * framebuffer.width / 32) * 4);
    buffer.fill(0);
    let offset = 0;
    for (let x = 0; x < framebuffer.width; x++) {
      const pixel = framebuffer.getPixel(x, y);
      switch (framebuffer.colorDepth) {
        case 32:
          buffer.writeUInt32LE(pixel, offset);
          break;
        case 24:
          buffer.writeUInt16LE(pixel & 0xffff, offset);
          buffer.writeUInt8((pixel >> 16) & 0xff, offset + 2);
          break;
      }
      offset += framebuffer.colorDepth / 8;
    }
    rows.push(buffer);
  }

  header.writeUInt32LE(header.length + rows.map(row => row.length).reduce((a, b) => a + b), 2);
  return Buffer.concat([ header ].concat(rows.reverse()));
}
