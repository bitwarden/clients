export type SortDirection = "asc" | "desc";
export type SortFn = (a: any, b: any, direction?: SortDirection) => number;
export type Sort = {
  column?: string;
  direction: SortDirection;
  fn?: SortFn;
};

export type FilterFn<T> = (data: T) => boolean;

/** Port of the CDK's `_isNumberValue`. */
function isNumberValue(value: unknown): boolean {
  return !isNaN(parseFloat(value as string)) && !isNaN(Number(value));
}

/**
 * Copied from https://github.com/angular/components/blob/main/src/material/table/table-data-source.ts
 * License: MIT
 * Copyright (c) 2022 Google LLC.
 *
 * Reads a column's value for default sorting. Assumes the column name matches the data's
 * property (column `Xyz` represents `data["Xyz"]`), and coerces numeric strings to numbers.
 */
export function sortingDataAccessor<T>(data: T, column: string): string | number {
  const value = (data as Record<string, any>)[column];
  if (isNumberValue(value)) {
    const numberValue = Number(value);
    return numberValue < Number.MAX_SAFE_INTEGER ? numberValue : value;
  }
  return value;
}

/**
 * Copied from https://github.com/angular/components/blob/main/src/material/table/table-data-source.ts
 * License: MIT
 * Copyright (c) 2022 Google LLC.
 *
 * Returns a sorted copy of `data` by `column`/`direction`, using `fn` when given.
 */
export function sortRows<T>(
  data: readonly T[],
  column: string | undefined,
  direction: SortDirection,
  fn?: SortFn,
): T[] {
  if (!column) {
    return [...data];
  }
  const directionModifier = direction === "asc" ? 1 : -1;
  return [...data].sort((a, b) => {
    // If a custom sort function is provided, use it instead of the default.
    if (fn) {
      return fn(a, b, direction) * directionModifier;
    }

    let valueA = sortingDataAccessor(a, column);
    let valueB = sortingDataAccessor(b, column);

    // If there are data in the column that can be converted to a number,
    // it must be ensured that the rest of the data
    // is of the same type so as not to order incorrectly.
    const valueAType = typeof valueA;
    const valueBType = typeof valueB;

    if (valueAType !== valueBType) {
      if (valueAType === "number") {
        valueA += "";
      }
      if (valueBType === "number") {
        valueB += "";
      }
    }

    if (typeof valueA === "string" && typeof valueB === "string") {
      return valueA.localeCompare(valueB) * directionModifier;
    }

    // If both valueA and valueB exist (truthy), then compare the two. Otherwise, check if
    // one value exists while the other doesn't. In this case, existing value should come last.
    // This avoids inconsistent results when comparing values to undefined/null.
    // If neither value exists, return 0 (equal).
    let comparatorResult = 0;
    if (valueA != null && valueB != null) {
      if (valueA > valueB) {
        comparatorResult = 1;
      } else if (valueA < valueB) {
        comparatorResult = -1;
      }
    } else if (valueA != null) {
      comparatorResult = 1;
    } else if (valueB != null) {
      comparatorResult = -1;
    }

    return comparatorResult * directionModifier;
  });
}

/**
 * Client-side data source for `bit-table` and `bit-table-scroll`: filters and sorts `data` into
 * `renderData`. Framework-neutral replacement for the Angular CDK `DataSource`: read
 * `renderData` and listen for `change` (or use {@link subscribe}).
 *
 * Loosely based on the CDK's `MatTableDataSource`.
 *
 * @fires change - After `data`, `filter` or `sort` changes and `renderData` is recomputed.
 * @fires sortchange - After `sort` changes.
 */
export class TableDataSource<T> extends EventTarget {
  private _data: T[] = [];
  private _sort: Sort = { direction: "asc" };
  private _filter: string | FilterFn<T> = () => true;
  private _renderData: readonly T[] = [];

  /**
   * The filtered set of data that has been matched by the filter string, or all the data if there
   * is no filter. Useful for knowing the set of data the table represents.
   * For example, a 'selectAll()' function would likely want to select the set of filtered data
   * shown to the user rather than all the data.
   */
  filteredData: T[] = [];

  get data(): T[] {
    return this._data;
  }

  set data(data: T[]) {
    this._data = Array.isArray(data) ? data : [];
    this.refresh();
  }

  get sort(): Sort {
    return this._sort;
  }

  set sort(sort: Sort) {
    this._sort = sort;
    this.dispatchEvent(new Event("sortchange"));
    this.refresh();
  }

  /**
   * Filter to apply to the `data`.
   *
   * If a string is provided, it will be converted to a filter using {@link simpleStringFilter}
   */
  get filter(): string | FilterFn<T> {
    return this._filter;
  }

  set filter(filter: string | FilterFn<T>) {
    this._filter = filter;
    this.refresh();
  }

  /** The filtered, sorted rows to render. */
  get renderData(): readonly T[] {
    return this._renderData;
  }

  /** Calls `listener` with the current rows and on every change. Returns an unsubscribe function. */
  subscribe(listener: (rows: readonly T[]) => void): () => void {
    const handler = () => listener(this._renderData);
    this.addEventListener("change", handler);
    handler();
    return () => this.removeEventListener("change", handler);
  }

  private refresh() {
    const filter =
      typeof this._filter === "string"
        ? TableDataSource.simpleStringFilter<T>(this._filter)
        : this._filter;
    this.filteredData = filter == null ? [...this._data] : this._data.filter((row) => filter(row));
    this._renderData = this.sortData(this.filteredData, this._sort);
    this.dispatchEvent(new Event("change"));
  }

  /** Returns `data` ordered by `sort`. Override for custom ordering. */
  protected sortData(data: T[], sort: Sort): T[] {
    if (!sort) {
      return data;
    }
    return sortRows(data, sort.column, sort.direction, sort.fn);
  }

  /**
   * Modified from https://github.com/angular/components/blob/main/src/material/table/table-data-source.ts
   * License: MIT
   * Copyright (c) 2022 Google LLC.
   *
   * @param filter the string to search for
   * @returns a function that checks if a data object matches the provided `filter` string. Each data object
   * is converted to a string of its properties and returns true if the filter has
   * at least one occurrence in that string. The filter string has its whitespace
   * trimmed and the match is case-insensitive.
   */
  static readonly simpleStringFilter = <T>(filter: string): FilterFn<T> => {
    return (data: T): boolean => {
      if (!filter) {
        return true;
      }

      const record = data as Record<string, any>;
      // Transform the data into a lowercase string of all property values.
      const dataStr = Object.keys(record)
        .reduce((currentTerm: string, key: string) => {
          // Use an obscure Unicode character to delimit the words in the concatenated string.
          // This avoids matches where the values of two columns combined will match the user's query
          // (e.g. `Flute` and `Stop` will match `Test`). The character is intended to be something
          // that has a very low chance of being typed in by somebody in a text field. This one in
          // particular is "White up-pointing triangle with dot" from
          // https://en.wikipedia.org/wiki/List_of_Unicode_characters
          return currentTerm + record[key] + "◬";
        }, "")
        .toLowerCase();

      // Transform the filter by converting it to lowercase and removing whitespace.
      const transformedFilter = filter.trim().toLowerCase();

      return dataStr.indexOf(transformedFilter) != -1;
    };
  };
}
