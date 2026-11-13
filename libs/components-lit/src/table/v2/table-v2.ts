import { ContextProvider, createContext } from "@lit/context";
import { css, html, nothing, PropertyValues, TemplateResult } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";
import { repeat } from "lit/directives/repeat.js";
import { styleMap } from "lit/directives/style-map.js";

import { NoResults } from "@bitwarden/assets/svg";

import { BitElement } from "../../core/bit-element";
import { t } from "../../core/i18n";
import { filterHostContext } from "../../filter-menu/filter-model";
import type { FilterControl, FilterHost } from "../../filter-menu/filter-model";
import { installHoverRevealStyles } from "../../hover-reveal/hover-reveal";
import "../../checkbox/checkbox";
import "../../icon/icon";
import "../../skeleton/skeleton-text";
import "../../status-lockup/status-lockup";
import "../../svg/svg";
import { attachScrollLayoutHost } from "../../layout/scroll-layout";
import { tooltip } from "../../tooltip/tooltip-directive";
import { sortRows } from "../table-data-source";
import { VirtualScrollController } from "../virtual-scroll";

import { ColumnName, isCellParts, TableRowGroup, TableV2Column } from "./column";
import { openCustomizeColumnsDialog } from "./customize-columns-dialog";
import { readQueryParams, writeQueryParams, ParamState, ParamValue } from "./query-param-store";
import { SlotAssigner } from "./slot-assignment";
import { cycleSort, SortState } from "./sort-model";
import {
  getTableColumnPreferences,
  TableColumnPreferencesStore,
  TableStateKey,
} from "./table-column-preferences";
import type { BitTablePaginator } from "./table-paginator";
import { TableSelectionConfig, TableSelectionModel } from "./table-selection-model";

/** The rows a table is showing, passed to a `bit-table-toolbar`'s `rangeLabel`. */
export type TableRowRange = {
  /** 1-based index of the first row shown (0 when there are no rows). */
  start: number;
  /** 1-based index of the last row shown (0 when there are no rows). */
  end: number;
  /** Total row count across all pages. */
  total: number;
};

/** How `<bit-table-v2>` draws its rows. */
export type TablePresentation = "table" | "list";

/** Selection config a consumer supplies; the table provides the `rows` scope itself. */
export type SelectionConfig<T> = Omit<TableSelectionConfig<T>, "rows">;

/** Provided by `bit-table-v2` to its toolbar and paginator. */
export const tableV2Context = createContext<BitTableV2<any, any, any>>(Symbol("bit-table-v2"));

/** Grid track width for the internal selection column: the 24px checkbox plus the cell's `tw-px-4`. */
const SELECTION_COLUMN_WIDTH = "56px";

/** The `min` of a `minmax(min, max)` track. */
const MINMAX_MIN = /^minmax\(\s*([^,]+?)\s*,/;

/**
 * Whether a track can absorb the row's leftover width: only an `fr` max grows. `fr` is invalid
 * as a `minmax` min, so a trailing `fr` can only be the max.
 */
function growsToFill(width: string): boolean {
  return /fr\)?$/.test(width.trim());
}

/** The same track with its minimum intact and its max freed: `240px` becomes `minmax(240px, 1fr)`. */
function grown(width: string): string {
  return `minmax(${MINMAX_MIN.exec(width)?.[1] ?? width.trim()}, 1fr)`;
}

/** Fixed heights (px) of group headers when virtualized. Must match {@link groupHeaderClass}. */
const GROUP_HEADER_HEIGHT = 28;
const SUBGROUP_HEADER_HEIGHT = 22;

/**
 * Fixed height (px) of a group description when virtualized: two `text-sm` lines (20px
 * each) plus the cell's `tw-pb-2`. Descriptions are consumer-supplied localized strings,
 * so they wrap in narrow tables even where English doesn't — two lines is the allowance,
 * and the cell clamps past it. Every description gets this height whether or not it wraps.
 */
const GROUP_DESCRIPTION_HEIGHT = 48;

/** The filter key a projected `bit-search`'s term is adopted under. */
const SEARCH_FILTER_KEY = "search";

/** URL-sync param keys for the non-filter facets, alongside the filter keys in the namespace. */
const SORT_PARAM = "sort";
const DIRECTION_PARAM = "direction";
const PAGE_PARAM = "page";
const PAGE_SIZE_PARAM = "pageSize";

/** A flattened body item: a data row, a group header with its row-group and count, or a group description. */
type RenderItem<T> =
  | { kind: "row"; row: T }
  | { kind: "group"; group: TableRowGroup<T>; count: number; level: number }
  | { kind: "groupDescription"; group: TableRowGroup<T>; level: number };

const sortButtonClasses = [
  "tw-min-w-max",
  "tw-p-1",
  // Pulled back out of the cell's padding so the label lines up with the body cells.
  "-tw-mx-1",
  "tw-border-0",
  "tw-rounded",
  "tw-font-medium",
  "tw-transition",
  "hover:tw-no-underline",
  "tw-bg-transparent",
  "tw-text-fg-body",
  "hover:tw-bg-hover-default",
  "disabled:tw-text-fg-inactive",
  "disabled:hover:tw-bg-transparent",
  "tw-relative",
  "focus-visible:tw-outline-none",
  "focus-visible:tw-ring-2",
  "focus-visible:tw-ring-border-focus",
  "focus-visible:tw-z-10",
].join(" ");

const headerCellClasses =
  "tw-flex tw-items-center tw-h-12 tw-px-4 tw-py-0 tw-text-sm tw-font-medium tw-text-start";

const listCardClasses = [
  "tw-flex",
  "tw-rounded-lg",
  "tw-overflow-hidden",
  "tw-bg-bg-primary",
  "tw-text-fg-heading",
  "tw-border",
  "tw-border-solid",
  "tw-border-border-base",
  "tw-min-h-9",
  "tw-mb-[var(--bit-card-gap)]",
  "[--bit-card-gap:0.375rem]",
  "bit-compact:[--bit-card-gap:0px]",
  "bit-compact:tw-rounded-none",
  "hover:tw-bg-bg-brand-softer",
  "has-[:focus-visible]:tw-ring-1",
  "has-[:focus-visible]:tw-ring-border-focus",
  "has-[:focus-visible]:tw-border-border-focus",
  "has-[[bit-hover-reveal-focus-visible]]:tw-ring-1",
  "has-[[bit-hover-reveal-focus-visible]]:tw-ring-border-focus",
  "has-[[bit-hover-reveal-focus-visible]]:tw-border-border-focus",
].join(" ");

