import { SortDirection, SortFn } from "../table-data-source";

/**
 * Active sort for `bit-table-v2`: which `column` and `direction`, plus an
 * optional comparator `fn`. Generic over the column-name type `C` so the column
 * is constrained to declared columns rather than a bare string. Bound two-way to
 * the table via `[(sort)]`. Kept local to v2 (v1's `Sort` is untyped).
 */
export type SortState<C extends string = string> = {
  column?: C;
  direction: SortDirection;
  fn?: SortFn;
};

/**
 * Cycles the sort for `column`: flips direction if it's already the sorted
 * column, otherwise starts at `defaultDirection`. Pure — returns the next state.
 */
export function cycleSort<C extends string>(
  current: SortState<C>,
  column: C,
  defaultDirection: SortDirection = "asc",
): SortState<C> {
  const direction =
    current.column === column ? (current.direction === "asc" ? "desc" : "asc") : defaultDirection;
  return { column, direction };
}
