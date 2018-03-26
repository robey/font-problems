# What is a ".psfmap" file?

Ideally, each glyph in a font should have a set of unicode code-points that map to it. For example, the glyph for "A" should map at least U+0041 (Latin capital A from ASCII), and if you're polite, also U+0391 (Greek capital alpha) and U+0410 (Cyrillic capital A).

By default, every glyph is assumed to map to its index, so a 256-glyph font will map to code-points 0 through 255. This matches font behavior of the late 20th century, when every font was expected to use the first 128 glyphs for ASCII and the next 128 glyphs for one of the "high bit encodings" like IBM PC, or the various Latin-N tables.

A ".psfmap" file is a text file that describes a mapping from glyphs to unicode code points if this default mapping isn't sufficient. The mapping can only be read from and written to PSF files.

## Format

To change the starting point of the default range, use `+` and a starting number in hex as the first line in the file:

    +20

This says the font's first glyph is space (U+0020), because it didn't bother to make glyphs for the control character range.

The rest of the map file must be one line per glyph, declaring which unicode code-points map to that glyph.

    lines ::= line ("\n" line)*
    line ::= [index ":"] sequence ("," sequence)*
    sequence ::= codepoint (";" codepoint)*
    index ::= <hex>
    codepoint ::= <hex>

Whitespace is allowed around every separator (";", ":", ",", ".", "\n"). Blank lines and comment lines (starting with "#") are ignored.

If the index is omitted, each line will use the previous line's index plus 1. So if you omit all indexes, the first line will represent the first (0th) glyph, then 1, 2, and so on.

Each "sequence" is one or more code-points (in hex) separated by semicolons. A sequence is usually a "normal" character followed by one or more combining characters, like "e" and "combining accent". I've never seen a font in the wild that uses sequences, so tread lightly here: I suspect most consoles don't support this feature.

For example, here's an entry to set glyph 41 to be the three A's mentioned above:

    41: 41, 410, 391

## Caveats

Apparently some font renderers will assume that glyphs 0x20 through 0x7e are their equivalent ASCII code-point, no matter what the mapping says. So you should probably leave those in place and put non-ASCII symbols before and after.
