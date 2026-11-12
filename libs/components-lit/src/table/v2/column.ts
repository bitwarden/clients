import type { SortDirection, SortFn } from "../table-data-source";

/** A valid column name for a row type `T` plus declared synthetic columns `S` (e.g. `"actions"`). */
export type ColumnName<T, S extends string = never> = (keyof T & string) | S;

const CELL_PARTS = Symbol("bit-cell-parts");

/** The slots of a rich cell (Angular `<bit-cell>`'s `slot=start` / default / `secondary` / `end`). */
export type TableCellParts = {
  start?: unknown;
  content?: unknown;
  secondary?: unknown;
  end?: unknown;
};

/** Marks a column's `cell` result as a rich cell laid out into start / content / secondary / end. */
export function cellParts(parts: TableCellParts): TableCellParts {
  return { ...parts, [CELL_PARTS]: true } as TableCellParts;
}

export function isCellParts(value: unknown): value is TableCellParts {
  return typeof value === "object" && value != null && CELL_PARTS in value;
}

/**
 * A `bit-table-v2` column, replacing `<bit-column>` + `*bitCellDef` + `<bit-header-cell>` +
 * `*bitCellLoading`.
 */
export type TableV2Column<T, S extends string = never> = {
  /** Column key; also the default sort accessor (`row[name]`). */
  name: ColumnName<T, S>;
  /** Header cell content. Hide it visually with `<span class="tw-sr-only">` for icon-only columns. */
  header: unknown;
  /** Body cell content for `row`: plain content, or {@link cellParts} for a rich cell. */
  cell: (row: T) => unknown;
  /** Skeleton cell content while the table is loading. Defaults to a half-width skeleton line. */
  loading?: () => unknown;
  /** Enable click-to-sort on this column's header. */
  sortable?: boolean;
  /**
   * Apply this sort direction as the initial sort. Only one column should set this per table; if
   * multiple do, the first wins.
   */
  defaultSort?: SortDirection;
  /** Custom sort comparator. */
  sortFn?: SortFn;
  /**
   * Grid track size. Use a content-independent track so columns align across every row: a fixed
   * length (`"120px"`), `"1fr"` (the default), or `"minmax(240px, 1fr)"`. Intrinsic keywords
   * (`max-content`, `auto`) aren't supported: each row is its own grid.
   */
  width?: string;
  /**
   * Let the user hide this column. Opt-in, so leave it off for row-action columns. Requires
   * {@link label}, and `stateKey` on the table.
   */
  removable?: boolean;
  /** The column's name in the Customize dialog. */
  label?: string;
  /** Truncate the cell's content and secondary text on overflow. Default `true`. */
  truncate?: boolean;
};

/**
 * A row group for `presentation="list"`, replacing `<bit-row-group>`. Rows partition
 * first-match-wins in declaration order.
 */
export type TableRowGroup<T> = {
  /** Stable identity, used to track the collapsed state. */
  id: string;
  /** Header label; the row count is appended automatically on top-level groups. */
  header: unknown;
  /** Membership predicate: a row joins this group if it returns true and no earlier group claimed it. */
  match: (row: T) => boolean;
  /** Makes the header a toggle that collapses the group's rows. */
  collapsible?: boolean;
  /** Initial collapsed state; the table keeps the live state and fires `groupToggle`. */
  collapsed?: boolean;
  /** Explanatory text under the header. Top-level groups only. */
  description?: string;
  /**
   * Whether the group disappears when no rows match (default `true`). Clear it to keep the header —
   * and any description — on screen. Top-level groups only.
   */
  hideOnEmpty?: boolean;
  /** Nested subgroups. Only one level of nesting is supported. */
  children?: readonly TableRowGroup<T>[];
};
