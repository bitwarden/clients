// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { _isNumberValue } from "@angular/cdk/coercion";
import { DataSource } from "@angular/cdk/collections";
import { BehaviorSubject, combineLatest, map, Observable, Subscription } from "rxjs";

export type SortDirection = "asc" | "desc";
export type SortFn = (a: any, b: any, direction?: SortDirection) => number;
export type Sort = {
  column?: string;
  direction: SortDirection;
  fn?: SortFn;
};

export type FilterFn<T> = (data: T) => boolean;

// Loosely based on CDK TableDataSource
//  https://github.com/angular/components/blob/main/src/material/table/table-data-source.ts
export class TableDataSource<T> extends DataSource<T> {
  private readonly _data: BehaviorSubject<T[]>;
  private readonly _sort: BehaviorSubject<Sort>;
  private readonly _filter = new BehaviorSubject<string | FilterFn<T>>(null);
  private readonly _renderData = new BehaviorSubject<T[]>([]);
  private _renderChangesSubscription: Subscription | null = null;

  /**
   * The filtered set of data that has been matched by the filter string, or all the data if there
   * is no filter. Useful for knowing the set of data the table represents.
   * For example, a 'selectAll()' function would likely want to select the set of filtered data
   * shown to the user rather than all the data.
   */
  filteredData: T[];

  constructor() {
    super();
    this._data = new BehaviorSubject([]);
    this._sort = new BehaviorSubject({ direction: "asc" });
  }

  get data() {
    return this._data.value;
  }

  set data(data: T[]) {
    data = Array.isArray(data) ? data : [];
    this._data.next(data);
    // Normally the `filteredData` is updated by the re-render
    // subscription, but that won't happen if it's inactive.
    if (!this._renderChangesSubscription) {
      this.filterData(data);
    }
  }

  set sort(sort: Sort) {
    this._sort.next(sort);
  }

  get sort() {
    return this._sort.value;
  }

  /**
   * Filter to apply to the `data`.
   *
   * If a string is provided, it will be converted to a filter using {@link simpleStringFilter}
   **/
  get filter() {
    return this._filter.value;
  }
  set filter(filter: string | FilterFn<T>) {
    this._filter.next(filter);
    // Normally the `filteredData` is updated by the re-render
    // subscription, but that won't happen if it's inactive.
    if (!this._renderChangesSubscription) {
      this.filterData(this.data);
    }
  }

  connect(): Observable<T[]> {
    if (!this._renderChangesSubscription) {
      this.updateChangeSubscription();
    }

    return this._renderData;
  }

  disconnect(): void {
    this._renderChangesSubscription?.unsubscribe();
    this._renderChangesSubscription = null;
  }

  private updateChangeSubscription() {
    const filteredData = combineLatest([this._data, this._filter]).pipe(
      map(([data]) => this.filterData(data)),
    );

    const orderedData = combineLatest([filteredData, this._sort]).pipe(
      map(([data, sort]) => this.orderData(data, sort)),
    );

    this._renderChangesSubscription?.unsubscribe();
    this._renderChangesSubscription = orderedData.subscribe((data) => this._renderData.next(data));
  }

  private filterData(data: T[]): T[] {
    const filter =
      typeof this.filter === "string"
        ? TableDataSource.simpleStringFilter(this.filter)
        : this.filter;
    this.filteredData = this.filter == null ? data : data.filter((obj) => filter(obj));

    return this.filteredData;
  }

  private orderData(data: T[], sort: Sort): T[] {
    if (!sort) {
      return data;
    }

    return this.sortData(data, sort);
  }

  /**
   * Copied from https://github.com/angular/components/blob/main/src/material/table/table-data-source.ts
   * License: MIT
   * Copyright (c) 2022 Google LLC.
   *
   * Data accessor function that is used for accessing data properties for sorting through
   * the default sortData function.
   * This default function assumes that the sort header IDs (which defaults to the column name)
   * matches the data's properties (e.g. column Xyz represents data['Xyz']).
   * May be set to a custom function for different behavior.
   * @param data Data object that is being accessed.
   * @param sortHeaderId The name of the column that represents the data.
   */
  protected sortingDataAccessor(data: T, sortHeaderId: string): string | number {
    const value = (data as unknown as Record<string, any>)[sortHeaderId];

    if (_isNumberValue(value)) {
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
   * Gets a sorted copy of the data array based on the state of the MatSort. Called
   * after changes are made to the filtered data or when sort changes are emitted from MatSort.
   * By default, the function retrieves the active sort and its direction and compares data
   * by retrieving data using the sortingDataAccessor. May be overridden for a custom implementation
   * of data ordering.
   * @param data The array of data that should be sorted.
   * @param sort The connected MatSort that holds the current sort state.
   */
  protected sortData(data: T[], sort: Sort): T[] {
    const column = sort.column;
    const directionModifier = sort.direction === "asc" ? 1 : -1;
    if (!column) {
      return data;
    }

    return data.sort((a, b) => {
      // If a custom sort function is provided, use it instead of the default.
      if (sort.fn) {
        return sort.fn(a, b, sort.direction) * directionModifier;
      }

      let valueA = this.sortingDataAccessor(a, column);
      let valueB = this.sortingDataAccessor(b, column);

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
        // Check if one value is greater than the other; if equal, comparatorResult should remain 0.
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

      // Transform the data into a lowercase string of all property values.
      const dataStr = Object.keys(data as unknown as Record<string, any>)
        .reduce((currentTerm: string, key: string) => {
          // Use an obscure Unicode character to delimit the words in the concatenated string.
          // This avoids matches where the values of two columns combined will match the user's query
          // (e.g. `Flute` and `Stop` will match `Test`). The character is intended to be something
          // that has a very low chance of being typed in by somebody in a text field. This one in
          // particular is "White up-pointing triangle with dot" from
          // https://en.wikipedia.org/wiki/List_of_Unicode_characters
          return currentTerm + (data as unknown as Record<string, any>)[key] + "◬";
        }, "")
        .toLowerCase();

      // Transform the filter by converting it to lowercase and removing whitespace.
      const transformedFilter = filter.trim().toLowerCase();

      return dataStr.indexOf(transformedFilter) != -1;
    };
  };
}
