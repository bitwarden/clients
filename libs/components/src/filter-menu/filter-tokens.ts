import { InjectionToken, Signal, TemplateRef } from "@angular/core";

import { BitwardenIcon } from "../shared/icon";

// Type-only: the components import this module for their tokens, so a value import
// would close a cycle.
import type { FilterOptionComponent } from "./filter-option.component";

/** What a chip exposes to a host bridge: a keyed, aggregated value. */
export interface FilterControl {
  /** The chip's key — the property its value occupies in the host's value object. */
  readonly key: Signal<string>;
  /** The chip's value: the selected value (single-select) or an array (multi-select). */
  readonly value: Signal<unknown>;
  /** The chip's value with nothing selected — `[]`, `null`, or `false`, never `undefined`. */
  readonly clearedValue: Signal<unknown>;
  /** Whether the chip has a selection. */
  readonly active: Signal<boolean>;
  /** Sets the chip's value — used to seed initial filters. */
  setValue(value: unknown): void;
}

/** Provided by a filter chip / toggle; injected by a filter host. */
export const FILTER_CONTROL = new InjectionToken<FilterControl>("FilterControl");

/** What a filterable surface (e.g. `bit-table-v2`) exposes so filter chips can register. */
export interface FilterHost {
  registerFilter(control: FilterControl): void;
  unregisterFilter(control: FilterControl): void;
  /**
   * How many rows match if the chip's `key` is pinned to `value`, ignoring every other
   * filter. `undefined` when the host can't count, so the chip falls back to an
   * option's explicit `count`.
   */
  optionCount?(key: string, value: unknown): number | undefined;
}

/**
 * Provided by a filterable surface; injected (optionally) by a filter chip /
 * toggle, which self-registers when it resolves a host.
 */
export const FILTER_HOST = new InjectionToken<FilterHost>("FilterHost");

/** The selection surface a `bit-filter-menu` provides to its projected `bit-filter-option`s. */
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

/** Provided by `bit-filter-menu`; injected by `bit-filter-option`. */
export const FILTER_GROUP = new InjectionToken<FilterGroup>("FilterGroup");

/** How a filter presents itself in the responsive filter dialog. */
export interface FilterPresenter {
  /** Stable identity for the dialog's row list. */
  readonly key: Signal<string>;
  /** Row + drill-in title — the chip's `placeholderText` or the toggle's `label`. */
  readonly label: Signal<string>;
  /** Leading icon for the filter's row, when the consumer supplies one. */
  readonly icon: Signal<BitwardenIcon | undefined>;
  /** Whether the filter has a selection (drives the row's active dot and the applied count). */
  readonly active: Signal<boolean>;
  /** Selected-options summary for the row, e.g. "Login"; empty when none. */
  readonly summary: Signal<string>;
  /** The same selection as {@link summary}, unjoined, so a surface can measure each label. */
  readonly summaryLabels: Signal<readonly string[]>;
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

/** A top-level entry projected into a `bit-filter-menu` — an option or a section. */
export interface FilterEntry {
  readonly kind: "option" | "section";
}

/**
 * The uniform face a `bit-filter-option` and a `bit-filter-section` present to the chip
 * that draws them, so a row is drawn and navigated without asking which one it is.
 */
export interface FilterRow extends FilterEntry {
  label(): string;
  readonly disabled: Signal<boolean>;
  readonly expandable: Signal<boolean>;
  readonly open: Signal<boolean>;
  /** The rows directly beneath this one. */
  readonly children: Signal<readonly FilterOptionComponent[]>;
  toggleExpanded(): void;
}

/** One row of a multi-select menu's flattened tree. */
export type FilterTreeNode = {
  row: FilterRow;
  /** Index of this row's parent in the flattened list; `null` at the top level. */
  parent: number | null;
  /** Whether the row's children are shown — its own state, or forced open while searching. */
  expanded: boolean;
  level: number;
  setsize: number;
  posinset: number;
  /**
   * Whether a row without a chevron still reserves its column, so checkboxes line up.
   * Scoped to the row's own group, so a section with nothing to expand sits at the base indent.
   */
  reserveExpander: boolean;
};

/** The parts of a tree row's behaviour only the chip can answer. */
export interface FilterTreeHost {
  activateNode(node: FilterTreeNode): void;
  parentRow<T>(row: T): T | null;
  childRows<T>(row: T): T[];
}

/** Provided by `bit-filter-menu`; injected by its tree rows. */
export const FILTER_TREE_HOST = new InjectionToken<FilterTreeHost>("FilterTreeHost");

/** Provided by `bit-filter-option` and `bit-filter-section`; injected by `bit-filter-menu`. */
export const FILTER_ENTRY = new InjectionToken<FilterEntry>("FilterEntry");
