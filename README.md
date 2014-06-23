font-problems
=============

This is a node.js-based command-line tool for generating font files in either C header format (suitable for hacking on hardware projects) or PSF files (suitable for the Linux framebuffer console).

It expects the fonts to be painted into a grid in a BMP file, and will detect the grid dimensions by the whitespace between letters. Some example BMP files are in the `fonts/` folder.

## Header files

"Header file" format is a C header file describing the character height, the glyph cell data, and a table of offsets. All glyphs must be the same height, but they can be different widths (proportional fonts). The glyph data for character N starts at `offset[N]` (inclusive) and goes through `offset[N + 1]` (exclusive).

Each int is a single column of pixels, with the LSB at the top. The columns are listed left-to-right. Having the LSB at the top may seem weird, but it allows for fast decoding if you draw top-to-bottom: each pixel can mask off the lowest bit and then shift right one place.

## PSF files

PSF file format is described here: http://www.win.tue.nl/~aeb/linux/kbd/font-formats-1.html

Each glyph must be the same width and height in a PSF file (monospace), and exactly 256 or 512 characters must be defined. BIOS only supports a glyph width of 8, so only framebuffers can use smaller widths. (Linux still uses BIOS to draw text in a surprising number of cases.)

Font-problems will generate a simple unicode mapping table for PSF files, which you can specify with "--map". In the future, this should probably also accept a json file.

## Sample fonts

Two sample fonts are included:

- "Tom Thumb" from [my blog](http://robey.lag.net/2010/01/23/tiny-monospace-font.html), with some line-drawing and block characters added, for console tools like Midnight Commander. Each cell is 4x6, which I believe is the smallest a bitmap font can be, and still have any legibility.

- "Lola" is a simple proportional font, 8 pixels tall, with up to 6 pixels width. It was designed to work on LED matrix displays like [this one](https://learn.adafruit.com/32x16-32x32-rgb-led-matrix).

Both fonts are licensed as Creative Commons "share & adapt": http://creativecommons.org/licenses/by/4.0/ -- I'd also love to see any modifications or additions, to possibly merge them back in.
