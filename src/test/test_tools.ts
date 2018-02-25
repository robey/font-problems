import * as fs from "fs";
import { readBmp } from "../bmp";
import { Framebuffer } from "../framebuffer";
import { sniffBoundaries } from "../tools";

import "should";
import "source-map-support/register";

describe("grid", () => {
  it("sniffBoundaries", () => {
    function loadBmp(filename: string): Framebuffer {
      return readBmp(fs.readFileSync(`src/test/data/${filename}`));
    }

    sniffBoundaries(loadBmp("tom-thumb-256.bmp")).should.eql({ width: 4, height: 6 });
    sniffBoundaries(loadBmp("lolathin.bmp")).should.eql({ width: 6, height: 8 });
    sniffBoundaries(loadBmp("lola12.bmp")).should.eql({ width: 6, height: 12 });
  });
});
