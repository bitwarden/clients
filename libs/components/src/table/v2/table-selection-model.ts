import { computed, Signal, signal } from "@angular/core";

export type TableSelectionConfig<T> = {
  /** Allow more than one row selected at a time. Single-select keeps only the latest. */
  multiple?: boolean;
  /** Rows selected initially (non-selectable ones are dropped). */
  initial?: readonly T[];
  /** Which rows may be selected. Defaults to "every row". */
  canSelect?: (row: T) => boolean;
  /**
   * The rows in scope for select-all / indeterminate — the table's filtered
   * view. Read reactively, so the aggregates track filtering.
   */
  rows: Signal<readonly T[]>;
};

/**
 * Signal-native row selection for `bit-table-v2`. Holds the selected rows in a
 * signal, so {@link isSelected} and the {@link allSelected} / {@link indeterminate}
 * aggregates react to any change — programmatic or via the checkbox UI — without
 * relying on change detection. Knows which rows are *selectable* ({@link canSelect})
 * and scopes select-all to the {@link selectable} subset of the rows it's given.
 *
 * The {@link canSelect} predicate is enforced on {@link select}, so a
 * non-selectable row can never enter the selection — even programmatically.
 */
export class TableSelectionModel<T> {
  private readonly multiple: boolean;
  private readonly canSelect: (row: T) => boolean;
  private readonly rows: Signal<readonly T[]>;
  private readonly _selected = signal<readonly T[]>([]);

  constructor(config: TableSelectionConfig<T>) {
    this.multiple = config.multiple ?? false;
    this.canSelect = config.canSelect ?? (() => true);
    this.rows = config.rows;
    const initial = (config.initial ?? []).filter((row) => this.canSelect(row));
    this._selected.set(this.multiple ? initial : initial.slice(0, 1));
  }

  /** The currently selected rows. */
  readonly selected: Signal<readonly T[]> = this._selected.asReadonly();

  /** How many rows are selected. */
  readonly count = computed(() => this._selected().length);

  /** In-scope rows that may be selected — the model's `rows` minus non-selectable ones. */
  readonly selectable = computed(() => this.rows().filter((row) => this.canSelect(row)));

  /** Whether every selectable in-scope row is selected. */
  readonly allSelected = computed(() => {
    const rows = this.selectable();
    return rows.length > 0 && rows.every((row) => this.isSelected(row));
  });

  /** Whether some but not all selectable in-scope rows are selected. */
  readonly indeterminate = computed(() => {
    const rows = this.selectable();
    const selected = rows.filter((row) => this.isSelected(row)).length;
    return selected > 0 && selected < rows.length;
  });

  /** Whether `row` is selected. Reads the selection signal, so callers react to changes. */
  isSelected(row: T): boolean {
    return this._selected().includes(row);
  }

  /** Whether `row` may be selected. */
  isSelectable(row: T): boolean {
    return this.canSelect(row);
  }

  /** Selects rows, ignoring any that aren't {@link isSelectable}. Single-select keeps only the last. */
  select(...rows: T[]): void {
    const allowed = rows.filter((row) => this.canSelect(row));
    if (allowed.length === 0) {
      return;
    }
    this._selected.update((current) => {
      if (!this.multiple) {
        return [allowed[allowed.length - 1]];
      }
      const next = [...current];
      for (const row of allowed) {
        if (!next.includes(row)) {
          next.push(row);
        }
      }
      return next;
    });
  }

  /** Deselects rows. */
  deselect(...rows: T[]): void {
    this._selected.update((current) => current.filter((row) => !rows.includes(row)));
  }

  /** Toggles a single row's selection. */
  toggle(row: T): void {
    if (this.isSelected(row)) {
      this.deselect(row);
    } else {
      this.select(row);
    }
  }

  /** Selects every selectable in-scope row, or clears them if all are already selected. */
  toggleAll(): void {
    const rows = this.selectable();
    if (this.allSelected()) {
      this.deselect(...rows);
    } else {
      this.select(...rows);
    }
  }

  /** Clears the selection. */
  clear(): void {
    this._selected.set([]);
  }
}
