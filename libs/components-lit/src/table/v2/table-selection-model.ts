export type TableSelectionConfig<T> = {
  /** Allow more than one row selected at a time. Single-select keeps only the latest. */
  multiple?: boolean;
  /** Rows selected initially (non-selectable ones are dropped). */
  initial?: readonly T[];
  /** Which rows may be selected. Defaults to "every row". */
  canSelect?: (row: T) => boolean;
  /** Upper bound on how many rows may be selected at once. */
  max?: number;
  /**
   * The rows in scope for select-all / indeterminate — the table's filtered view. Read on every
   * access, so the aggregates track filtering.
   */
  rows: () => readonly T[];
};

/**
 * Row selection for `bit-table-v2`. Knows which rows are *selectable* ({@link isSelectable}) and
 * scopes select-all to the {@link selectable} subset of the rows it's given. The `canSelect`
 * predicate is enforced on {@link select}, so a non-selectable row can never enter the selection —
 * even programmatically.
 *
 * Framework-neutral: read the getters and {@link subscribe} to changes.
 */
export class TableSelectionModel<T> {
  private readonly multiple: boolean;
  private readonly canSelect: (row: T) => boolean;
  private readonly rows: () => readonly T[];
  private readonly max: number;
  private _selected: readonly T[] = [];
  private readonly listeners = new Set<(selected: readonly T[]) => void>();

  constructor(config: TableSelectionConfig<T>) {
    this.multiple = config.multiple ?? false;
    this.canSelect = config.canSelect ?? (() => true);
    this.rows = config.rows;
    this.max = config.max ?? Infinity;
    const initial = (config.initial ?? []).filter((row) => this.canSelect(row));
    this._selected = this.multiple ? initial.slice(0, this.max) : initial.slice(0, 1);
  }

  /** Calls `listener` after every selection change. Returns the unsubscribe function. */
  subscribe(listener: (selected: readonly T[]) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** The currently selected rows. */
  get selected(): readonly T[] {
    return this._selected;
  }

  /** How many rows are selected. */
  get count(): number {
    return this._selected.length;
  }

  /** In-scope rows that may be selected — the model's `rows` minus non-selectable ones. */
  get selectable(): readonly T[] {
    return this.rows().filter((row) => this.canSelect(row));
  }

  /** Whether every selectable in-scope row is selected. */
  get allSelected(): boolean {
    const rows = this.selectable;
    return rows.length > 0 && rows.every((row) => this.isSelected(row));
  }

  /** Whether some but not all selectable in-scope rows are selected. */
  get indeterminate(): boolean {
    return this.selectable.some((row) => this.isSelected(row)) && !this.allSelected;
  }

  /** Whether the cap is reached. Unselected rows' checkboxes disable while this is true. */
  get full(): boolean {
    return this.count >= this.max;
  }

  /** Whether more than one row may be selected at a time. The table skips select-all when false. */
  get multiSelect(): boolean {
    return this.multiple;
  }

  isSelected(row: T): boolean {
    return this._selected.includes(row);
  }

  isSelectable(row: T): boolean {
    return this.canSelect(row);
  }

  /** Selects rows, ignoring any that aren't {@link isSelectable}. */
  select(...rows: T[]): void {
    const allowed = rows.filter((row) => this.canSelect(row));
    if (allowed.length === 0) {
      return;
    }
    if (!this.multiple) {
      this.set([allowed[allowed.length - 1]]);
      return;
    }
    const next = [...this._selected];
    for (const row of allowed) {
      if (next.length >= this.max) {
        break;
      }
      if (!next.includes(row)) {
        next.push(row);
      }
    }
    this.set(next);
  }

  deselect(...rows: T[]): void {
    this.set(this._selected.filter((row) => !rows.includes(row)));
  }

  toggle(row: T): void {
    if (this.isSelected(row)) {
      this.deselect(row);
    } else {
      this.select(row);
    }
  }

  /**
   * Selects every selectable in-scope row, or clears them if all are selected or the `max` budget
   * is spent — otherwise the header checkbox would dead-end.
   */
  toggleAll(): void {
    if (this.count >= this.max) {
      this.clear();
    } else if (this.allSelected) {
      this.deselect(...this.selectable);
    } else {
      const selectable = this.selectable;
      this.select(...(this.max === Infinity ? selectable : selectable.slice(0, this.max)));
    }
  }

  clear(): void {
    this.set([]);
  }

  private set(next: readonly T[]) {
    this._selected = next;
    this.listeners.forEach((listener) => listener(next));
  }
}
