# What is a ".psfmap" file?

Ideally, each glyph in a font should have a set of unicode code-points that map to it. For example, the glyph for "A" should map at least U+0041 (Latin capital A from ASCII), and if you're polite, also U+0391 (Greek capital alpha) and U+0410 (Cyrillic capital A).

By default, every glyph is assumed to map to its index, so a 256-glyph font will map to code-points 0 through 255. This matches font behavior of the late 20th century, when every font was expected to use the first 128 glyphs for ASCII and the next 128 glyphs for one of the "high bit encodings" like IBM PC, or the various Latin-N tables.

A ".psfmap" file is a text file that describes a mapping from glyphs to unicode code points if this default mapping isn't sufficient. The mapping is used when writing to a file format that supports it (most of them).

## Format

Blank lines and comment lines (starting with "#") are ignored. Every remaining line should be a mapping from one glyph (by index) to a set of unicode code-points, or a mapping from a range of glyph indexes to an equal-length unicode range.

    line ::= index ":" (range | sequence)
    range ::= codepoint "-" codepoint
    sequence ::= codepoint ("," codepoint)*
    index ::= <hex>
    codepoint ::= <hex>

Whitespace is allowed around every separator (":", ",", "-", "\n").

An index can be used on multiple lines, to add more codepoints to a glyph.

Any index that's not listed will be omitted from the font.

For example, to map the ASCII printable range from space (0x20) to squiggle (0x7e) starting at the first glyph in the file:

    0: 20 - 7e

To go back and add the other two A's (mentioned above) to glyph 21 (currently mapped to 41):

    21: 410, 391

If there was a 96th glyph (5f) in the input file, it well be omitted because it has no mapping.

## Caveats

Apparently some font renderers will assume that glyphs 0x20 through 0x7e in a PSF file are their equivalent ASCII code-point, no matter what the mapping says. So you should probably leave those in place and put non-ASCII symbols before and after.
