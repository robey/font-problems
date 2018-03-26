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
export function defaultCodemap(count: number, start: number = 0): string[][] {
  return range(0, count).map(n => [ String.fromCharCode(start + n) ]);
}

/*
 * lines ::= line ("\n" line)*
 * line ::= [index ":"] sequence ("," sequence)*
 * sequence ::= codepoint (";" codepoint)*
 * index ::= <hex>
 * codepoint ::= <hex>
 */
export function parseCodemap(count: number, description: string): string[][] {
  const lines = description.split("\n").map(line => line.trim()).filter(line => {
    return !line.startsWith("#") && line.length > 0;
  });

  let start = 0;
  if (lines.length > 0 && lines[0][0] == "+") {
    // special instruction to change the starting index
    start = unhex(lines[0].slice(1));
    lines.shift();
  }

  // set default values for each glyph.
  const rv: string[][] = defaultCodemap(count, start);

  let index = 0;
  lines.forEach((line, lineno) => {
    try {
      const m = line.match(/^(\w+)\s*:\s*/);
      if (m) {
        index = unhex(m[1]);
        line = line.slice(m[0].length);
      }

      const sequences = line.split(",").map(seq => {
        return String.fromCharCode(...seq.trim().split(";").map(codepoint => unhex(codepoint.trim())))
      });
      rv[index] = sequences;
    } catch (error) {
      process.stderr.write(`Error parsing codemap at line ${lineno + 1}: ${error.message}\n`);
      process.stderr.write(`    ${line}\n`);
      throw error;
    }

    index++;
  });
  return rv;
}

function unhex(s: string): number {
  return parseInt(s, 16);
}
