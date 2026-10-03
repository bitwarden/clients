import {
  InjectionToken,
  Signal,
  TemplateRef,
  WritableSignal,
  computed,
  signal,
} from "@angular/core";

import { BitwardenIcon } from "../shared/icon";

// Type-only: the components import this module for their tokens, so a value import
// would close a cycle.
import type { FilterOptionIconTile, FilterOptionNode } from "./filter-option.component";

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

/**
 * A selected option. The value is included so a surface can track each selection and pass it
 * back to {@link FilterPresenter.deselect}.
 */
export interface FilterSelection {
  readonly value: unknown;
  readonly label: string;
}

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
  /** Whether the filter can hold more than one value. `false` for a single-select or a toggle. */
  readonly multiple: Signal<boolean>;
  /** Selected-options summary for the row, e.g. "Login"; empty when none. */
  readonly summary: Signal<string>;
  /**
   * The selections behind {@link summary}, unjoined, so a surface can draw each one separately.
   * Empty for a toggle, which has no options.
   */
  readonly selections: Signal<readonly FilterSelection[]>;
  /**
   * The options to stamp on a drill-in page. `undefined` means the filter has no
   * drill-in (a toggle), so its row flips it in place via {@link flip}.
   */
  readonly optionsTemplate: Signal<TemplateRef<unknown> | undefined>;
  /** Flip an in-place filter (a toggle) from its row. No-op for a drill-in filter. */
  flip(): void;
  /**
   * Removes one value from the selection, leaving the rest. Does nothing if the value isn't
   * selected, or if the filter holds one value at a time; use {@link FilterPresenter.clear}
   * for those.
   */
  deselect(value: unknown): void;
  /** Reset this filter's selection. */
  clear(): void;
}

/** Provided by a filter chip / toggle; injected by the responsive filter dialog. */
export const FILTER_PRESENTER = new InjectionToken<FilterPresenter>("FilterPresenter");

/** A top-level entry projected into a `bit-filter-menu` — an option, a section, or a divider. */
export interface FilterEntry {
  readonly kind: "option" | "section" | "divider";
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
  readonly children: Signal<readonly FilterOptionRow[]>;
  toggleExpanded(): void;
}

/**
 * The uniform face an option-kind row presents, whether it's a content-projected
 * `bit-filter-option` or a data-driven {@link FilterOptionDataRow} built from a
 * {@link FilterOptionNode}. `treeNodes`, `allOptions`, and the option templates all read
 * through this rather than `FilterOptionComponent` directly, so either source draws the same way.
 */
export interface FilterOptionRow extends FilterRow {
  readonly kind: "option";
  value(): unknown;
  count(): number | undefined;
  readonly iconTile: Signal<FilterOptionIconTile | undefined>;
}

/**
 * Persists a {@link FilterOptionDataRow}'s expanded state across tree rebuilds, keyed by the
 * node's value. A new {@link FilterOptionDataRow} is built every time the {@link FilterMenuComponent.options}
 * / {@link FilterSectionComponent.options} array is recomputed (e.g. a consumer rebuilding its tree
 * off other reactive state), which would otherwise drop the row back to collapsed on every rebuild.
 * A menu/section owns one store for its own lifetime and threads it through every
 * {@link buildOptionRows} / {@link buildDataEntries} call it makes.
 */
export type FilterOptionOpenState = Map<unknown, WritableSignal<boolean>>;

/** Creates a store for {@link FilterOptionOpenState} — one per `bit-filter-menu`/`bit-filter-section` instance. */
export function createFilterOptionOpenState(): FilterOptionOpenState {
  return new Map();
}

/**
 * A {@link FilterOptionRow} built from plain data rather than a projected component —
 * the node tree passed to {@link FilterMenuComponent.options} or
 * {@link FilterSectionComponent.options}.
 */
export class FilterOptionDataRow implements FilterOptionRow {
  readonly kind = "option" as const;

