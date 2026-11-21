import { createContext } from "@lit/context";
import type { TemplateResult } from "lit";

import type { BitwardenIcon } from "../icon/shared-icon";
import type { IconTileOptions } from "../icon-tile/icon-tile-options";

/** Icon tile configuration for a `bit-filter-option` row. */
export type FilterOptionIconTile = IconTileOptions;

/**
 * A node in a data-driven option tree passed to `bit-filter-menu`'s or `bit-filter-section`'s
 * `options` — the shape of an arbitrarily deep tree whose depth isn't known ahead of time.
 */
export type FilterOptionNode<T = unknown> = {
  value: T;
  label: string;
  /** Overrides the host's automatic count — see `BitFilterOption.count`. */
  count?: number;
  options?: readonly FilterOptionNode<T>[];
  /**
   * Draws a divider immediately before this node. Only meaningful at the top level of
   * `bit-filter-menu`'s `options` — mirrors `bit-filter-option-divider`, which a data-driven tree
   * can't place directly since a non-empty `options` takes precedence over child elements.
   */
  dividerBefore?: boolean;
};

/** What a chip exposes to a host bridge: a keyed, aggregated value. */
export interface FilterControl {
  /** The chip's key — the property its value occupies in the host's value object. */
  readonly key: string;
  /** The chip's value: the selected value (single-select) or an array (multi-select). */
  readonly value: unknown;
  /** The chip's value with nothing selected — `[]`, `null`, or `false`, never `undefined`. */
  readonly clearedValue: unknown;
  /** Whether the chip has a selection. */
  readonly active: boolean;
  /** Sets the chip's value — used to seed initial filters. */
  setValue(value: unknown): void;
  /** Calls `listener` after any change to the chip's state. Returns the unsubscribe function. */
  subscribe(listener: () => void): () => void;
}

/**
 * What a filterable surface (e.g. a table) exposes so filter chips can register. Provide it with
 * `new ContextProvider(host, filterHostContext, host)`; chips anywhere beneath the host register
 * once their first render completes and unregister when they disconnect.
 *
 * When `optionCount` results change (data or other filters changed), call the provider's
 * `setValue(host)` again: every chip re-renders its counts.
 */
export interface FilterHost {
  registerFilter(control: FilterControl): void;
  unregisterFilter(control: FilterControl): void;
  /**
   * How many rows match if the chip's `key` is pinned to `value`, with every other active
   * filter applied. `undefined` when the host can't count, so the chip falls back to an
   * option's explicit `count`.
   */
  optionCount?(key: string, value: unknown): number | undefined;
}

/** Replaces Angular's `FILTER_HOST` token. */
export const filterHostContext = createContext<FilterHost>(Symbol("bit-filter-host"));

/**
 * A selected option. The value is included so a surface can track each selection and pass it
 * back to {@link FilterPresenter.deselect}.
 */
export interface FilterSelection {
  readonly value: unknown;
  readonly label: string;
}

/**
 * How a filter presents itself outside its own chip: in the responsive filter dialog, or as
 * active-filter chips in a table toolbar. Implemented by `bit-filter-menu` and `bit-filter-toggle`;
 * replaces Angular's `FILTER_PRESENTER` token (find presenters with {@link isFilterPresenter}).
 */
export interface FilterPresenter extends FilterControl {
  /** Row + drill-in title — the chip's `placeholderText` or the toggle's `label`. */
  readonly label: string;
  /** Leading icon for the filter's row, when the consumer supplies one. */
  readonly icon?: BitwardenIcon;
  /** Whether the filter can hold more than one value. `false` for a single-select or a toggle. */
  readonly multiple: boolean;
  /** Selected-options summary for the row, e.g. "Login"; empty when none. */
  readonly summary: string;
  /**
   * The selections behind {@link summary}, unjoined, so a surface can draw each one separately.
   * Empty for a toggle, which has no options.
   */
  readonly selections: readonly FilterSelection[];
  /**
   * The options body, to render on a drill-in page (with Lit's `render` or inside another
   * template). The template is bound to the chip, so it stays interactive wherever it's rendered;
   * re-render it from {@link FilterControl.subscribe}. `undefined` means the filter has no drill-in
   * (a toggle), so its row flips it in place via {@link flip}.
   */
  optionsTemplate(): TemplateResult | undefined;
  /** Flip an in-place filter (a toggle) from its row. No-op for a drill-in filter. */
  flip(): void;
  /**
   * Removes one value from the selection, leaving the rest. Does nothing if the value isn't
   * selected, or if the filter holds one value at a time; use {@link clear} for those.
   */
  deselect(value: unknown): void;
  /** Reset this filter's selection. */
  clear(): void;
}

