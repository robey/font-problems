// groan.

export function range(start: number, end: number, step: number = 1): number[] {
  return [...Array(Math.ceil((end - start) / step)).keys()].map(i => i * step + start);
}

export function arrayGrouped<A>(array: A[], groupSize: number): A[][] {
  return range(0, array.length, groupSize).map(i => array.slice(i, i + groupSize));
}

// return the most popular string from a list.
export function consensus<A>(
  array: Array<A | undefined>,
  comparer: (a: A | undefined, b: A | undefined) => number
): A | undefined {
  const sorted: Array<[ A, number ]> =
    array.filter(x => x !== undefined).sort(comparer).map(item => [ item, 1 ] as [ A, number ]);
  if (sorted.length == 0) return undefined;

  let i = 1;
  while (i < sorted.length) {
    if (comparer(sorted[i - 1][0], sorted[i][0]) == 0) {
      sorted[i - 1][1]++;
      sorted.splice(i, 1);
    } else {
      i++;
    }
  }
  return sorted.sort((a, b) => b[1] - a[1])[0][0];
}

export function partition<A>(array: A[], f: (item: A) => boolean): [ A[], A[] ] {
  const left: A[] = [];
  const right: A[] = [];
  array.forEach(item => (f(item) ? left : right).push(item));
  return [ left, right ];
}

export function flatten<A>(array: A[][]): A[] {
  return Array.prototype.concat.apply([], array);
}

export function flatMap<A, B>(array: A[], f: (a: A) => B[]): B[] {
  return flatten(array.map(f));
}

export function groupBy<A>(array: A[], grouper: (a: A) => string): { [key: string]: A[] } {
  const rv: { [key: string]: A[] } = {};
  array.forEach(a => {
    const key = grouper(a);
    if (rv[key] === undefined) rv[key] = [];
    rv[key].push(a);
  });
  return rv;
}
