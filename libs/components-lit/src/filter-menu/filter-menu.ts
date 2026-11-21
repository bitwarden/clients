import { html, nothing, PropertyValues, TemplateResult } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";
import { live } from "lit/directives/live.js";
import { repeat } from "lit/directives/repeat.js";
import { styleMap } from "lit/directives/style-map.js";

import { ariaDisable } from "../a11y/aria-disable";
import { getFocusableElements } from "../core/focus";
import { t } from "../core/i18n";
import { uniqueId } from "../core/ids";
import { resolveIconTileColor, resolveIconTileVariant } from "../icon-tile/icon-tile-options";
import { attachMenuTrigger, MenuTriggerHandle } from "../menu/attach-menu";
import type { BitMenu } from "../menu/menu";
import { menuItemBaseStyles, menuItemPrimaryStyles } from "../menu/menu-styles";
import { radioInputClasses } from "../radio-button/radio";
import type { BitSearch } from "../search/search";
import { tooltip } from "../tooltip/tooltip-directive";
import { typography } from "../typography/typography";
import "../berry/berry";
import "../button/button";
import "../checkbox/checkbox";
import "../icon/icon";
import "../icon-tile/icon-tile";
import "../menu/menu";
import "../menu/menu-divider";
import "../search/search";

import {
  dismissButtonClasses,
  filterChipClasses,
  triggerClasses,
  triggerPadding,
} from "./chip-styles";
import { BitFilterChipBase, DISABLED_REASON_ID } from "./filter-chip-base";
import { FilterEntryChildren } from "./filter-entry-registry";
import {
  buildDataEntries,
  FilterEntry,
  FilterOptionNode,
  FilterOptionOpenState,
  FilterOptionRow,
  FilterPresenter,
  FilterRow,
  FilterSectionRow,
  FilterSelection,
  flattenFilterOptions,
} from "./filter-model";
import { buildTreeNodes, FilterTreeNode, onTreeKeydown } from "./filter-tree";
import { rowTooltip, rowTooltipHandle } from "./row-tooltip";
import "./filter-option";
import "./filter-option-divider";
import "./filter-section";

/** Show the in-menu search once the menu has more than this many options. */
const SEARCH_THRESHOLD = 10;

/**
 * Sentinel value for the auto-injected "All" option on a single-select chip:
 * selecting it clears the chip, and it reads as selected while nothing else is.
 */
const CLEAR_FILTER = Symbol("clear-filter");

/**
 * `bit-menu-item`'s look plus the flex layout, shared by every row. Section headers use it as-is;
 * option rows use {@link optionRowClasses}.
 */
const rowBaseClasses = [
  "tw-flex",
  "tw-items-center",
  "tw-gap-2",
  ...menuItemBaseStyles,
  ...menuItemPrimaryStyles,
  // Focus and disabled land on the input, not the row; mirror both onto the row.
  "tw-mb-0",
  "has-[:focus-visible]:tw-z-50",
  "has-[:focus-visible]:tw-rounded-lg",
  "has-[:focus-visible]:tw-ring-2",
  "has-[:focus-visible]:tw-ring-inset",
  "has-[:focus-visible]:tw-ring-border-focus",
  "has-[:focus-visible]:tw-bg-bg-brand-softer",
  "has-[:focus-visible]:tw-text-fg-heading",
  "has-[:disabled]:tw-cursor-default",
  "has-[:disabled]:hover:tw-bg-bg-primary",
  "has-[:disabled]:!tw-text-fg-inactive",
].join(" ");

/** An option row is 48px against a section header's 40px. */
const optionRowClasses = `${rowBaseClasses} tw-py-3`;

const countClasses = "tw-flex-none tw-text-xs tw-font-normal tw-text-fg-body-subtle";

/**
 * A filter chip with a popover menu of `bit-filter-option`s. Single-select by default; set
 * `multiple` for a checkbox-style multi-select.
 *
 * Options, sections and dividers are child elements at any depth (wrappers are fine), or a
 * data-driven tree in `options`. The chip owns its selection: read `value`, listen for
 * `filterChange`, or place it inside a filter host (e.g. a table), where it registers itself.
 *
 * ```html
 * <bit-filter-menu key="type" placeholder-text="Type" unset-label="All">
 *   <bit-filter-option value="login">Login</bit-filter-option>
 * </bit-filter-menu>
 * ```
 *
 * @fires filterChange - `CustomEvent<{ key, value }>` when the selection changes.
 * @csspart trigger - The chip's button.
 */