/** Whether `value` is a filter chip (`bit-filter-menu`, `bit-filter-toggle`, or a custom one). */
export function isFilterPresenter(value: unknown): value is FilterPresenter & HTMLElement {
  return (
    value instanceof HTMLElement &&
    typeof (value as Partial<FilterPresenter>).optionsTemplate === "function" &&
    typeof (value as Partial<FilterPresenter>).subscribe === "function"
  );
}

/** Options selected in a filter; a toggle has no labels, so its active state counts as one. */
export function selectionCount(filter: FilterPresenter): number {
  return Math.max(filter.selections.length, filter.active ? 1 : 0);
}

/**
 * Fired by `bit-filter-menu` and `bit-filter-toggle` when their value changes through the UI or
 * `clear()`/`deselect()`/`flip()` (not `setValue()`, which seeds).
 */
export type FilterChangeEvent = CustomEvent<{ key: string; value: unknown }>;

/** A top-level entry inside a `bit-filter-menu` — an option, a section, or a divider. */
export interface FilterEntry {
  readonly kind: "option" | "section" | "divider";
}

/**
 * The uniform face a `bit-filter-option` and a `bit-filter-section` present to the chip that
 * draws them, so a row is drawn and navigated without asking which one it is.
 */
export interface FilterRow extends FilterEntry {
  readonly kind: "option" | "section";
  readonly label: string;
  readonly disabled: boolean;
  readonly expandable: boolean;
  readonly open: boolean;
  /** The rows directly beneath this one. */
  readonly childRows: readonly FilterOptionRow[];
  toggleExpanded(): void;
}

/**
 * The uniform face an option-kind row presents, whether it's a `bit-filter-option` element or a
 * {@link FilterOptionDataRow} built from a {@link FilterOptionNode}.
 */
export interface FilterOptionRow extends FilterRow {
  readonly kind: "option";
  readonly value: unknown;
  readonly count?: number;
  readonly iconTile?: FilterOptionIconTile;
}

/** A section row: a labelled group of options. */
export interface FilterSectionRow extends FilterRow {
  readonly kind: "section";
  readonly collapsible: boolean;
  /** Every option in the section, nesting included. */
  readonly allOptions: readonly FilterOptionRow[];
}

/**
 * Persists data-driven rows' expanded state across rebuilds of the `options` tree, keyed by node
 * value, so a consumer rebuilding its tree doesn't collapse every row.
 */
export class FilterOptionOpenState {
  private readonly open = new Map<unknown, boolean>();

  constructor(private readonly onChange: () => void) {}

  isOpen(value: unknown): boolean {
    return this.open.get(value) ?? false;
  }

  toggle(value: unknown): void {
    this.open.set(value, !this.isOpen(value));
    this.onChange();
  }
}

/** A {@link FilterOptionRow} built from plain data rather than a `bit-filter-option` element. */
export class FilterOptionDataRow implements FilterOptionRow {
  readonly kind = "option" as const;
  readonly disabled = false;
  readonly iconTile = undefined;
  private _children?: FilterOptionRow[];

  constructor(
    private readonly node: FilterOptionNode<unknown>,
    private readonly openState: FilterOptionOpenState,
  ) {}

  get value(): unknown {
    return this.node.value;
  }

  get count(): number | undefined {
    return this.node.count;
  }

  get label(): string {
    return this.node.label;
  }

  get open(): boolean {
    return this.openState.isOpen(this.node.value);
  }

  get childRows(): readonly FilterOptionRow[] {
    return (this._children ??= buildOptionRows(this.node.options, this.openState));
  }

  get expandable(): boolean {
    return this.childRows.length > 0;
  }

  toggleExpanded(): void {
    this.openState.toggle(this.node.value);
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
 * Builds a `bit-filter-menu`'s top-level data-driven entries, with a divider entry wherever a node
 * sets {@link FilterOptionNode.dividerBefore}. Dividers are top-level only, matching
 * `bit-filter-option-divider` having no effect inside a section.
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

/** An option together with every option nested under it, at any depth, depth-first. */
export function flattenFilterOptions(options: readonly FilterOptionRow[]): FilterOptionRow[] {
  return options.flatMap((option) => [option, ...flattenFilterOptions(option.childRows)]);
}
