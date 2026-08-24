import { computed, Signal, signal } from "@angular/core";

export type TableSelectionConfig<T> = {
  /** Allow more than one row selected at a time. Single-select keeps only the latest. */
  multiple?: boolean;
  /** Rows selected initially (non-selectable ones are dropped). */
  initial?: readonly T[];
  /** Which rows may be selected. Defaults to "every row". */
  canSelect?: (row: T) => boolean;
  /**
   * Upper bound on how many rows may be selected at once. Unlimited by default.
   *
   * {@link toggleAll} stops at this many, and {@link allSelected} measures against the same
   * bounded set — so when a cap is in force the header checkbox reads as fully selected at the
   * cap, and what the checkboxes show is always exactly what a consumer will act on.
   */
  max?: number;
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
  private readonly max: number;
  private readonly _selected = signal<readonly T[]>([]);

  constructor(config: TableSelectionConfig<T>) {
    this.multiple = config.multiple ?? false;
    this.canSelect = config.canSelect ?? (() => true);
    this.rows = config.rows;
    this.max = config.max ?? Infinity;
    const initial = (config.initial ?? []).filter((row) => this.canSelect(row));
    this._selected.set(this.multiple ? initial.slice(0, this.max) : initial.slice(0, 1));
  }

  /** The currently selected rows. */
  readonly selected: Signal<readonly T[]> = this._selected.asReadonly();

  /** How many rows are selected. */
  readonly count = computed(() => this._selected().length);

  /** In-scope rows that may be selected — the model's `rows` minus non-selectable ones. */
  readonly selectable = computed(() => this.rows().filter((row) => this.canSelect(row)));

  /**
   * The selectable in-scope rows a select-all would actually take — {@link selectable} bounded by
   * the configured `max`. Identical to `selectable()` when no cap is set.
   */
  private readonly selectableWithinMax = computed(() =>
    this.max === Infinity ? this.selectable() : this.selectable().slice(0, this.max),
  );

  /**
   * Whether every selectable in-scope row a select-all would take is selected. Measured against
   * the capped set, so at the cap the header reads as fully selected rather than never resolving.
   */
  readonly allSelected = computed(() => {
    const rows = this.selectableWithinMax();
    return rows.length > 0 && rows.every((row) => this.isSelected(row));
  });

  /**
   * Whether some but not all selectable in-scope rows are selected.
   *
   * Measured over the *full* in-scope set, unlike {@link allSelected}: "some but not all" is well
   * defined regardless of the cap, and bounding it would report an empty header while a row past
   * the cap window sits visibly checked.
   */
  readonly indeterminate = computed(
    () => this.selectable().some((row) => this.isSelected(row)) && !this.allSelected(),
  );

  /**
   * Whether the cap is reached, so no further row may be selected.
   *
   * Bind row checkboxes' `disabled` to this (excluding already-selected rows, which must stay
   * deselectable). A checkbox left enabled at the cap silently rejects the click while the browser
   * has already flipped its `checked` property — and since the `[checked]` binding's value hasn't
   * changed, Angular never writes it back, leaving the row rendering as selected when it isn't.
   */
  readonly full = computed(() => this.count() >= this.max);

  /** Whether `row` is selected. Reads the selection signal, so callers react to changes. */
  isSelected(row: T): boolean {
    return this._selected().includes(row);
  }

  /** Whether `row` may be selected. */
  isSelectable(row: T): boolean {
    return this.canSelect(row);
  }

  /**
   * Selects rows, ignoring any that aren't {@link isSelectable}. Single-select keeps only the last.
   * Stops once the configured `max` is reached, so the selection can never exceed what a consumer
   * has said it will act on.
   */
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
        if (next.length >= this.max) {
          break;
        }
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

  /**
   * Selects every selectable in-scope row, or clears them if all are already selected. Bounded by
   * the configured `max` — see {@link TableSelectionConfig.max}.
   *
   * A full budget also clears. Otherwise a selection sitting at `max` would dead-end as soon as
   * the rows in scope changed — filter onto rows none of which are selected and the header renders
   * unchecked, but selecting is impossible with no budget left, so the checkbox would do nothing
   * at all. Clearing keeps it actionable and hands back the budget to select within the new view.
   */
  toggleAll(): void {
    if (this.count() >= this.max) {
      // At the cap there is no budget to select with, so clear outright — including any rows held
      // from a previous scope, since those are what consumed the budget.
      this.clear();
    } else if (this.allSelected()) {
      this.deselect(...this.selectable());
    } else {
      this.select(...this.selectableWithinMax());
    }
  }

  /** Clears the selection. */
  clear(): void {
    this._selected.set([]);
  }
}
