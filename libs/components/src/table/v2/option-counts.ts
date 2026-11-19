/**
 * Counts the rows for each pinned chip value in one pass, instead of one pass for each value.
 *
 * A pinned value is a single value, an array (a multi-select option and its subtree), or `null`.
 * A row counts for a pinned value if it passes `matches` and `rowValues` yields any of the pinned
 * values. `null` and `[]` select nothing, so they count every row that passes `matches`.
 *
 * Values compare as `Map` keys do, so they must be primitives such as id strings.
 *
 * @param matches - Whether a row passes every other active filter, with the counted chip cleared.
 * @param rowValues - The values the row holds for the counted chip.
 * @returns One count for each entry of `pinned`, in the same order.
 */
export function countOptions<T>(
  rows: readonly T[],
  matches: (row: T) => boolean,
  rowValues: (row: T) => Iterable<unknown>,
  pinned: readonly unknown[],
): number[] {
  const counts = new Array<number>(pinned.length).fill(0);
  const unpinned: number[] = [];
  const optionsByValue = new Map<unknown, number[]>();
  pinned.forEach((value, index) => {
    const members = value == null ? [] : Array.isArray(value) ? value : [value];
    if (members.length === 0) {
      unpinned.push(index);
      return;
    }
    for (const member of members) {
      const options = optionsByValue.get(member);
      if (options) {
        options.push(index);
      } else {
        optionsByValue.set(member, [index]);
      }
    }
  });

  // The row each option last counted: a row that reaches one option through two of its values
  // (a parent and its child) counts once.
  const lastCountedRow = new Array<number>(pinned.length).fill(-1);
  let matched = 0;
  for (let row = 0; row < rows.length; row++) {
    if (!matches(rows[row])) {
      continue;
    }
    matched++;
    for (const value of rowValues(rows[row])) {
      const options = optionsByValue.get(value);
      if (!options) {
        continue;
      }
      for (const index of options) {
        if (lastCountedRow[index] !== row) {
          lastCountedRow[index] = row;
          counts[index]++;
        }
      }
    }
  }

  for (const index of unpinned) {
    counts[index] = matched;
  }
  return counts;
}