@customElement("bit-filter-menu")
export class BitFilterMenu extends BitFilterChipBase implements FilterPresenter {
  /** The chip's base label, e.g. "Type" — always shown as the prefix. */
  @property({ attribute: "placeholder-text" }) placeholderText = "";

  /**
   * Label shown after the prefix while inactive, e.g. "All" → "Type: All". Omit to show just the
   * prefix when nothing is selected.
   */
  @property({ attribute: "unset-label" }) unsetLabel?: string;

  /** Multi-select (checkbox) when set; single-select (radio) otherwise. */
  @property({ type: Boolean, reflect: true }) multiple = false;

  /**
   * A data-driven option tree. When non-empty it takes precedence over child `bit-filter-option`s —
   * set a node's `dividerBefore` for a pinned row that needs to stand apart, rather than adding a
   * divider element.
   */
  @property({ attribute: false }) options: readonly FilterOptionNode<unknown>[] = [];

  /** Shows the in-menu search however few options there are (otherwise above ten). */
  @property({ type: Boolean }) searchable = false;

  /** The selection: a single value (single-select) or an array (multi-select). */
  @state() private _value: unknown = undefined;

  @state() private searchTerm = "";

  /** Snapshotted on menu close, so the chip's width doesn't shift while the user toggles options. */
  @state() private committedCount = 0;

  @state() private menuOpen = false;

  /** The tree row holding the single tab stop. */
  @state() private activeRow?: FilterRow;

  @query("[part=trigger]") readonly ariaTarget!: HTMLElement | null;

  @query("bit-menu") private menuEl!: BitMenu;

  /** Shared `name` so a menu's radios form one group; unique per chip so menus don't merge. */
  private readonly radioName = uniqueId("bit-filter-menu");

  private readonly contentEntries = new FilterEntryChildren(this, () => this.requestUpdate());
  private readonly openState = new FilterOptionOpenState(() => this.requestUpdate());
  private dataEntries: FilterEntry[] = [];
  private menuHandle?: MenuTriggerHandle;
  private lastSelections: readonly FilterSelection[] = [];
  private nestingReported = false;

  /** All top-level entries, prioritizing data-driven options over child elements. */
  private get entries(): readonly FilterEntry[] {
    return this.dataEntries.length > 0 ? this.dataEntries : this.contentEntries.list;
  }

  /** Every option (including those nested in sections) — for the summary, search, and threshold. */
  private get allOptions(): FilterOptionRow[] {
    const topLevel = this.entries.flatMap((entry): readonly FilterOptionRow[] => {
      if (entry.kind === "option") {
        return [entry as FilterOptionRow];
      }
      if (entry.kind === "section") {
        return (entry as FilterSectionRow).childRows;
      }
      return [];
    });
    return flattenFilterOptions(topLevel);
  }

  get value(): unknown {
    return this._value;
  }

  get clearedValue(): unknown {
    return this.multiple ? [] : null;
  }

  get active(): boolean {
    const value = this._value;
    return this.multiple ? Array.isArray(value) && value.length > 0 : value != null;
  }

  /** @see FilterPresenter.label — the chip's prefix, e.g. "Type". */
  get label(): string {
    return this.placeholderText;
  }

  /**
   * The selected options, e.g. `[{ value: "login", label: "Login" }]`, each paired with its value
   * so {@link deselect} can remove one. Kept while the options are momentarily absent.
   */
  get selections(): readonly FilterSelection[] {
    const options = this.allOptions;
    if (options.length === 0) {
      return this.lastSelections.filter((selection) => this.isSelected(selection.value));
    }
    this.lastSelections = options
      .filter((option) => this.isSelected(option.value))
      .map((option) => ({ value: option.value, label: option.label }));
    return this.lastSelections;
  }

  /** @see FilterPresenter.summary — the selected option labels, e.g. "Login". */
  get summary(): string {
    return this.selections.map((selection) => selection.label).join(", ");
  }

  /** The chip's display label: `prefix`, `prefix: unsetLabel`, or (single-select) `prefix: selected`. */
  private get displayLabel(): string {
    const prefix = this.placeholderText;
    // Single-select reflects the selected value in the label; multi-select doesn't.
    if (!this.multiple && this.selections.length > 0) {
      return `${prefix}: ${this.summary}`;
    }
    if (this.active) {
      return prefix;
    }
    return this.unsetLabel ? `${prefix}: ${this.unsetLabel}` : prefix;
  }

