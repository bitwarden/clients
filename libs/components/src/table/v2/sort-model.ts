import { signal, WritableSignal } from "@angular/core";

import { Sort, SortDirection } from "../table-data-source";

/**
 * Active sort state and transitions for `bit-table-v2`. Holds the current
 * `{ column, direction }` in a signal and owns the cycle logic; the table reads
 * it to sort the rendered rows, resolving each column's comparator itself.
 */
export class SortModel {
  /**
   * The active sort. Two-way and serializable: header clicks update it, and you
   * can read or set it programmatically to persist/restore. The comparator
   * comes from the sorted column's `sortFn`, so this stays serializable.
   */
  readonly current: WritableSignal<Sort>;

  constructor(initial?: Sort) {
    this.current = signal<Sort>(initial ?? { direction: "asc" });
  }

  /**
   * Cycles the sort for `column`: flips direction if it's already the sorted
   * column, otherwise starts at `defaultDirection`.
   */
  toggle(column: string, defaultDirection: SortDirection = "asc"): void {
    const current = this.current();
    const direction =
      current.column === column ? (current.direction === "asc" ? "desc" : "asc") : defaultDirection;
    this.current.set({ column, direction });
  }

  /** Sets the initial sort, unless a sort column is already set. */
  applyInitial(column: string, direction: SortDirection): void {
    if (this.current().column) {
      return;
    }
    this.current.set({ column, direction });
  }
}
