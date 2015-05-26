"use strict";

const framebuffer = require("../../lib/framebuffer");
const util = require("util");

require("should");
require("source-map-support").install();

describe("Framebuffer", () => {
  it("reads and writes pixels", () => {
    let f = new framebuffer.Framebuffer(3, 2, 32);
    f.pixels.length.should.eql(6);
    f.buffer.byteLength.should.eql(24);
    f.putPixel(0, 0, 0xff0088);
    f.putPixel(1, 1, 0xcc9933);
    f.putPixel(2, 0, 0x182838);
    f.getPixel(0, 0).should.eql(0xff0088);
    f.getPixel(1, 1).should.eql(0xcc9933);
    f.getPixel(2, 0).should.eql(0x182838);
  });

  it("computes average brightness", () => {
    let f = new framebuffer.Framebuffer(2, 2, 32);
    f.averageBrightness(0, 0, 2, 2).should.eql(0);
    f.putPixel(0, 0, 0xffffff);
    f.averageBrightness(0, 0, 2, 2).should.be.greaterThan(63);
    f.putPixel(1, 1, 0xffffff);
    f.averageBrightness(0, 0, 2, 2).should.be.greaterThan(127);
    f.putPixel(0, 0, 0x808080);
    f.putPixel(1, 1, 0x808080);
    f.averageBrightness(0, 0, 2, 2).should.be.approximately(64, 0.1);
  });

  it("detects on/off pixels", () => {
    let f = new framebuffer.Framebuffer(1, 1, 32);
    f.isOn(0, 0).should.eql(false);
    f.putPixel(0, 0, 0x00bb00);
    f.isOn(0, 0).should.eql(true);
    f.putPixel(0, 0, 0x0000ff);
    f.isOn(0, 0).should.eql(false);
  });
});
