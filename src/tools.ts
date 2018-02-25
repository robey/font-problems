import { range } from "./arrays";
import { Framebuffer } from "./framebuffer";

/*
 * detect cell boundaries by finding rows & columns that are mostly empty.
 *
 * calculate the average brightness of all pixels along each row and column,
 * then look for intervals where the rows or columns spaced out along that
 * interval are brighter. for example, if there's a pattern of every 8th row
 * being brighter than the rest, then the cells are probably 8 pixels tall,
 * and the bottom line is the space between glyphs.
 */
export function sniffBoundaries(image: Framebuffer): { width: number, height: number } {
  function average(list: number[]): number {
    return list.reduce((a, b) => a + b) / list.length;
  }

  // convert each row & column into a number representing the "average brightness".
  const rows = range(0, image.height).map(y => average(range(0, image.width).map(x => image.getPixelAsGray(x, y))));
  const columns = range(0, image.width).map(x => average(range(0, image.height).map(y => image.getPixelAsGray(x, y))));

  // average the "average brightness" values for every line along an
  // interval, with a small penalty to larger intervals.
  function checkInterval(lines: number[], interval: number): number {
    return average(range(interval, lines.length, interval).map(i => lines[i - 1])) * Math.pow(0.99, interval);
  }

  function pickBestInterval(lines: number[], low: number, high: number): number {
    // try intervals that evenly divide into the number of lines.
    const intervals = range(low, high).filter(n => lines.length % n == 0);
    return intervals.map(n => ({ n, weight: checkInterval(lines, n) })).sort((a, b) => {
      // by highest weight, and in case of tie, by smallest n.
      return (a.weight == b.weight) ? a.n - b.n : b.weight - a.weight;
    })[0].n;
  }

  return {
    width: pickBestInterval(columns, 4, 13),
    height: pickBestInterval(rows, 6, 17)
  };
}