  readonly disabled = signal(false).asReadonly();
  readonly iconTile = signal<FilterOptionIconTile | undefined>(undefined).asReadonly();

  private readonly _open: WritableSignal<boolean>;
  readonly open: Signal<boolean>;

  readonly children: Signal<readonly FilterOptionRow[]>;
  readonly expandable: Signal<boolean>;

  constructor(
    private readonly node: FilterOptionNode<unknown>,
    openState: FilterOptionOpenState,
  ) {
    let open = openState.get(node.value);
    if (!open) {
      open = signal(false);
      openState.set(node.value, open);
    }
    this._open = open;
    this.open = open.asReadonly();
    this.children = computed(() => buildOptionRows(this.node.options, openState));
    this.expandable = computed(() => this.children().length > 0);
  }

  value(): unknown {
    return this.node.value;
  }

  count(): number | undefined {
    return this.node.count;
  }

  label(): string {
    return this.node.label;
  }

  toggleExpanded(): void {
    this._open.update((open) => !open);
  }
}

/** Builds the top-level {@link FilterOptionRow}s for a data-driven option tree. */
export function buildOptionRows(
  nodes: readonly FilterOptionNode<unknown>[] | undefined,
  openState: FilterOptionOpenState,
): FilterOptionRow[] {
  return (nodes ?? []).map((node) => new FilterOptionDataRow(node, openState));
}

/**
 * Builds a `bit-filter-menu`'s top-level data-driven entries — {@link FilterOptionRow}s, with a
 * synthetic divider entry wherever a node sets {@link FilterOptionNode.dividerBefore}. Dividers
 * are top-level only: a node's own nested subtree is built by {@link buildOptionRows}, which
 * never looks at the flag, matching `bit-filter-option-divider` having no effect inside a section.
 */
export function buildDataEntries(
  nodes: readonly FilterOptionNode<unknown>[] | undefined,
  openState: FilterOptionOpenState,
): FilterEntry[] {
  const entries: FilterEntry[] = [];
  for (const node of nodes ?? []) {
    if (node.dividerBefore) {
      entries.push({ kind: "divider" });
    }
    entries.push(new FilterOptionDataRow(node, openState));
  }
  return entries;
}

/** One row of a multi-select menu's flattened tree. */
export type FilterTreeNode = {
  row: FilterRow;
  /** Index of this row's parent in the flattened list; `null` at the top level. */
  parent: number | null;
  /** Whether the row's children are shown — its own state, or forced open while searching. */
  expanded: boolean;
  level: number;
  /**
   * The row's depth for indentation, which can be shallower than {@link level}: a section
   * is drawn as its group's header rather than a parent row, so its options sit at the
   * group's base indent even though they are its tree children.
   */
  indent: number;
  setsize: number;
  posinset: number;
  /**
   * Whether a row without a chevron still reserves its column, so checkboxes line up.
   * Scoped to the row's own group, so a section with nothing to expand sits at the base indent.
   */
  reserveExpander: boolean;
  /**
   * Whether a `bit-filter-option-divider` sits immediately before this row. The popover
   * draws a line; the dialog hides it and lets the group gap carry the separation.
   */
  dividerBefore: boolean;
  /**
   * First and last row of a top-level group — a section with its descendants, or a run of
   * loose top-level rows. A surface that draws a card per group reads these for its edges;
   * with no sections the whole list is one group.
   */
  groupStart: boolean;
  groupEnd: boolean;
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

/**
 * An option together with every option nested under it, at any depth, depth-first.
 *
 * Reads each option's own {@link FilterRow.children} rather than a `descendants` content query,
 * so it also reaches a data-driven subtree (a {@link FilterOptionDataRow}'s children) — those
 * are plain objects, not projected content, which a content query can't see into.
 */
export function flattenFilterOptions(options: readonly FilterOptionRow[]): FilterOptionRow[] {
  return options.flatMap((option) => [option, ...flattenFilterOptions(option.children())]);
}
