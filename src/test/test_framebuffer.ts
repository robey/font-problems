import { Framebuffer } from "../framebuffer";

import "should";
import "source-map-support/register";

describe("Framebuffer", () => {
  it("reads and writes pixels", () => {
    const f = new Framebuffer(3, 2, 32);
    f.pixels.length.should.eql(6);
    f.setPixel(0, 0, 0xff0088);
    f.setPixel(1, 1, 0xcc9933);
    f.setPixel(2, 0, 0x182838);
    f.getPixel(0, 0).should.eql(0xff0088);
    f.getPixel(1, 1).should.eql(0xcc9933);
    f.getPixel(2, 0).should.eql(0x182838);
  });

  it("computes average brightness", () => {
    const f = new Framebuffer(2, 2, 32);
    f.averageBrightness().should.eql(0);
    f.setPixel(0, 0, 0xffffff);
    f.averageBrightness().should.be.greaterThan(63);
    f.setPixel(1, 1, 0xffffff);
    f.averageBrightness().should.be.greaterThan(127);
    f.setPixel(0, 0, 0x808080);
    f.setPixel(1, 1, 0x808080);
    f.averageBrightness().should.be.approximately(64, 0.1);
  });

  it("detects on/off pixels", () => {
    const f = new Framebuffer(1, 1, 32);
    f.isOn(0, 0).should.eql(false);
    f.setPixel(0, 0, 0x00bb00);
    f.isOn(0, 0).should.eql(true);
    f.setPixel(0, 0, 0x0000ff);
    f.isOn(0, 0).should.eql(false);
  });

  it("walk", () => {
    const f = new Framebuffer(10, 10, 24);
    const seen = new Uint8Array(100);
    f.walk((x, y, pixel) => {
      seen[y * 10 + x]++;
      return x > 2 && x < 7 && y > 2 && y < 7;
    }, 5, 5);
    Array.from(seen).map(n => (n == 1) ? "*" : ".").join("").should.eql(
      ".........." +
      ".........." +
      "...****..." +
      "..******.." +
      "..******.." +
      "..******.." +
      "..******.." +
      "...****..." +
      ".........." +
      ".........."
    );
  });

  it("view & fill", () => {
    const f = new Framebuffer(10, 10, 24);
    f.view(4, 4, 8, 8).fill(0xffffff);
    Array.from(f.pixels).map(n => (n > 0) ? "*" : ".").join("").should.eql(
      ".........." +
      ".........." +
      ".........." +
      ".........." +
      "....****.." +
      "....****.." +
      "....****.." +
      "....****.." +
      ".........." +
      ".........."
    );
  });
});
