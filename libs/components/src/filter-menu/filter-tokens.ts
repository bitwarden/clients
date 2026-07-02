import { InjectionToken, Signal, TemplateRef } from "@angular/core";

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

/**
 * How a filter (`bit-filter-chip` / `bit-filter-toggle`) presents itself in the
 * responsive filter dialog — the small-screen view where the chip row collapses
 * into a single trigger and each filter becomes a row that drills into its
 * options. The dialog reads these off the projected filters; the desktop chip row
 * doesn't use it.
 */
export interface FilterPresenter {
  /** Stable identity for the dialog's row list. */
  readonly key: Signal<string>;
  /** Row + drill-in title — the chip's `placeholderText` or the toggle's `label`. */
  readonly label: Signal<string>;
  /** Whether the filter has a selection (drives the row's active dot and the applied count). */
  readonly active: Signal<boolean>;
  /** Selected-options summary for the row, e.g. "Login"; empty when none. */
  readonly summary: Signal<string>;
  /**
   * The options to stamp on a drill-in page. `undefined` means the filter has no
   * drill-in (a toggle), so its row flips it in place via {@link flip}.
   */
  readonly optionsTemplate: Signal<TemplateRef<unknown> | undefined>;
  /** Flip an in-place filter (a toggle) from its row. No-op for a drill-in filter. */
  flip(): void;
  /** Reset this filter's selection. */
  clear(): void;
}

/** Provided by a filter chip / toggle; injected by the responsive filter dialog. */
export const FILTER_PRESENTER = new InjectionToken<FilterPresenter>("FilterPresenter");

/**
 * A top-level entry projected into a `bit-filter-chip` — a `bit-filter-option` or a
 * `bit-filter-section`. The chip queries these (in document order) to render the menu
 * rows itself, branching on `kind`. Options and sections are declarative: they hold
 * data, the chip draws the UI, so the same rows re-render cleanly in the popover and
 * the responsive dialog.
 */
export interface FilterEntry {
  readonly kind: "option" | "section";
}

/** Provided by `bit-filter-option` and `bit-filter-section`; injected by `bit-filter-chip`. */
export const FILTER_ENTRY = new InjectionToken<FilterEntry>("FilterEntry");
