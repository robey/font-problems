import { range } from "./arrays";

/*
 * tools for reading/writing the codemap, which maps each glyph to a list
 * of unicode points or sequences.
 */

export function dumpCodemap(codemap: string[][]): string {
  return codemap.map((glyphCode, i) => {
    return i.toString(16) + ": " + glyphCode.map(seq => {
      return Array.from(seq).map(char => (char.codePointAt(0) || 0).toString(16)).join(";");
    }).join(", ");
  }).join("\n") + "\n";
}

// make a default codemap where each glyph maps to one codepoint: its index (0, 1, ...)
export function defaultCodemap(count: number): string[][] {
  return range(0, count).map(n => [ String.fromCharCode(n) ]);
}
