import { signal, WritableSignal } from "@angular/core";

import { SortDirection, SortFn } from "../table-data-source";

/**
 * Active sort for `bit-table-v2`: which `column` and `direction`, plus an
 * optional comparator `fn`. Generic over the column-name type `C` so the column
 * is constrained to declared columns rather than a bare string. Kept local to
 * v2 (v1's `Sort` is untyped) — see {@link SortModel}.
 */
export type SortState<C extends string = string> = {
  column?: C;
  direction: SortDirection;
  fn?: SortFn;
};

/**
 * Active sort state and transitions for `bit-table-v2`. Holds the current
 * `{ column, direction }` in a signal and owns the cycle logic; the table reads
 * it to sort the rendered rows, resolving each column's comparator itself.
 *
 * Generic over the column-name type `C` ({@link TableModel} binds it to its
 * `ColumnName<T, S>`), so {@link toggle} / {@link applyInitial} and the
 * {@link current} state only accept declared columns — a typo or non-column
 * fails to compile.
 */
export class SortModel<C extends string = string> {
  /**
   * The active sort. Two-way: header clicks update it, and you can read or set
   * it programmatically to persist/restore.
   */
  readonly current: WritableSignal<SortState<C>>;

  constructor(initial?: SortState<C>) {
    this.current = signal<SortState<C>>(initial ?? { direction: "asc" });
  }

  /**
   * Cycles the sort for `column`: flips direction if it's already the sorted
   * column, otherwise starts at `defaultDirection`.
   */
  toggle(column: C, defaultDirection: SortDirection = "asc"): void {
    const current = this.current();
    const direction =
      current.column === column ? (current.direction === "asc" ? "desc" : "asc") : defaultDirection;
    this.current.set({ column, direction });
  }

  /** Sets the initial sort, unless a sort column is already set. */
  applyInitial(column: C, direction: SortDirection): void {
    if (this.current().column) {
      return;
    }
    this.current.set({ column, direction });
  }
}