  /** Live count of selected options (`multiple` only). */
  private get selectedCount(): number {
    return this.multiple && Array.isArray(this._value) ? this._value.length : 0;
  }

  private get showSearch(): boolean {
    return this.searchable || this.allOptions.length > SEARCH_THRESHOLD;
  }

  private get searching(): boolean {
    return this.searchTerm.trim() !== "";
  }

  /** How many options the running search matched; `undefined` with no search or no match. */
  private get resultCount(): number | undefined {
    if (!this.searching) {
      return undefined;
    }
    const matches = this.allOptions.filter((option) => this.rowVisible(option)).length;
    // No count at zero: the "no results" state already names the term.
    return matches === 0 ? undefined : matches;
  }

  private get noResults(): boolean {
    if (!this.searching) {
      return false;
    }
    const options = this.allOptions;
    return options.length > 0 && options.every((option) => !this.rowVisible(option));
  }

  connectedCallback() {
    super.connectedCallback();
    if (this.hasUpdated && !this.menuHandle) {
      this.attachMenu();
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.menuHandle?.destroy();
    this.menuHandle = undefined;
  }

  /** Sets the chip's value — used to seed initial filters. */
  setValue(value: unknown): void {
    // A multi-select chip decoded from a single URL param arrives as a scalar; wrap it so
    // `active` and `isSelected` can treat it uniformly as an array.
    this._value = this.multiple && !Array.isArray(value) && value != null ? [value] : value;
    this.committedCount = this.selectedCount;
  }

  /** Whether `value` is currently selected. */
  isSelected(value: unknown): boolean {
    // The "All" option reads as selected exactly while the chip has no selection.
    if (value === CLEAR_FILTER) {
      return !this.active;
    }
    const current = this._value;
    return this.multiple ? Array.isArray(current) && current.includes(value) : current === value;
  }

  /** Selects (single) or toggles (multi) `value`. */
  toggle(value: unknown): void {
    // Selecting "All" clears the chip rather than setting a value.
    if (value === CLEAR_FILTER) {
      this.clear();
      return;
    }
    if (this.multiple) {
      const current = this.currentArray();
      this.change(
        current.includes(value) ? current.filter((v) => v !== value) : [...current, value],
      );
    } else {
      this.change(value);
    }
  }

  /**
   * @see FilterPresenter.deselect
   *
   * Removes the value rather than calling {@link toggle}, which would re-add it if the chip no
   * longer holds it.
   */
  deselect(value: unknown): void {
    if (!this.multiple) {
      return;
    }
    const current = this.currentArray();
    if (!current.includes(value)) {
      return;
    }
    this.change(current.filter((v) => v !== value));
    // The menu never closed, so commit the berry count here instead of on close.
    this.committedCount = this.selectedCount;
  }

  /** Clears the selection. Wired to the dismiss button, the menu's Clear footer, and the dialog. */
  clear(): void {
    this.lastSelections = [];
    this.committedCount = 0;
    this.change(this.clearedValue);
  }

  /** @see FilterPresenter.flip — a chip drills into its options, so there's nothing to flip. */
  flip(): void {}

  /** @see FilterPresenter.optionsTemplate — the menu body, shared by the popover and the dialog. */
  optionsTemplate(): TemplateResult {
    return this.renderBody();
  }

  protected willUpdate(changed: PropertyValues<this>) {
    super.willUpdate(changed);
    if (changed.has("options")) {
      this.dataEntries = buildDataEntries(this.options, this.openState);
    }
    if (!this.active) {
      this.committedCount = 0;
    }
    if (!this.multiple && !this.nestingReported && this.allOptions.some((o) => o.expandable)) {
      this.nestingReported = true;
      reportError(
        new Error(
          "bit-filter-menu: nested `bit-filter-option`s require `multiple`. A single-select chip " +
            "holds one value, so a parent could never draw as selected.",
        ),
      );
    }
  }

  protected firstUpdated() {
    this.attachMenu();
  }

  private attachMenu() {
    if (!this.ariaTarget || !this.menuEl) {
      return;
    }
    this.menuHandle = attachMenuTrigger(this.ariaTarget, this.menuEl, {
      onOpenChange: (open) => {
        this.menuOpen = open;
        if (open) {
          void this.focusMenuBody();
        } else {
          this.onMenuClosed();
        }
      },
    });
  }

  /** The body only renders once the menu is open, after the menu's own initial focus ran. */
  private async focusMenuBody() {
    await this.updateComplete;
    const focused = this.shadowRoot?.activeElement;
    if (this.menuOpen && !(focused && this.menuEl.contains(focused))) {
      const body = this.renderRoot.querySelector<HTMLElement>("[data-filter-body]");
      if (body) {
        getFocusableElements(body)[0]?.focus();
      }
    }
  }

  /** Resets the search and commits the selected count to the berry when the menu closes. */
  private onMenuClosed() {
    this.searchTerm = "";
    this.committedCount = this.selectedCount;
  }

  private change(value: unknown) {
    this._value = value;
    this.emitChange();
  }

  private currentArray(): unknown[] {
    return Array.isArray(this._value) ? this._value : [];
  }

  /** A parent stays visible when a child matches; a section has no label of its own to match. */
  private rowVisible(row: FilterRow): boolean {
    const term = this.searchTerm.trim().toLowerCase();
    if (row.kind === "section") {
      return row.childRows.some((child) => this.rowVisible(child));
    }
    return (
      term === "" ||
      row.label.toLowerCase().includes(term) ||
      row.childRows.some((child) => this.rowVisible(child))
    );
  }

  /**
   * Whether a divider in the flat list earns its rule: the runs on either side of it, up to the
   * neighbouring dividers, must each still hold a visible row. Without this a search can strand a
   * rule at the top or bottom of the list, or leave two adjacent.
   */
  private dividerVisible(index: number): boolean {
    const entries = this.entries;
    const runHasRow = (from: number, step: number): boolean => {
      for (let i = from; i >= 0 && i < entries.length; i += step) {
        const entry = entries[i];
        if (entry.kind === "divider") {
          return false;
        }
        if (this.rowVisible(entry as FilterRow)) {
          return true;
        }
      }
      return false;
    };
    return runHasRow(index - 1, -1) && runHasRow(index + 1, 1);
  }

  /** A row's own state, or forced open while searching so matches aren't buried. */
  private rowExpanded(row: FilterRow): boolean {
    return this.searching || row.open;
  }

  private subtreeValues(option: FilterOptionRow): unknown[] {
    return [option.value, ...option.childRows.flatMap((child) => this.subtreeValues(child))];
  }

  /** Whether a row draws selected: a leaf's own value, or a parent's whole subtree. */
  private optionSelected(option: FilterOptionRow): boolean {
    return this.subtreeValues(option).every((value) => this.isSelected(value));
  }

  private partiallySelected(option: FilterOptionRow): boolean {
    const values = this.subtreeValues(option);
    return values.some((v) => this.isSelected(v)) && !values.every((v) => this.isSelected(v));
  }

  /** Selecting a row selects everything beneath it; clearing it clears the same set. */
  private toggleOption(option: FilterOptionRow): void {
    const values = this.subtreeValues(option);
    if (!this.multiple || values.length <= 1) {
      this.toggle(values[0]);
      return;
    }
    const current = this.currentArray();
    const selectAll = !values.every((value) => current.includes(value));
    this.change(
      selectAll
        ? [...current, ...values.filter((value) => !current.includes(value))]
        : current.filter((value) => !values.includes(value)),
    );
  }

  /** Section headers aren't selectable, so they expand instead. */
  private activateNode(node: FilterTreeNode): void {
    if (node.row.kind === "option") {
      this.toggleOption(node.row as FilterOptionRow);
    } else {
      node.row.toggleExpanded();
    }
  }

  /** How many of a section's options are selected, nesting included — the header berry. */
  private sectionSelectedCount(section: FilterSectionRow): number {
    return section.allOptions.filter((option) => this.isSelected(option.value)).length;
  }

  /**
   * The count shown on an option row: its explicit `count` if set, else the host's count for this
   * chip's `key`. In `multiple` mode the count uses the option's full subtree of values so a parent
   * row reflects the same item set its click selects.
   */
  private optionCount(option: FilterOptionRow): number | undefined {
    if (option.count != null) {
      return option.count;
    }
    const pinned = this.multiple ? this.subtreeValues(option) : option.value;
    return this.filterHost?.optionCount?.(this.key, pinned);
  }

  private setSearchTerm(term: string) {
    this.searchTerm = term;
  }

  /** Waits for this chip and whichever surface (popover or dialog) re-renders off it. */
  private async afterRender() {
    await this.updateComplete;
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }

  /** The no-results state unmounts with the term, taking its button along; refocus the search. */
  private async clearSearch(event: Event) {
    const body = (event.currentTarget as HTMLElement).closest("[data-filter-body]");
    this.setSearchTerm("");
    await this.afterRender();
    body?.querySelector<BitSearch>("[data-filter-search]")?.focus();
  }

  /**
   * Clearing from the menu's footer removes that button, so hand focus back to the option list
   * rather than letting it fall to the document body.
   */
  private async clearFromMenu() {
    this.clear();
    await this.afterRender();
    const body = this.renderRoot.querySelector<HTMLElement>("[data-filter-body]");
    const row =
      body?.querySelector<HTMLElement>("[role=treeitem][tabindex='0']") ??
      body?.querySelector<HTMLElement>("[role=treeitem]");
    // A search matching nothing leaves no row to return to, so fall back to the field that
    // produced the empty list, then to the menu itself.
    (
      row ??
      body?.querySelector<HTMLElement>("[data-filter-search]") ??
      this.menuEl?._menu
    )?.focus();
  }

  /** Likewise for the chip's dismiss button — focus returns to the chip itself. */
  private async clearFromChip() {
    this.clear();
    await this.updateComplete;
    this.ariaTarget?.focus();
  }

  private onRowFocus(event: FocusEvent, node: FilterTreeNode) {
    this.activeRow = node.row;
    const row = event.currentTarget as HTMLElement;
    // Opens on keyboard focus only, as the tooltip does for its own trigger.
    if (row.matches(":focus-visible")) {
      rowTooltipHandle(row.querySelector("[data-filter-row-label]"))?.show();
    }
  }

  private onRowBlur(event: FocusEvent) {
    const row = event.currentTarget as HTMLElement;
    rowTooltipHandle(row.querySelector("[data-filter-row-label]"))?.hide();
  }

  private renderIconTile(option: FilterOptionRow) {
    const tile = option.iconTile;
    if (!tile) {
      return nothing;
    }
    // Flex on the host: an inline host adds descender space below the tile.
    return html`<bit-icon-tile
      class="!tw-flex tw-flex-none"
      .icon=${tile.icon}
      .variant=${resolveIconTileVariant(tile, option.disabled)}
      .color=${resolveIconTileColor(tile, option.disabled)}
      .emphasis=${tile.emphasis ?? "subtle"}
      size="xs"
    ></bit-icon-tile>`;
  }

  private renderCount(count: number | undefined) {
    return count != null ? html`<span class=${countClasses}>${count}</span>` : nothing;
  }

  /** Single-select rows are flat: nesting requires `multiple`. */
  private renderOptionRow(option: FilterOptionRow) {
    // Tooltip on the label, which `focusin` from the radio reaches, so the full name is also
    // available by keyboard.
    return html`<div data-filter-option-row class=${optionRowClasses}>
      <label
        class="tw-mb-0 tw-flex tw-min-w-0 tw-flex-1 tw-items-center tw-gap-2"
        ${tooltip(option.label)}
      >
        <input
          type="radio"
          class=${radioInputClasses}
          name=${this.radioName}
          .checked=${live(this.optionSelected(option))}
          ?disabled=${option.disabled}
          @change=${() => this.toggleOption(option)}
        />
        ${this.renderIconTile(option)}
        <span class="tw-min-w-0 tw-flex-1 tw-truncate">${option.label}</span>
        ${this.renderCount(this.optionCount(option))}
      </label>
    </div>`;
  }

  private renderNoResults() {
    return html`<div class="tw-flex tw-flex-col tw-items-center tw-gap-3 tw-p-4">
      <bit-icon name="bwi-search" class="tw-text-xl tw-leading-none tw-text-fg-body"></bit-icon>
      <!-- Capped so break-words can wrap a long unbroken term inside the centered column. -->
      <span
        class="${typography("body2", {
          noMargin: true,
        })} tw-line-clamp-2 tw-font-medium tw-max-w-full tw-break-words tw-text-center tw-text-fg-body"
        >${t("noFiltersMatchTerm", this.searchTerm)}</span
      >
      <bit-button
        button-type="secondary"
        size="small"
        start-icon="bwi-clear"
        @click=${(event: Event) => this.clearSearch(event)}
        >${t("clearSearch")}</bit-button
      >
    </div>`;
  }

  private renderTree() {
    const nodes = buildTreeNodes(
      this.entries,
      (row) => this.rowVisible(row),
      (row) => this.rowExpanded(row),
    );
    const tabStop = nodes.find((node) => node.row === this.activeRow) ?? nodes[0];
    // Grid so every row takes the widest row's width; deep rows scroll sideways with aligned counts.
    return html`<div
        role="tree"
        aria-multiselectable="true"
        aria-label=${this.placeholderText}
        tabindex="-1"
        class="tw-grid tw-min-h-0 tw-flex-1 tw-overflow-y-auto"
        data-filter-card-list
        data-filter-scroll
        @keydown=${(event: KeyboardEvent) =>
          onTreeKeydown(event, { activate: (node) => this.activateNode(node) })}
      >
        ${repeat(
          nodes,
          (node) => node.row,
          (node) => this.renderTreeRow(node, node === tabStop),
        )}
      </div>
      ${this.noResults ? this.renderNoResults() : nothing}`;
  }

  private renderTreeRow(node: FilterTreeNode, tabbable: boolean) {
    const row = node.row;
    const section = row.kind === "section" ? (row as FilterSectionRow) : undefined;
    const option = row.kind === "option" ? (row as FilterOptionRow) : undefined;
    const expandable = row.expandable;
    const checked = option
      ? this.partiallySelected(option)
        ? "mixed"
        : this.optionSelected(option)
          ? "true"
          : "false"
      : undefined;
    const toggleExpanded = (event: Event) => {
      event.stopPropagation();
      row.toggleExpanded();
    };

    // The dialog hides the divider and separates the groups with a gap instead. `aria-hidden`
    // because the rule is decorative and `role="tree"` owns only `treeitem`/`group`.
    const divider = node.dividerBefore
      ? html`<bit-menu-divider data-filter-divider aria-hidden="true"></bit-menu-divider>`
      : nothing;

    const expander = section
      ? nothing
      : expandable
        ? html`<span
            data-filter-expander
            class="-tw-me-1 tw-flex tw-size-6 tw-flex-none tw-items-center tw-justify-center tw-text-fg-body-subtle"
            aria-hidden="true"
            @click=${toggleExpanded}
          >
            <!-- An option discloses children, so it takes the solid caret a nested nav group
                 uses: one glyph, rotated when collapsed. -->
            <bit-icon
              name="bwi-down-solid"
              class="tw-text-xl ${node.expanded ? "" : "-tw-rotate-90"}"
            ></bit-icon>
          </span>`
        : node.reserveExpander
          ? html`<span class="-tw-me-1 tw-size-6 tw-flex-none" aria-hidden="true"></span>`
          : nothing;

    // Draws the control only; the row owns the semantics via `aria-checked`.
    const checkbox = option
      ? html`<bit-checkbox
          class="tw-pointer-events-none tw-flex tw-flex-none tw-leading-[0]"
          aria-hidden="true"
          inert
          hide-label
          disable-margin
          .checked=${checked === "true"}
          .indeterminate=${checked === "mixed"}
          ?disabled=${row.disabled}
        ></bit-checkbox>`
      : nothing;

    // Clamped, not `truncate`: a `nowrap` label's min-content is its full text, so the grid never
    // shrinks it. Tooltipped here, not on the row, which overflows the clipped tree.
    const label = section
      ? html`<span
          data-filter-row-label
          class="${typography("helper", {
            noMargin: true,
          })} tw-me-auto tw-min-w-0 tw-line-clamp-1 tw-break-all tw-font-semibold"
          ${rowTooltip(row.label)}
          >${row.label}</span
        >`
      : html`<span
          data-filter-row-label
          class="tw-me-auto tw-min-w-16 tw-line-clamp-1 tw-break-all"
          ${rowTooltip(row.label)}
          >${row.label}</span
        >`;

    const trailing = section
      ? html`<bit-berry .value=${this.sectionSelectedCount(section)}></bit-berry> ${
            expandable
              ? html`<span
                  data-filter-expander
                  class="tw-ms-1 tw-flex tw-flex-none tw-items-center tw-text-fg-body-subtle"
                  aria-hidden="true"
                  @click=${toggleExpanded}
                >
                  <bit-icon
                    name=${node.expanded ? "bwi-angle-up" : "bwi-angle-down"}
                    class="tw-text-base"
                  ></bit-icon>
                </span>`
              : nothing
          }`
      : this.renderCount(this.optionCount(option!));

    return html`${divider}
      <div
        role="treeitem"
        data-filter-option-row
        ?data-filter-section-row=${!!section}
        ?data-filter-card-top=${node.groupStart}
        ?data-filter-card-bottom=${node.groupEnd}
        class=${option ? optionRowClasses : rowBaseClasses}
        style=${styleMap({
          paddingInlineStart: section ? undefined : `${0.5 + (node.indent - 1) * 1.75}rem`,
        })}
        tabindex=${tabbable ? 0 : -1}
        aria-level=${node.level}
        aria-setsize=${node.setsize}
        aria-posinset=${node.posinset}
        aria-expanded=${expandable ? String(node.expanded) : nothing}
        aria-checked=${checked ?? nothing}
        aria-disabled=${row.disabled ? "true" : nothing}
        .filterNode=${node}
        @click=${() => !row.disabled && this.activateNode(node)}
        @focus=${(event: FocusEvent) => this.onRowFocus(event, node)}
        @blur=${(event: FocusEvent) => this.onRowBlur(event)}
      >
        ${expander}${checkbox}${option ? this.renderIconTile(option) : nothing}${label}${trailing}
      </div>`;
  }

  private renderSectionHeader(section: FilterSectionRow) {
    const helper = typography("helper", { noMargin: true });
    if (section.collapsible) {
      return html`<button
        type="button"
        class="tw-flex tw-w-full tw-items-center tw-gap-2 tw-border-none tw-bg-transparent tw-px-3 tw-py-1.5 tw-text-start tw-text-sm tw-font-semibold tw-text-fg-heading tw-cursor-pointer hover:tw-bg-bg-brand-softer focus-visible:tw-z-10 focus-visible:tw-outline-none focus-visible:tw-ring-2 focus-visible:tw-ring-inset focus-visible:tw-ring-border-focus"
        aria-expanded=${String(section.open)}
        ${tooltip(section.label)}
        @click=${() => section.toggleExpanded()}
      >
        <span class="${helper} tw-min-w-0 tw-flex-1 tw-truncate">${section.label}</span>
        <bit-berry .value=${this.sectionSelectedCount(section)}></bit-berry>
        <bit-icon
          name=${section.open ? "bwi-angle-up" : "bwi-angle-down"}
          class="tw-flex-none tw-text-base tw-text-fg-body-subtle"
          aria-hidden="true"
        ></bit-icon>
      </button>`;
    }
    return html`<div
      class="tw-flex tw-items-center tw-gap-2 tw-px-3 tw-py-1.5 tw-text-sm tw-font-semibold tw-text-fg-body-subtle"
      ${tooltip(section.label)}
    >
      <span class="${helper} tw-min-w-0 tw-flex-1 tw-truncate">${section.label}</span>
      <bit-berry .value=${this.sectionSelectedCount(section)}></bit-berry>
    </div>`;
  }

  private renderFlatList() {
    const unsetLabel = this.unsetLabel ?? t("all");
    const unsetCount = this.filterHost?.optionCount?.(this.key, null);
    return html`<div
      role="group"
      aria-label=${this.placeholderText}
      class="tw-min-h-0 tw-flex-1 tw-overflow-y-auto"
      data-filter-option-list
      data-filter-scroll
    >
      <label data-filter-option-row class=${optionRowClasses} ${tooltip(unsetLabel)}>
        <input
          type="radio"
          class=${radioInputClasses}
          name=${this.radioName}
          .checked=${live(this.isSelected(CLEAR_FILTER))}
          @change=${() => this.toggle(CLEAR_FILTER)}
        />
        <span class="tw-min-w-0 tw-flex-1 tw-truncate">${unsetLabel}</span>
        ${this.renderCount(unsetCount)}
      </label>
      ${this.entries.map((entry, index) => {
        if (entry.kind === "divider") {
          // Gated so a search can't leave a rule with nothing on one side of it.
          return this.dividerVisible(index)
            ? html`<bit-menu-divider data-filter-divider></bit-menu-divider>`
            : nothing;
        }
        const row = entry as FilterRow;
        if (!this.rowVisible(row)) {
          return nothing;
        }
        if (row.kind === "option") {
          return this.renderOptionRow(row as FilterOptionRow);
        }
        const section = row as FilterSectionRow;
        return html`${this.renderSectionHeader(section)}
        ${
          section.open
            ? section.childRows
                .filter((option) => this.rowVisible(option))
                .map((option) => this.renderOptionRow(option))
            : nothing
        }`;
      })}
      ${this.noResults ? this.renderNoResults() : nothing}
    </div>`;
  }

  private renderBody(): TemplateResult {
    const resultCount = this.resultCount;
    return html`<div data-filter-body class="tw-contents">
      ${
        this.showSearch
          ? html`<div data-filter-search-row class="tw-p-1">
              <bit-search
                data-filter-search
                .value=${live(this.searchTerm)}
                @input=${(event: Event) => {
                  event.stopPropagation();
                  this.setSearchTerm((event.target as BitSearch).value);
                }}
                @change=${(event: Event) => event.stopPropagation()}
              ></bit-search>
            </div>`
          : nothing
      }
      ${
        resultCount != null
          ? html`<div
              data-filter-result-count
              class="tw-px-4 tw-pb-1 tw-text-xs tw-font-normal tw-text-fg-body-subtle"
              aria-live="polite"
            >
              ${resultCount === 1 ? t("oneFilterResult") : t("filterResults", resultCount)}
            </div>`
          : nothing
      }
      ${this.multiple ? this.renderTree() : this.renderFlatList()}
    </div>`;
  }

  render() {
    const active = this.active;
    const endIcon = active ? undefined : this.menuOpen ? "bwi-angle-up" : "bwi-angle-down";
    return html`
      <div
        class="${filterChipClasses({
          size: this.size,
          selected: active,
          disabled: this.disabled,
          trailingIcon: active,
        })} tw-gap-1.5 tw-justify-between !tw-ps-0 !tw-py-0"
      >
        <button
          part="trigger"
          type="button"
          class="${triggerClasses} ${triggerPadding[this.size]} ${
            this.disabled ? "tw-cursor-not-allowed" : ""
          } ${this.showDisabledReason ? "tw-pointer-events-auto" : ""}"
          ${ariaDisable(this.disabled)}
          aria-describedby=${this.showDisabledReason ? DISABLED_REASON_ID : nothing}
          ${tooltip(this.triggerTooltip)}
        >
          ${
            this.icon
              ? html`<bit-icon name=${this.icon} class="tw-text-base/5"></bit-icon>`
              : nothing
          }
          <span class="tw-text-start tw-truncate tw-leading-5 tw-min-w-0 tw-flex-1">
            <span class="tw-block tw-min-w-0 tw-truncate">${this.displayLabel}</span>
          </span>
          ${endIcon ? html`<bit-icon name=${endIcon} class="tw-text-base/5"></bit-icon>` : nothing}
        </button>
        ${this.renderDisabledReason()}
        <bit-berry .value=${this.committedCount}></bit-berry>
        ${
          active
            ? html`<button
                data-chip-dismiss
                type="button"
                class=${dismissButtonClasses}
                aria-label=${t("removeItem", this.displayLabel)}
                ${ariaDisable(this.disabled)}
                @click=${() => this.clearFromChip()}
              >
                <bit-icon name="bwi-close"></bit-icon>
              </button>`
            : nothing
        }
      </div>
      <bit-menu menu-role="dialog" label=${this.placeholderText}>
        <!-- The list bleeds into the menu's padding so its scrollbars and dividers reach the
             popover's edge. The 3.25rem keeps the menu inside the 1rem viewport margins. -->
        <div
          class="tw-flex tw-max-h-96 tw-min-w-72 tw-max-w-[min(32rem,calc(100vw-3.25rem))] tw-flex-col [&_[data-filter-scroll]]:-tw-mx-2 [&_[data-filter-scroll]]:-tw-mb-2 [&_[data-filter-scroll]]:tw-px-2 [&_[data-filter-scroll]]:tw-pb-2"
        >
          <!-- Gated on open, so the rows don't also exist while the dialog owns the options. -->
          ${this.menuOpen ? this.renderBody() : nothing}
        </div>
        ${
          this.menuOpen && this.multiple && active
            ? html`<div slot="footer" class="tw-flex tw-items-center tw-gap-2">
                <span class="tw-flex-1 tw-text-xs tw-font-normal tw-text-fg-body-subtle"
                  >${t("filtersSelected", this.selectedCount)}</span
                >
                <bit-button
                  button-type="subtleGhost"
                  size="small"
                  start-icon="bwi-clear"
                  @click=${() => this.clearFromMenu()}
                  >${t("clear")}</bit-button
                >
              </div>`
            : nothing
        }
      </bit-menu>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-filter-menu": BitFilterMenu;
  }
}