const heightConverter = {
  fromAttribute: (value: string | null) =>
    value == null ? undefined : value === "fill" ? "fill" : Number(value),
  toAttribute: (value: unknown) => (value == null ? null : String(value)),
};

/**
 * **Beta.** Data table with typed columns, sorting, filtering (via projected filter chips and
 * `bit-search`), selection, pagination, virtualization, list presentation with row groups, URL sync
 * and user-customizable columns.
 *
 * Columns are a `columns` array of render callbacks instead of `<bit-column>` children. Rows and
 * cells render in the shadow root as ARIA `table`/`row`/`cell` elements laid out with CSS grid (as
 * in Angular), since grid rows, list cards and virtualization can't use native table layout.
 *
 * Children are projected by tag, no `slot` attribute needed: `bit-table-toolbar`,
 * `bit-table-paginator`, `bit-bulk-actions-bar` (its `selected-count` and `clear` are wired to the
 * selection automatically) and `[slot=empty]` (replaces the default empty state).
 *
 * @fires sortChange - `detail` is the new {@link SortState} after a header click.
 * @fires selectedChange - `detail` is the selected rows.
 * @fires groupToggle - `detail` is `{ id, collapsed }` after a group header toggles.
 */
@customElement("bit-table-v2")
export class BitTableV2<T = any, S extends string = never, F = Record<string, unknown>>
  extends BitElement
  implements FilterHost
{
  static shadowRootOptions: ShadowRootInit = {
    ...BitElement.shadowRootOptions,
    slotAssignment: "manual",
  };

  static styles = [
    BitElement.styles,
    css`
      :host {
        display: block;
      }
      /* In fill mode the host becomes a flex column that fills its parent's height, so the table
         can hand a bounded height down to its scroll region. The floor stops a crowded parent
         squeezing it to nothing; the page scrolls instead. */
      :host([height="fill"]) {
        display: flex;
        flex-direction: column;
        flex: 1 1 0%;
        min-height: 16rem;
      }
      /* The header row scrolls horizontally in sync with the body; hide its own scrollbar so the
         body owns the single visible one. */
      [data-hide-scrollbar] {
        scrollbar-width: none;
      }
      [data-hide-scrollbar]::-webkit-scrollbar {
        display: none;
      }
    `,
  ];

  /** Row data. The table filters, sorts and paginates it for display. */
  @property({ attribute: false }) data: readonly T[] = [];

  /** Column definitions in declaration order. Omit (empty) for no columns. */
  @property({ attribute: false }) columns: readonly TableV2Column<T, S>[] = [];

  /** The columns to display, in order. Omit to show every column in declaration order. */
  @property({ attribute: false }) displayedColumns?: readonly ColumnName<T, S>[];

  /** `"table"` draws the bordered column grid; `"list"` renders each row as a standalone card. */
  @property({ reflect: true }) presentation: TablePresentation = "table";

  /** Active sort. Header clicks cycle it and fire `sortChange`. */
  @property({ attribute: false }) sort: SortState<ColumnName<T, S>> = { direction: "asc" };

  /** Shows skeleton rows in place of data. */
  @property({ type: Boolean, reflect: true }) loading = false;

  /** Number of skeleton rows to show while {@link loading}. */
  @property({ type: Number, attribute: "loading-rows" }) loadingRows = 3;

  /**
   * Client-side row test, given a row and the filter values keyed by each chip's `key` (the
   * search term is under `search`). Omit for server-side filtering.
   */
  @property({ attribute: false }) filter?: (row: T, values: F) => boolean;

  /** Initial filter values, keyed by chip `key`; seeds each matching chip once. */
  @property({ attribute: false }) filters?: Partial<F>;

  /** Row selection config. Omit for a non-selectable table (no checkbox column). */
  @property({ attribute: false }) selection?: SelectionConfig<T>;

  /**
   * Fixed row height in pixels. Setting it virtualizes the body; give columns explicit widths, and
   * set {@link height}.
   */
  @property({ type: Number, attribute: "virtual-row-height" }) virtualRowHeight?: number;

  /**
   * How tall the table is. Omit to grow to content. `"fill"` grows to the host's height and
   * scrolls the body within it. A number caps the body at that many rows (minimum 4), and applies
   * only when {@link virtualRowHeight} is set.
   */
  @property({ reflect: true, converter: heightConverter }) height?: "fill" | number;

  /**
   * Registers the scrolling body as the page's scroll region, like `attachScrollLayoutHost`. A
   * `"fill"` table is what scrolls, since the layout's region wraps it exactly. `"fill"` only.
   */
  @property({ type: Boolean, attribute: "scroll-layout-host" }) scrollLayoutHost = false;

  /** Row identity for re-rendering. Defaults to the row object. */
  @property({ attribute: false }) trackBy?: (index: number, row: T) => unknown;

  /**
   * Syncs sort, filters, and pagination to the URL query string under this prefix — e.g.
   * `query-param="vault"` yields `?vault.sort=name&vault.type=login`. On load, params win over
   * `filters` and `defaultSort`.
   */
  @property({ attribute: "query-param" }) queryParam?: string;

  /**
   * Namespaces this table's stored column preference, and opts it into customization. Required
   * once any column is `removable`.
   */
  @property({ attribute: "state-key" }) stateKey?: TableStateKey;

  /** Where column preferences persist. Defaults to the store set by `setTableColumnPreferencesStorage`. */
  @property({ attribute: false }) columnPreferences?: TableColumnPreferencesStore;

  /** Row groups, `presentation="list"` only. */
  @property({ attribute: false }) groups: readonly TableRowGroup<T>[] = [];

  /** Accessible name for the table. */
  @property() label?: string;

  @state() private scrolled = false;

  @query("[data-body]") private bodyEl?: HTMLElement;
  @query("[data-content]") private contentEl?: HTMLElement;
  @query("[data-header-row]") private headerRowEl?: HTMLElement;

  private readonly tableProvider = new ContextProvider(this, tableV2Context, this);
  private readonly filterProvider = new ContextProvider(
    this,
    filterHostContext,
    this as FilterHost,
  );

  private readonly slots = new SlotAssigner(
    this,
    [
      ["bit-table-toolbar", "toolbar"],
      ["bit-table-paginator", "paginator"],
      ["bit-bulk-actions-bar", "bulk-actions"],
      ["[slot=empty]", "empty"],
    ],
    () => this.adoptSearch(),
  );

  private readonly virtualizer = new VirtualScrollController(this, {
    heights: () => this.itemHeights,
    content: () => (this.isVirtualized ? this.contentEl : undefined),
    scroller: () => this.bodyEl,
  });

  private _filters: FilterControl[] = [];
  private readonly filterUnsubscribes = new Map<FilterControl, () => void>();
  private readonly seeded = new WeakSet<FilterControl>();
  private searchControl?: FilterControl & { element: HTMLElement };
  private paginator?: BitTablePaginator;
  private _selectionModel?: TableSelectionModel<T>;
  private unsubscribeSelection?: () => void;
  private unsubscribePreferences?: () => void;
  private readonly collapsedGroups = new Map<string, boolean>();
  private urlRestored = false;
  private defaultsApplied = false;
  private baselinePageSize?: number;
  private warned = new Set<string>();

  // Derived in `willUpdate`.
  private availableColumns: TableV2Column<T, S>[] = [];
  private removableColumns: TableV2Column<T, S>[] = [];
  private hiddenColumnNames: ReadonlySet<string> = new Set();
  private _effectiveColumns: TableV2Column<T, S>[] = [];
  private gridTemplateColumns?: string;
  private _filterValues = {} as F;
  private _filtered: T[] = [];
  private _sorted: T[] = [];
  private rows: T[] = [];
  private renderItems: RenderItem<T>[] = [];
  private itemHeights: number[] = [];
  private lastFiltered?: T[];
  private layoutHost?: { element: HTMLElement; destroy(): void };

  connectedCallback() {
    super.connectedCallback();
    this.slots.connect();
    this.addEventListener("clear", this.onBulkClear);
    if (this.hasUpdated) {
      this.syncScrollLayoutHost();
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.slots.disconnect();
    this.removeEventListener("clear", this.onBulkClear);
    this.unsubscribePreferences?.();
    this.unsubscribePreferences = undefined;
    this.layoutHost?.destroy();
    this.layoutHost = undefined;
  }

  /** Publishes the body while {@link scrollLayoutHost} is set; the body element swaps with virtualization. */
  private syncScrollLayoutHost() {
    const body = this.scrollLayoutHost && this.isFill ? this.bodyEl : undefined;
    if (body === this.layoutHost?.element) {
      return;
    }
    this.layoutHost?.destroy();
    this.layoutHost = body ? { element: body, ...attachScrollLayoutHost(body) } : undefined;
  }

  protected firstUpdated() {
    installHoverRevealStyles(this.renderRoot as ShadowRoot);
  }

  // Public state, read by the toolbar, paginator and consumers.

  /** Selection state, present only when {@link selection} is configured. */
  get selectionModel(): TableSelectionModel<T> | undefined {
    return this._selectionModel;
  }

  /** Registered filter controls (chips and an adopted `bit-search`). */
  get filterControls(): readonly FilterControl[] {
    return this._filters;
  }

  /** The filter controls' combined value, keyed by each control's `key`. Read it for a server query. */
  get filterValues(): F {
    return this._filterValues;
  }

  /** Rows passing {@link filter}, pre-sort. The scope for select-all and the paginator's total. */
  get filtered(): readonly T[] {
    return this._filtered;
  }

  get filteredCount(): number {
    return this._filtered.length;
  }

  /** {@link filtered} in display order — sorted, but not page-sliced. */
  get sorted(): readonly T[] {
    return this._sorted;
  }

  /** The rows on screen — a projected paginator's page, else every filtered row. */
  get rowRange(): TableRowRange {
    if (this.paginator) {
      return this.paginator.range;
    }
    const total = this.filteredCount;
    return { start: total === 0 ? 0 : 1, end: total, total };
  }

  /** The columns that render: available columns minus the ones the user hid. */
  get effectiveColumns(): readonly TableV2Column<T, S>[] {
    return this._effectiveColumns;
  }

  /** Whether the body has scrolled away from the top. */
  get isScrolled(): boolean {
    return this.scrolled;
  }

  /** Whether the Customize control applies to this table. */
  get canCustomizeColumns(): boolean {
    return (
      this.stateKey != null && this.presentation === "table" && this.removableColumns.length > 0
    );
  }

  /** Opens the Customize columns dialog. */
  openCustomizeColumns() {
    const key = this.stateKey;
    if (key == null) {
      return;
    }
    const store = this.preferences;
    openCustomizeColumnsDialog({
      columns: this.removableColumns.map((col) => ({ name: col.name, label: col.label ?? "" })),
      hidden: this.hiddenColumnNames,
      setHidden: (name, hidden) => store.setColumnHidden(key, name, hidden),
      reset: () => store.reset(key),
    });
  }

  // FilterHost

  registerFilter(control: FilterControl): void {
    if (this._filters.includes(control)) {
      return;
    }
    this._filters = [...this._filters, control];
    this.filterUnsubscribes.set(
      control,
      control.subscribe(() => this.requestUpdate()),
    );
    this.requestUpdate();
  }

  unregisterFilter(control: FilterControl): void {
    this._filters = this._filters.filter((f) => f !== control);
    this.filterUnsubscribes.get(control)?.();
    this.filterUnsubscribes.delete(control);
    this.requestUpdate();
  }

  /**
   * Count for a chip option: rows matching {@link filter} with `key` pinned to `value` and every
   * other active filter applied. `undefined` with no `filter` (server-side).
   */
  optionCount(key: string, value: unknown): number | undefined {
    const filter = this.filter;
    if (!filter) {
      return undefined;
    }
    const values = { ...this.computeFilterValues(), [key]: value } as F;
    return this.data.filter((row) => filter(row, values)).length;
  }

  /** @internal Called by `bit-table-paginator` as it connects. */
  registerPaginator(paginator: BitTablePaginator) {
    this.paginator = paginator;
    this.requestUpdate();
  }

  /** @internal */
  unregisterPaginator(paginator: BitTablePaginator) {
    if (this.paginator === paginator) {
      this.paginator = undefined;
      this.requestUpdate();
    }
  }

  private get preferences(): TableColumnPreferencesStore {
    return this.columnPreferences ?? getTableColumnPreferences();
  }

  private get isVirtualized(): boolean {
    return this.virtualRowHeight != null;
  }

  private get isFill(): boolean {
    return this.height === "fill";
  }

  private get isList(): boolean {
    return this.presentation === "list";
  }

  private get hasColumns(): boolean {
    return this.columns.length > 0;
  }

  private get groupingActive(): boolean {
    return this.isList && this.groups.length > 0;
  }

  private warnOnce(message: string) {
    if (!this.warned.has(message)) {
      this.warned.add(message);
      // eslint-disable-next-line no-console
      console.warn(message);
    }
  }

  /** Adopts a `bit-search` anywhere inside the table as the `search` filter. */
  private adoptSearch() {
    const search = this.querySelector<HTMLElement & { value: string }>("bit-search");
    if (search === this.searchControl?.element) {
      return;
    }
    if (this.searchControl) {
      this.unregisterFilter(this.searchControl);
      this.searchControl = undefined;
    }
    if (!search) {
      return;
    }
    this.searchControl = {
      element: search,
      key: SEARCH_FILTER_KEY,
      get value() {
        return search.value;
      },
      clearedValue: "",
      get active() {
        return (search.value ?? "") !== "";
      },
      setValue: (value) => {
        search.value = value == null ? "" : String(value);
        this.requestUpdate();
      },
      subscribe: (listener) => {
        search.addEventListener("input", listener);
        return () => search.removeEventListener("input", listener);
      },
    };
    this.registerFilter(this.searchControl);
  }

  private onBulkClear = (event: Event) => {
    if ((event.target as Element).localName === "bit-bulk-actions-bar") {
      this._selectionModel?.clear();
    }
  };

  private computeFilterValues(): F {
    const values: Record<string, unknown> = {};
    for (const control of this._filters) {
      values[control.key] = control.value;
    }
    return values as F;
  }

  protected willUpdate(changed: PropertyValues<this>) {
    if (changed.has("selection")) {
      this.unsubscribeSelection?.();
      this.unsubscribeSelection = undefined;
      // Scoped over the rows in display order, so a capped select-all keeps the ones the user
      // sees first.
      this._selectionModel = this.selection
        ? new TableSelectionModel<T>({ ...this.selection, rows: () => this._sorted })
        : undefined;
      const model = this._selectionModel;
      if (model) {
        this.unsubscribeSelection = model.subscribe((selected) => {
          this.requestUpdate();
          this.dispatchEvent(
            new CustomEvent("selectedChange", { detail: selected, bubbles: true, composed: true }),
          );
        });
      }
    }
    if (changed.has("columnPreferences") || !this.unsubscribePreferences) {
      this.unsubscribePreferences?.();
      this.unsubscribePreferences = this.preferences.subscribe(() => this.requestUpdate());
    }

    this.seedFilters();
    this.deriveColumns();

    if (!this.defaultsApplied && this.hasColumns) {
      this.defaultsApplied = true;
      this.checkConfiguration();
      this.restoreFromUrl();
      if (!this.sort.column) {
        const defaultCol = this.availableColumns.find((c) => c.defaultSort);
        if (defaultCol) {
          this.sort = { column: defaultCol.name, direction: defaultCol.defaultSort ?? "asc" };
        }
      }
    }

    this.deriveRows();
    if (this.isVirtualized) {
      this.virtualizer.prepare();
    }
  }

  private checkConfiguration() {
    if (this.groups.length > 0 && this.paginator) {
      throw new Error(
        "bit-table-v2: row groups and `<bit-table-paginator>` are not supported together — " +
          "grouping with pagination is not implemented.",
      );
    }
    if (this.isVirtualized && this.height === undefined) {
      this.warnOnce(
        "bit-table-v2: virtualization (`virtualRowHeight`) needs a bounded height — set `height` to a " +
          'row count or `"fill"` (inside a bounded container). Without one the viewport collapses and no rows render.',
      );
    }
    if (this.isVirtualized && this.paginator) {
      this.warnOnce(
        "bit-table-v2: a paginator and virtualization (`virtualRowHeight`) are mutually exclusive — " +
          "virtualization already renders large sets efficiently.",
      );
    }
  }

  /**
   * Seeds controls as they register — from the URL when it holds a value for the key (a shared
   * link restores faithfully), else from `filters`. Each control is seeded once; later user edits
   * aren't undone.
   */
  private seedFilters() {
    const fromUrl = this.queryParam ? readQueryParams(this.queryParam) : {};
    const initial = this.filters as Record<string, unknown> | undefined;
    for (const control of this._filters) {
      if (this.seeded.has(control) || !control.key) {
        continue;
      }
      let value: unknown;
      if (fromUrl[control.key] != null) {
        value = fromUrl[control.key];
      } else if (initial && control.key in initial) {
        value = initial[control.key];
      } else {
        continue;
      }
      this.seeded.add(control);
      control.setValue(value);
    }
  }

  /** Applies URL state to sort and pagination once, then opens the write-back gate. */
  private restoreFromUrl() {
    if (this.queryParam) {
      const fromUrl = readQueryParams(this.queryParam);
      const column = fromUrl[SORT_PARAM];
      if (typeof column === "string") {
        const direction = fromUrl[DIRECTION_PARAM] === "desc" ? "desc" : "asc";
        this.sort = { column: column as ColumnName<T, S>, direction };
      }
      const paginator = this.paginator;
      if (paginator) {
        // Captured before any URL override, so write-back can omit `pageSize` at this baseline.
        this.baselinePageSize = paginator.pageSize;
        const pageSize = fromUrl[PAGE_SIZE_PARAM];
        if (typeof pageSize === "number" && pageSize > 0) {
          paginator.pageSize = pageSize;
        }
        const page = fromUrl[PAGE_PARAM];
        if (typeof page === "number" && page > 0) {
          paginator.pageIndex = page - 1;
        }
      }
    }
    this.urlRestored = true;
  }

  private writeUrl() {
    if (!this.queryParam || !this.urlRestored) {
      return;
    }
    const state: ParamState = {};
    for (const control of this._filters) {
      if (control.key) {
        // Inactive → omitted, so an off toggle leaves no `favorite=false` behind.
        state[control.key] = control.active ? (control.value as ParamValue) : undefined;
      }
    }
    state[SORT_PARAM] = this.sort.column;
    state[DIRECTION_PARAM] = this.sort.column ? this.sort.direction : undefined;
    const paginator = this.paginator;
    if (paginator) {
      state[PAGE_PARAM] = paginator.pageIndex > 0 ? paginator.pageIndex + 1 : undefined;
      state[PAGE_SIZE_PARAM] =
        paginator.pageSize === this.baselinePageSize ? undefined : paginator.pageSize;
    }
    writeQueryParams(this.queryParam, state);
  }

  private deriveColumns() {
    const displayed = this.displayedColumns;
    if (!displayed) {
      this.availableColumns = [...this.columns];
    } else {
      const registry = new Map(this.columns.map((c) => [c.name, c]));
      this.availableColumns = displayed
        .map((name) => registry.get(name))
        .filter((c): c is TableV2Column<T, S> => c !== undefined);
    }
    this.removableColumns = this.availableColumns.filter((col) => {
      if (col.removable && !col.label) {
        this.warnOnce(
          `bit-table-v2: column "${col.name}" is removable but has no \`label\`, ` +
            "so it can't be offered in the Customize dialog. It will stay visible.",
        );
      }
      return col.removable && col.label;
    });

    if (this.canCustomizeColumns && this.stateKey) {
      const names = this.removableColumns.map((col) => col.name as string);
      const stored = this.preferences.hiddenColumns(this.stateKey);
      // Hold back every removable column until preferences load, so none renders and then vanishes.
      this.hiddenColumnNames = new Set(
        stored === undefined ? names : names.filter((name) => stored.has(name)),
      );
    } else {
      this.hiddenColumnNames = new Set();
    }
    const hidden = this.hiddenColumnNames;
    this._effectiveColumns =
      hidden.size === 0
        ? this.availableColumns
        : this.availableColumns.filter((col) => !hidden.has(col.name));

    const cols = this._effectiveColumns;
    if (cols.length === 0) {
      this.gridTemplateColumns = undefined;
      return;
    }
    const widths = cols.map((col) => col.width ?? "1fr");
    // Hiding a column can strip the row of its last flexible track, so the first visible
    // column absorbs the slack.
    if (!widths.some(growsToFill)) {
      widths[0] = grown(widths[0]);
    }
    this.gridTemplateColumns = (
      this._selectionModel ? [SELECTION_COLUMN_WIDTH, ...widths] : widths
    ).join(" ");
  }

  private deriveRows() {
    this._filterValues = this.computeFilterValues();
    const filter = this.filter;
    const filtered = filter
      ? this.data.filter((row) => filter(row, this._filterValues))
      : [...this.data];
    // Kept stable when unchanged: chips re-render whenever the filtered set changes.
    if (
      filtered.length !== this._filtered.length ||
      filtered.some((row, i) => row !== this._filtered[i])
    ) {
      this._filtered = filtered;
    }

    const sort = this.sort;
    if (sort.column) {
      const col = this.availableColumns.find((c) => c.name === sort.column);
      this._sorted = sortRows(this._filtered, sort.column, sort.direction, sort.fn ?? col?.sortFn);
    } else {
      this._sorted = this._filtered;
    }

    const paginator = this.paginator;
    if (paginator && !paginator.manual) {
      const start = paginator.currentPage * paginator.pageSize;
      this.rows = this._sorted.slice(start, start + paginator.pageSize);
    } else {
      this.rows = this._sorted;
    }

    this.renderItems = this.buildRenderItems(this.rows);
    const rowHeight = this.virtualRowHeight;
    this.itemHeights =
      rowHeight == null
        ? []
        : this.renderItems.map((item) =>
            item.kind === "row"
              ? rowHeight
              : item.kind === "groupDescription"
                ? GROUP_DESCRIPTION_HEIGHT
                : this.groupHeaderHeight(item.level),
          );
  }

  private isCollapsed(group: TableRowGroup<T>): boolean {
    if (!group.collapsible) {
      return false;
    }
    if (!this.collapsedGroups.has(group.id)) {
      this.collapsedGroups.set(group.id, group.collapsed ?? false);
    }
    return this.collapsedGroups.get(group.id)!;
  }

  private toggleGroup(group: TableRowGroup<T>) {
    const collapsed = !this.isCollapsed(group);
    this.collapsedGroups.set(group.id, collapsed);
    this.requestUpdate();
    this.dispatchEvent(
      new CustomEvent("groupToggle", {
        detail: { id: group.id, collapsed },
        bubbles: true,
        composed: true,
      }),
    );
  }

  /**
   * The body's render list: rows as-is when ungrouped, else interleaved headers and rows. A row
   * joins the first group whose `match` claims it; empty groups are skipped unless they clear
   * `hideOnEmpty`, and unclaimed rows trail in a headerless block.
   */
  private buildRenderItems(rows: readonly T[]): RenderItem<T>[] {
    const rowItems = (rs: readonly T[]): RenderItem<T>[] =>
      rs.map((row): RenderItem<T> => ({ kind: "row", row }));
    if (this.groups.length > 0 && !this.isList) {
      this.warnOnce(
        'bit-table-v2: row groups are only supported in `presentation="list"`. ' +
          "Groups are ignored in table presentation.",
      );
    }
    if (!this.groupingActive) {
      return rowItems(rows);
    }
    if (this.groups.some((g) => g.children?.some((c) => c.children?.length))) {
      this.warnOnce(
        "bit-table-v2: row groups support only one level of nesting; " +
          "groups nested deeper than that are ignored.",
      );
    }

    // First-match-wins partition of `toSplit` across `groups`, preserving row order.
    const partition = (groups: readonly TableRowGroup<T>[], toSplit: readonly T[]) => {
      const buckets = new Map<TableRowGroup<T>, T[]>();
      const unmatched: T[] = [];
      for (const row of toSplit) {
        const group = groups.find((g) => g.match(row));
        if (!group) {
          unmatched.push(row);
        } else {
          buckets.set(group, [...(buckets.get(group) ?? []), row]);
        }
      }
      return { buckets, unmatched };
    };

    const items: RenderItem<T>[] = [];
    const top = partition(this.groups, rows);
    for (const group of this.groups) {
      const groupRows = top.buckets.get(group) ?? [];
      if (!groupRows.length && (group.hideOnEmpty ?? true)) {
        continue;
      }
      // A collapsed group still shows its header (with the full count) but hides its body.
      items.push({ kind: "group", group, count: groupRows.length, level: 0 });
      if (this.isCollapsed(group)) {
        continue;
      }
      // A row of its own, so it hides when collapsed — `aria-expanded="false"` has to mean
      // nothing of the group is rendered.
      if (group.description) {
        items.push({ kind: "groupDescription", group, level: 0 });
      }
      const children = group.children ?? [];
      if (children.length === 0) {
        items.push(...rowItems(groupRows));
        continue;
      }
      // Rows no subgroup claims render flat directly under the parent header, before the
      // subheadered subgroups.
      const sub = partition(children, groupRows);
      items.push(...rowItems(sub.unmatched));
      for (const child of children) {
        const childRows = sub.buckets.get(child);
        if (!childRows?.length) {
          continue;
        }
        items.push({ kind: "group", group: child, count: childRows.length, level: 1 });
        if (!this.isCollapsed(child)) {
          items.push(...rowItems(childRows));
        }
      }
    }
    items.push(...rowItems(top.unmatched));
    return items;
  }

  private groupHeaderHeight(level: number): number {
    return level === 0 ? GROUP_HEADER_HEIGHT : SUBGROUP_HEADER_HEIGHT;
  }

  protected updated() {
    this.slots.assign();
    this.syncScrollLayoutHost();
    // Re-notify the toolbar and paginator, which read derived state off the table.
    this.tableProvider.setValue(this, true);
    if (this._filtered !== this.lastFiltered) {
      this.lastFiltered = this._filtered;
      // Chips re-read `optionCount`.
      this.filterProvider.setValue(this);
    }
    const bar = this.querySelector<HTMLElement & { selectedCount?: number }>(
      ":scope > bit-bulk-actions-bar",
    );
    if (bar && this._selectionModel && !bar.hasAttribute("selected-count")) {
      bar.selectedCount = this._selectionModel.count;
    }
    this.writeUrl();
  }

  /** Header clicks cycle the sort. */
  private toggleSort(col: TableV2Column<T, S>) {
    this.sort = cycleSort(
      this.sort as SortState<string>,
      col.name,
      col.defaultSort ?? "asc",
    ) as SortState<ColumnName<T, S>>;
    this.dispatchEvent(
      new CustomEvent("sortChange", { detail: this.sort, bubbles: true, composed: true }),
    );
  }

  /**
   * Keeps the checkbox in sync with the selection, which the bindings alone don't guarantee.
   * Without it the box can end up checked when nothing is selected, or empty when everything is.
   */
  private onToggleAll(event: Event, model: TableSelectionModel<T>) {
    model.toggleAll();
    const box = event.target as HTMLInputElement;
    box.checked = model.allSelected;
    box.indeterminate = model.indeterminate;
  }

  private syncScroll(from: HTMLElement | undefined, to: HTMLElement | undefined) {
    if (from && to && to.scrollLeft !== from.scrollLeft) {
      to.scrollLeft = from.scrollLeft;
    }
  }

  private onBodyScroll = (event: Event) => {
    const body = event.target as HTMLElement;
    this.scrolled = body.scrollTop > 0;
    this.syncScroll(body, this.headerRowEl);
  };

  private onHeaderScroll = () => this.syncScroll(this.headerRowEl, this.bodyEl);

  // Rendering

  private get listInset(): string {
    return this.isList ? "tw-mx-3" : "";
  }

  private get fillClasses(): string {
    return this.isFill ? "tw-flex-1 tw-min-h-0" : "";
  }

  private renderHeaderCell(col: TableV2Column<T, S>) {
    // A sort button in `list` presentation would be a focusable, invisible control: the header
    // is visually hidden there.
    const sortable = (col.sortable ?? false) && !this.isList;
    const active = this.sort.column === col.name;
    const ariaSort =
      sortable && active ? (this.sort.direction === "asc" ? "ascending" : "descending") : nothing;
    const icon = !active
      ? "bwi-up-down-btn"
      : this.sort.direction === "asc"
        ? "bwi-arrow-up"
        : "bwi-arrow-down";
    return html`<div role="columnheader" class=${headerCellClasses} aria-sort=${ariaSort}>
      ${
        sortable
          ? html`<button
              type="button"
              class=${sortButtonClasses}
              aria-pressed=${active ? "true" : "false"}
              @click=${() => this.toggleSort(col)}
            >
              ${col.header}<bit-icon class="tw-ms-2" name=${icon}></bit-icon>
            </button>`
          : col.header
      }
    </div>`;
  }

  private renderHeaderRow() {
    const model = this._selectionModel;
    return html`<div
      role="row"
      data-header-row
      data-hide-scrollbar
      class="tw-grid tw-shrink-0 tw-grid-flow-col tw-auto-cols-fr tw-bg-bg-secondary tw-border-0 tw-border-b tw-border-solid tw-border-border-base tw-text-fg-body tw-overflow-x-auto tw-overscroll-x-none ${
        this.isList ? "tw-sr-only" : ""
      }"
      style=${styleMap({ gridTemplateColumns: this.gridTemplateColumns })}
      @scroll=${this.onHeaderScroll}
    >
      ${
        model
          ? html`<div role="columnheader" class="tw-flex tw-h-12 tw-items-center">
              ${
                model.multiSelect
                  ? html`<label
                      class="tw-mb-0 tw-flex tw-h-full tw-w-full tw-cursor-pointer tw-items-center tw-px-4"
                    >
                      <bit-checkbox
                        class="tw-leading-[0]"
                        hide-label
                        disable-margin
                        label=${t("selectAllRows")}
                        .checked=${model.allSelected}
                        .indeterminate=${model.indeterminate}
                        @change=${(e: Event) => this.onToggleAll(e, model)}
                      ></bit-checkbox>
                    </label>`
                  : nothing
              }
            </div>`
          : nothing
      }
      ${this._effectiveColumns.map((col) => this.renderHeaderCell(col))}
    </div>`;
  }

  private renderCell(col: TableV2Column<T, S>, row: T) {
    const value = col.cell(row);
    const parts = isCellParts(value) ? value : { content: value };
    /**
     * Not `tw-truncate`: it applies `overflow-hidden`; `overflow-clip` allows
     * `overflow-clip-margin` so focus rings of child elements don't get cut off. Text still
     * ellipses: `text-overflow` applies to any non-`visible` overflow.
     */
    const contentClasses =
      (col.truncate ?? true)
        ? "tw-overflow-clip [overflow-clip-margin:4px] tw-text-ellipsis tw-whitespace-nowrap"
        : "tw-text-wrap tw-break-words";
    return html`<div
      role="cell"
      class="tw-flex tw-gap-2 tw-items-center tw-min-w-0 tw-px-4 tw-py-2"
    >
      ${parts.start ?? nothing}
      <div class="tw-flex tw-flex-col tw-min-w-0 tw-flex-grow">
        <div class=${contentClasses}>${parts.content}</div>
        ${
          parts.secondary != null
            ? html`<div class="!tw-text-xs tw-text-fg-body-subtle ${contentClasses}">
                ${parts.secondary}
              </div>`
            : nothing
        }
      </div>
      ${
        parts.end != null
          ? html`<div
              class="tw-flex tw-items-center ${this.isList ? "" : "tw-gap-2"}"
              data-bit-item-end-slot=${this.isList ? "" : nothing}
            >
              ${parts.end}
            </div>`
          : nothing
      }
    </div>`;
  }

  private rowClasses(selected: boolean): string {
    const fixed = this.isVirtualized && !this.isList;
    return [
      // `group/row` lets cell content style on row hover with `group-hover/row:*`. To show
      // actions on row hover, prefer `hoverReveal`.
      "tw-group/row",
      "tw-grid",
      "tw-grid-flow-col",
      "tw-auto-cols-fr",
      // If the row is fixed height, tall cell overflow should be clipped and the row should not
      // expand its height to fit the tall cell's content
      ...(fixed ? ["tw-grid-rows-1", "tw-overflow-clip"] : []),
      ...(this.isList
        ? ["tw-w-full", "tw-min-w-0"]
        : [
            // Omitted when virtualized: a min-height would clamp a `virtualRowHeight` below it.
            ...(fixed ? [] : ["tw-min-h-14"]),
            "tw-border-0",
            "tw-border-b",
            "tw-border-solid",
            "tw-border-border-base",
            ...(selected
              ? ["tw-bg-bg-brand-soft"]
              : [
                  "hover:tw-bg-bg-brand-softer",
                  "has-[:focus-visible]:tw-bg-bg-brand-softer",
                  "[&[bit-hover-reveal-focus-visible]]:tw-bg-bg-brand-softer",
                ]),
            // Inset so it isn't clipped by the body's scroll container or a fixed-height row.
            "has-[:focus-visible]:tw-ring-2",
            "has-[:focus-visible]:tw-ring-inset",
            "has-[:focus-visible]:tw-ring-border-focus",
            "[&[bit-hover-reveal-focus-visible]]:tw-ring-2",
            "[&[bit-hover-reveal-focus-visible]]:tw-ring-inset",
            "[&[bit-hover-reveal-focus-visible]]:tw-ring-border-focus",
          ]),
    ].join(" ");
  }

  private renderRow(cells: TemplateResult | unknown[], selected = false) {
    const fixed = this.isVirtualized && !this.isList;
    const row = html`<div
      role="row"
      bit-hover-reveal-container
      class=${this.rowClasses(selected)}
      style=${styleMap({
        gridTemplateColumns: this.gridTemplateColumns,
        height: fixed ? `${this.virtualRowHeight}px` : undefined,
      })}
    >
      ${cells}
    </div>`;
    if (!this.isList) {
      return row;
    }
    const advance = this.virtualRowHeight;
    return html`<div
      class="${listCardClasses} ${this.listInset}"
      style=${styleMap({
        height: advance != null ? `calc(${advance}px - var(--bit-card-gap))` : undefined,
      })}
    >
      ${row}
    </div>`;
  }

  private renderDataRow(row: T) {
    const model = this._selectionModel;
    const selected = model?.isSelected(row) ?? false;
    const selectionCell = model
      ? html`<div role="cell" class="tw-flex tw-items-center">
          ${
            model.isSelectable(row)
              ? html`<label
                  class="tw-mb-0 tw-flex tw-h-full tw-w-full tw-cursor-pointer tw-items-center tw-px-4"
                >
                  <bit-checkbox
                    class="tw-leading-[0]"
                    hide-label
                    disable-margin
                    label=${t("selectRow")}
                    .checked=${selected}
                    ?disabled=${model.full && !selected}
                    @change=${() => model.toggle(row)}
                  ></bit-checkbox>
                </label>`
              : nothing
          }
        </div>`
      : nothing;
    return this.renderRow(
      [selectionCell, ...this._effectiveColumns.map((col) => this.renderCell(col, row))],
      selected,
    );
  }

  private renderLoadingRow() {
    const cells = [
      this._selectionModel
        ? html`<div role="cell" class="tw-flex tw-items-center tw-px-4"></div>`
        : nothing,
      ...this._effectiveColumns.map((col) =>
        col.loading
          ? html`<div role="cell" class="tw-flex tw-items-center tw-min-w-0 tw-px-4 tw-py-2">
              ${col.loading()}
            </div>`
          : html`<div role="cell" class="tw-flex tw-items-center tw-min-w-0 tw-px-4 tw-py-2">
              <bit-skeleton-text class="tw-w-1/2"></bit-skeleton-text>
            </div>`,
      ),
    ];
    return this.renderRow(cells);
  }

  private groupHeaderClass(level: number, forceHeight: boolean): string {
    if (!this.isList) {
      return "tw-flex tw-items-center tw-border-0 tw-border-b tw-border-solid tw-border-border-base tw-bg-bg-secondary tw-px-4 tw-py-2 tw-text-sm tw-font-bold tw-text-fg-body";
    }
    // Matches the extension's section headers.
    const type =
      level === 0
        ? "tw-text-sm tw-text-fg-heading tw-font-medium"
        : "tw-text-xs tw-text-fg-body-subtle tw-font-medium";
    // A pinned height already spaces the label; bottom padding would only push it off-center.
    const bottom = forceHeight ? "" : " tw-pb-1";
    return `tw-flex tw-items-center tw-px-1 ${type}${bottom}`;
  }

  private renderGroupHeader(item: Extract<RenderItem<T>, { kind: "group" }>, forceHeight: boolean) {
    const { group, level, count } = item;
    const colspan = this._effectiveColumns.length + (this._selectionModel ? 1 : 0);
    const height = styleMap({
      height: forceHeight ? `${this.groupHeaderHeight(level)}px` : undefined,
    });
    // Count only on non-empty top-level group headers.
    const countLabel =
      level === 0 && count > 0
        ? html`<span class="tw-ms-auto tw-font-normal tw-text-fg-body-subtle">${count}</span>`
        : nothing;
    // A row whose single header cell spans every column, so it's valid structure inside
    // `role="table"`. The collapse affordance carries `aria-expanded`.
    if (group.collapsible) {
      const collapsed = this.isCollapsed(group);
      return html`<div role="row" class=${this.listInset}>
        <button
          type="button"
          role="columnheader"
          aria-colspan=${colspan}
          aria-expanded=${collapsed ? "false" : "true"}
          class="${this.groupHeaderClass(
            level,
            forceHeight,
          )} tw-w-full tw-cursor-pointer tw-rounded tw-border-0 tw-bg-transparent tw-text-start hover:tw-bg-hover-default focus-visible:tw-outline-none focus-visible:tw-ring-2 focus-visible:tw-ring-inset focus-visible:tw-ring-border-focus"
          style=${height}
          @click=${() => this.toggleGroup(group)}
        >
          ${group.header} ${countLabel}
          <bit-icon
            class="tw-text-fg-body-subtle ${level === 0 ? "tw-ps-2" : "tw-ms-auto"}"
            name=${collapsed ? "bwi-angle-down" : "bwi-angle-up"}
            aria-hidden="true"
          ></bit-icon>
        </button>
      </div>`;
    }
    return html`<div role="row" class=${this.listInset}>
      <div
        role="columnheader"
        aria-colspan=${colspan}
        class=${this.groupHeaderClass(level, forceHeight)}
        style=${height}
      >
        ${group.header} ${countLabel}
      </div>
    </div>`;
  }

  /**
   * Virtualized, the description takes the fixed height the virtualizer allocated and clamps the
   * text to two lines; otherwise it grows to content. The tooltip reaches whatever the clamp cut
   * off — the text itself stays in the accessibility tree either way.
   */
  private renderGroupDescription(group: TableRowGroup<T>, forceHeight: boolean) {
    const colspan = this._effectiveColumns.length + (this._selectionModel ? 1 : 0);
    return html`<div role="row" class=${this.listInset}>
      <div
        role="cell"
        aria-colspan=${colspan}
        class="tw-px-1 tw-pb-2 tw-text-sm tw-text-fg-body-subtle ${
          forceHeight ? "tw-line-clamp-2" : ""
        }"
        style=${styleMap({ height: forceHeight ? `${GROUP_DESCRIPTION_HEIGHT}px` : undefined })}
        ${tooltip(group.description ?? "")}
      >
        ${group.description}
      </div>
    </div>`;
  }

  private renderItem(item: RenderItem<T>, forceHeight: boolean) {
    switch (item.kind) {
      case "group":
        return this.renderGroupHeader(item, forceHeight);
      case "groupDescription":
        return this.renderGroupDescription(item.group, forceHeight);
      default:
        return this.renderDataRow(item.row);
    }
  }

  private trackItem = (item: RenderItem<T>, index: number): unknown => {
    if (item.kind === "group") {
      return item.group;
    }
    if (item.kind === "groupDescription") {
      return `description:${item.group.id}`;
    }
    return this.trackBy ? this.trackBy(index, item.row) : item.row;
  };

  private renderBody() {
    if (this.loading) {
      // Scrolls, so a squeezed `fill` table never crushes the header.
      return html`<div class="tw-overflow-auto ${this.fillClasses}">
        ${Array.from({ length: this.loadingRows }, () => this.renderLoadingRow())}
      </div>`;
    }
    if (this.rows.length === 0) {
      const noMatches = this.data.length > 0;
      return html`<div class="tw-overflow-auto ${this.listInset} ${this.fillClasses}">
        <slot name="empty">
          <bit-status-lockup>
            <bit-svg slot="graphic" .content=${NoResults}></bit-svg>
            <span slot="title">${t(noMatches ? "noMatchingItems" : "nothingToShow")}</span>
          </bit-status-lockup>
        </slot>
      </div>`;
    }
    if (this.isVirtualized) {
      const { start, end } = this.virtualizer.range;
      const offsets = this.virtualizer.offsets;
      const rowHeight = this.virtualRowHeight!;
      // Content height includes group headers, so grouped tables grow to fit them; the row cap
      // stays row-based ("show N rows before scrolling").
      const maxRows =
        typeof this.height === "number" ? Math.max(4, Math.floor(this.height)) : undefined;
      const viewportHeight = this.isFill
        ? undefined
        : `${maxRows !== undefined ? Math.min(maxRows * rowHeight, offsets.total) : offsets.total}px`;
      return html`<div
        data-body
        class="tw-overflow-auto tw-overscroll-x-none ${this.fillClasses}"
        style=${styleMap({ height: viewportHeight })}
        @scroll=${this.onBodyScroll}
      >
        <div
          data-content
          class="tw-relative tw-w-fit tw-min-w-full"
          style=${styleMap({ height: `${offsets.total}px` })}
        >
          <div style=${styleMap({ transform: `translateY(${offsets.offsets[start] ?? 0}px)` })}>
            ${repeat(
              this.renderItems.slice(start, end),
              (item, i) => this.trackItem(item, start + i),
              (item) => this.renderItem(item, true),
            )}
          </div>
        </div>
      </div>`;
    }
    return html`<div
      data-body
      class="tw-overflow-auto tw-overscroll-x-none ${this.fillClasses}"
      @scroll=${this.onBodyScroll}
    >
      <!-- Sizes to the scrolled content, so row borders and fills span the full row width. -->
      <div data-content class="tw-w-fit tw-min-w-full">
        ${repeat(
          this.renderItems,
          (item, i) => this.trackItem(item, i),
          (item) => this.renderItem(item, false),
        )}
      </div>
    </div>`;
  }

  protected render() {
    const containerClass = [
      ...(this.isList
        ? []
        : [
            "tw-bg-bg-primary",
            "tw-border",
            "tw-border-solid",
            "tw-border-border-base",
            "tw-rounded-xl",
            "tw-overflow-clip",
            "tw-shadow-[0px_1px_0.5px_0.05px_rgba(29,41,61,0.02)]",
          ]),
      ...(this.isFill ? ["tw-flex", "tw-min-h-0", "tw-flex-1", "tw-flex-col"] : []),
    ].join(" ");
    // Every row draws a bottom divider, including the last, which would stack with the
    // container's own bottom border. Pulling the body up a pixel lets the container's border own
    // that edge. Positional variants (`last:`) can't do this under virtualization.
    return html`<slot name="bulk-actions"></slot>
      <div class=${containerClass}>
        <slot name="toolbar"></slot>
        <div
          role="table"
          aria-label=${this.label ?? nothing}
          class="-tw-mb-px ${this.isFill ? "tw-flex tw-min-h-0 tw-flex-1 tw-flex-col" : ""}"
        >
          ${this.hasColumns ? [this.renderHeaderRow(), this.renderBody()] : nothing}
        </div>
        <slot name="paginator"></slot>
      </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-table-v2": BitTableV2;
  }
}
