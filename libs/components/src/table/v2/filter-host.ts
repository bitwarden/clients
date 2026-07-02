import { InjectionToken } from "@angular/core";

import { FilterControl } from "../../filter-menu/filter-tokens";

/**
 * What a filterable surface (e.g. `bit-table-v2`) exposes so filter chips can
 * register against it. The host collects the registered controls' keyed values
 * into a single `{ key: value }` object (the way a `FormGroup` exposes `.value`)
 * and applies the consumer's filter function. Kept as a token so a filter chip
 * never depends on the table type — the bridge injects this abstraction,
 * mirroring how `bit-search` once used a token rather than the table.
 */
export interface FilterHost {
  registerFilter(control: FilterControl): void;
  unregisterFilter(control: FilterControl): void;
}

/** Provided by a filterable surface; injected by {@link BitTableFilterDirective}. */
export const FILTER_HOST = new InjectionToken<FilterHost>("FilterHost");
