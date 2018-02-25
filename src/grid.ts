import { range } from "./arrays";
import { Framebuffer } from "./framebuffer";

// convert a framebuffer to/from a grid of on/off data.

export function framebufferToGrid(fb: Framebuffer): number[][] {
  const rows = new Array<number[]>(fb.height);
  for (let y = 0; y < fb.height; y++) {
    rows[y] = new Array<number>(fb.width);
    for (let x = 0; x < fb.width; x++) {
      rows[y][x] = fb.isOn(x, y) ? 1 : 0;
    }
  }
  return rows;
}

// grab a box out of a 2D grid.
export function cutGrid(data: number[][], x1: number, y1: number, x2: number, y2: number): number[][] {
  const rv: number[][] = [];
  for (let y = y1; y < y2; y++) {
    rv.push(data[y].slice(x1, x2));
  }
  return rv;
}





/*
 * detect cell boundaries by finding rows & columns that are mostly empty.
 *
 * calculate the average brightness of all pixels along each row and column,
 * then look for intervals where the rows or columns spaced out along that
 * interval are brighter. for example, if there's a pattern of every 8th row
 * being brighter than the rest, then the cells are probably 8 pixels tall,
 * and the bottom line is the space between glyphs.
 */
export function sniffBoundaries(grid: number[][]): { width: number, height: number } {
  const width = grid[0].length;
  const height = grid.length;
  const vgrid = range(0, width).map(x => range(0, height).map(y => grid[y][x]));

  function average(list: number[]): number {
    return list.reduce((a, b) => a + b) / list.length;
  }

  // convert each row & column into a number representing the "average brightness".
  const rows = grid.map(average);
  const columns = vgrid.map(average);

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
