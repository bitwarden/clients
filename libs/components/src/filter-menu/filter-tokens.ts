import { InjectionToken, Signal } from "@angular/core";

/**
 * What a chip exposes to a host bridge: a keyed, aggregated value. A filterable
 * host (e.g. `bit-table-v2`) collects these into a `{ key: value }` object, the
 * way a `FormGroup` exposes its `.value`.
 */
export interface FilterControl {
  /** The chip's key — the property its value occupies in the host's value object. */
  readonly key: Signal<string>;
  /** The chip's value: the selected value (single-select) or an array (multi-select). */
  readonly value: Signal<unknown>;
  /** Whether the chip has a selection. */
  readonly active: Signal<boolean>;
  /** Sets the chip's value — used to seed initial filters. */
  setValue(value: unknown): void;
}

/** Provided by a filter chip / toggle; injected by a host bridge. */
export const FILTER_CONTROL = new InjectionToken<FilterControl>("FilterControl");

/**
 * The selection surface a `bit-filter-chip` provides to its projected
 * `bit-filter-option`s — single- or multi-select, the current selection, a
 * toggle, and the in-menu search term (options self-hide when it doesn't match).
 */
export interface FilterGroup {
  /** `true` for multi-select (checkbox), `false` for single-select (radio). */
  readonly multiple: Signal<boolean>;
  /** The in-menu search term; options hide when their label doesn't match. */
  readonly searchTerm: Signal<string>;
  /** Whether `value` is currently selected. Reads the chip's selection signal. */
  isSelected(value: unknown): boolean;
  /** Selects (single) or toggles (multi) `value`. */
  toggle(value: unknown): void;
}

/** Provided by `bit-filter-chip`; injected by `bit-filter-option`. */
export const FILTER_GROUP = new InjectionToken<FilterGroup>("FilterGroup");
