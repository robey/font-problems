import { range } from "./arrays";

/*
 * tools for reading/writing the codemap, which maps each glyph to a list
 * of unicode points or sequences.
 */

export function dumpCodemap(codemap: number[][]): string {
  return codemap.map((codepoints, i) => {
    return i.toString(16) + ": " + codepoints.map(cp => cp.toString(16)).join(", ");
  }).join("\n") + "\n";
}

// make a default codemap where each glyph maps to one codepoint: its index (0, 1, ...)
export function defaultCodemap(count: number, start: number = 0): number[][] {
  return range(0, count).map(n => [ start + n ]);
}

/*
 * line ::= index ":" (range | sequence)
 * range ::= codepoint "-" codepoint
 * sequence ::= codepoint ("," codepoint)*
 * index ::= <hex>
 * codepoint ::= <hex> * * lines ::= line ("\n" line)*
 */
export function parseCodemap(count: number, description: string): number[][] {
  const lines = description.split("\n").map(line => line.trim()).filter(line => {
    return !line.startsWith("#") && line.length > 0;
  });

  const codemap: number[][] = range(0, count).map(_ => []);

  lines.forEach((line, lineno) => {
    try {
      const [ left, right ] = line.split(":", 2);
      let index = unhex(left.trim());

      const dash = right.indexOf("-");
      if (dash > 0) {
        let start = unhex(right.slice(0, dash).trim());
        const end = unhex(right.slice(dash + 1).trim());
        while (start <= end) {
          codemap[index++].push(start++);
        }
      } else {
        codemap[index] = codemap[index].concat(right.split(",").map(s => unhex(s.trim())));
      }
    } catch (error) {
      process.stderr.write(`Error parsing codemap at line ${lineno + 1}: ${error.message}\n`);
      process.stderr.write(`    ${line}\n`);
      throw error;
    }
  });

  return codemap;
}

function unhex(s: string): number {
  return parseInt(s, 16);
}
