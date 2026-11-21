import { ContextConsumer } from "@lit/context";
import { css, html, nothing, PropertyValues } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";

import type { ChipGroupItem } from "../../chips/chip-group/chip-group";
import { BitElement } from "../../core/bit-element";
import { t } from "../../core/i18n";
import type { DialogRef } from "../../dialog/dialog-ref";
import { openFilterDialog } from "../../filter-menu/filter-dialog";
import { isFilterPresenter, selectionCount } from "../../filter-menu/filter-model";
import type { FilterPresenter } from "../../filter-menu/filter-model";
import {
  attachOverflowList,
  OverflowListHandle,
  OverflowListState,
} from "../../overflow-list/attach-overflow-list";
import { measureWidth, observeWidth } from "../../overflow-list/measure";
import "../../berry/berry";
import "../../button/button";
import "../../chips/chip-group/chip-group";
import "../../icon-button/icon-button";

import { SlotAssigner } from "./slot-assignment";
import { BitTableV2, TableRowRange, tableV2Context } from "./table-v2";

/** The narrowest the search gets before the `slot=end` buttons move to their own row. */
const SEARCH_MIN_REM = 15;

/** Tailwind's `sm` breakpoint: narrower toolbars use the compact layout. */
const SM_BREAKPOINT = 640;

type ActiveChip = { chip: ChipGroupItem; clear: () => void };

// Set by `attachCollapseOnScroll` while the behavior is enabled.
const COLLAPSE_ATTR = "bit-collapse-on-scroll";

/**
 * Toolbar for `bit-table-v2`. Place it inside the table and add a `bit-search`, filter chips
 * (`bit-filter-menu`, `bit-filter-toggle`, `bit-filter-divider`) and `slot="end"` controls; each
 * is projected to its place by tag. Chips register with the table directly; the toolbar doesn't
 * own filter state.
 *
 * When the chips stop fitting on one row (and always on a narrow toolbar), the chip row collapses
 * into a single Filters button that opens the responsive filter dialog, with the active filters
 * shown as dismissible chips below.
 *
 * Supports `attachCollapseOnScroll` / `collapseOnScroll()` on the toolbar itself; the page's seam
 * then replaces the toolbar's bottom border.
 *
 * @slot - Filter chips.
 * @slot search - The `bit-search` (assigned automatically).
 * @slot end - Page actions, e.g. "Add".
 * @fires filterDialogOpenChange - `detail` is whether the collapsed filter dialog is open.
 */
@customElement("bit-table-toolbar")
export class BitTableToolbar extends BitElement {
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
      /* Lets the toolbar shrink inside an attachCollapseOnScroll grid on the host. */
      :host([bit-collapse-on-scroll]) .toolbar {
        min-height: 0;
      }
      ::slotted(bit-search) {
        flex: 1 1 0%;
        min-width: 0;
      }
    `,
  ];

  /**
   * Formats the rows on screen for the end of the filter row, e.g. "1–10 of 150 members", in place
   * of the default "N items" count. A function rather than a message key so the consumer owns the
   * noun and its plural forms, including the empty case (`total` 0).
   */
  @property({ attribute: false }) rangeLabel?: (range: TableRowRange) => string;

  /** Whether the collapsed filter dialog is open. Set it to open the dialog from code. */
  @property({ type: Boolean, attribute: "filter-dialog-open" }) filterDialogOpen = false;

  @state() private toolbarWidth = 0;
  @state() private endInline = true;
  @state() private overflowState?: OverflowListState;
  @state() private collapseRegion = false;

  @query("[data-search-row]") private searchRow?: HTMLElement;
  @query("[data-end-group]") private endGroup?: HTMLElement;
  @query("[data-filter-row]") private filterRowEl?: HTMLElement;
  @query("[data-filter-chips]") private filterChipsEl?: HTMLElement;
  @query("[data-count]") private countEl?: HTMLElement;
  @query("[data-clear-all]") private clearAllEl?: HTMLElement;
  @query("[data-active-chip-row]") private activeChipRow?: HTMLElement;
  @query("slot:not([name])") private filterSlot?: HTMLSlotElement;
  @query("slot[name=end]") private endSlot?: HTMLSlotElement;

  /** The collapsed filter button, for anchoring a popover. `undefined` while chips show inline. */
  @query("[data-filter-button]") readonly filterButton?: HTMLElement;

  private readonly tableConsumer = new ContextConsumer(this, {
    context: tableV2Context,
    subscribe: true,
  });
  private readonly slots = new SlotAssigner(this, [
    ["bit-search", "search"],
    ["[slot=end]", "end"],
  ]);
  private overflowList?: OverflowListHandle;
  private stopObservingWidth?: () => void;
  private dialogRef?: DialogRef<unknown, unknown>;
  private remeasureKey = "";
  private stretched = new Set<HTMLElement & { block: boolean }>();
  private readonly attributeObserver = new MutationObserver(() => this.syncCollapseRegion());

  connectedCallback() {
    super.connectedCallback();
    this.slots.connect();
    this.stopObservingWidth = observeWidth(this, (width) => (this.toolbarWidth = width));
    this.attributeObserver.observe(this, { attributeFilter: [COLLAPSE_ATTR] });
    this.syncCollapseRegion();
  }

  private syncCollapseRegion() {
    this.collapseRegion = this.hasAttribute(COLLAPSE_ATTR);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.slots.disconnect();
    this.stopObservingWidth?.();
    this.attributeObserver.disconnect();
    this.overflowList?.destroy();
    this.overflowList = undefined;
    void this.dialogRef?.close();
  }

  private get table(): BitTableV2<any, any, any> | undefined {
    return this.tableConsumer.value;
  }

  /** The filter chips inside this toolbar, matched by their shared presenter contract. */
  private get filters(): (FilterPresenter & HTMLElement)[] {
    return (this.table?.filterControls ?? []).filter(
      (c): c is FilterPresenter & HTMLElement => isFilterPresenter(c) && this.contains(c),
    );
  }

  /** How many options are selected across the filters — the trigger's berry count. */
  get appliedCount(): number {
    return this.filters.reduce((total, filter) => total + selectionCount(filter), 0);
  }

  /** The filter chips and "Clear all", for anchoring a popover. `undefined` while collapsed. */
  get filterChips(): HTMLElement | undefined {
    return this.collapsed ? undefined : this.filterChipsEl;
  }

  /** The filter dialog's list-page row for `key`. `undefined` while closed or drilled in. */
  filterRow(key: string): HTMLElement | undefined {
    const dialog = this.dialogRef?.content as { row?: (key: string) => HTMLElement | undefined };
    return dialog?.row?.(key);
  }

  private get hasFilters(): boolean {
    return this.filters.length > 0;
  }

  private get isList(): boolean {
    return this.table?.presentation === "list";
  }

  /** Unmeasured (0) counts as wide. */
  private get wide(): boolean {
    return this.toolbarWidth === 0 || this.toolbarWidth > SM_BREAKPOINT;
  }

  /**
   * The small-screen layout: a narrow toolbar, or one whose `slot=end` buttons have moved to their
   * own row. Collapses the filters to the trigger and lets the search fill its row.
   */
  private get compact(): boolean {
    return !this.wide || !this.endInline;
  }

  /**
   * Whether the filter row is collapsed to the single trigger + dialog: always in the compact
   * layout, otherwise once the row stops fitting on one line.
   */
  private get collapsed(): boolean {
    if (this.compact) {
      return true;
    }
    const list = this.overflowState;
    return (list?.ready && list.overflow.length > 0) ?? false;
  }

  private get showFilterTrigger(): boolean {
    return this.collapsed && this.hasFilters;
  }

  /** On a wide toolbar the collapse decision isn't known until the chip row has been measured. */
  private get collapseSettled(): boolean {
    return this.compact || (this.overflowState?.ready ?? false);
  }

  private get showCount(): boolean {
    return this.table != null && (this.hasFilters || this.rangeLabel != null);
  }

  private get activeFilters() {
    return this.filters.filter((f) => f.active);
  }

  /** One chip per active filter, or per selected option of a multi-select, each with its clear call. */
  private get activeChips(): ActiveChip[] {
    return this.activeFilters.flatMap((filter): ActiveChip[] => {
      if (filter.multiple && filter.selections.length) {
        // Keyed on label so ids survive removals; repeated labels get a suffix.
        const seen = new Map<string, number>();
        return filter.selections.map((selection) => {
          const n = seen.get(selection.label) ?? 0;
          seen.set(selection.label, n + 1);
          return {
            chip: {
              id: `${filter.key}:${selection.label}${n ? `#${n}` : ""}`,
              label: selection.label,
              accessibleName: `${filter.label}: ${selection.label}`,
              startIcon: filter.icon,
            },
            clear: () => filter.deselect(selection.value),
          };
        });
      }
      const label = filter.summary ? `${filter.label}: ${filter.summary}` : filter.label;
      return [{ chip: { id: filter.key, label }, clear: () => filter.clear() }];
    });
  }

  private get hasFilterRow(): boolean {
    return this.collapsed ? this.activeFilters.length > 0 : this.hasFilters || this.showCount;
  }

  private get rangeText(): string | undefined {
    const range = this.table?.rowRange;
    return range && this.rangeLabel?.(range);
  }

  /**
   * {@link rangeText} split around its "start–end" run (e.g. "1–10"), which renders emphasized.
   * The run is found by its numbers so the consumer's wording and separator can vary by locale; a
   * label without one (e.g. "0 members") renders whole in `before`.
   */
  private get rangeParts() {
    const text = this.rangeText;
    const range = this.table?.rowRange;
    if (text == null || range == null) {
      return undefined;
    }
    const match =
      range.total > 0
        ? new RegExp(`(?<!\\d)${range.start}\\D{1,3}${range.end}(?!\\d)`).exec(text)
        : null;
    if (match == null) {
      return { before: text, range: "", after: "" };
    }
    return {
      before: text.slice(0, match.index),
      range: match[0],
      after: text.slice(match.index + match[0].length),
    };
  }

  protected firstUpdated() {
    this.overflowList = attachOverflowList(this.filterRowEl!, {
      items: () =>
        [
          ...(this.filterSlot?.assignedElements() ?? []),
          ...(this.clearAllEl ? [this.clearAllEl] : []),
        ] as HTMLElement[],
      trigger: () => this.countEl,
      triggerAlwaysShow: true,
      gap: 8,
      onChange: (next) => (this.overflowState = next),
    });
  }

  protected updated(changed: PropertyValues<this>) {
    this.slots.assign();
    this.overflowList?.update();
    this.updateEndInline();
    this.stretchEndButtons();

    // Chips and the count change width in place — a chip's label grows to "Type: Login", the
    // count gains a digit — so the overflow list's cached widths would go stale.
    const key = [
      ...this.filters.map((f) => `${f.active}|${f.summary}`),
      (this.rangeText ?? String(this.table?.filteredCount ?? 0)).length,
      this.appliedCount > 0,
    ].join(";");
    if (key !== this.remeasureKey) {
      this.remeasureKey = key;
      this.overflowList?.remeasure();
    }

    if (changed.has("filterDialogOpen") || this.dialogRef || this.filterDialogOpen) {
      this.reconcileDialog();
    }
  }

  /** Compares against the buttons' natural width, so moving them to their own row can't change the outcome. */
  private updateEndInline() {
    const row = this.searchRow;
    const group = this.endGroup;
    let inline = true;
    if (!this.wide) {
      inline = false;
    } else if (row && group) {
      const buttons = [
        ...Array.from(group.querySelectorAll<HTMLElement>(":scope > bit-button")),
        ...((this.endSlot?.assignedElements() ?? []) as HTMLElement[]),
      ].filter((el) => el.getClientRects().length > 0);
      const gap = parseFloat(getComputedStyle(group).columnGap) || 0;
      const needed =
        buttons.reduce((sum, el) => {
          const prev = el.style.width;
          el.style.width = "max-content";
          const width = measureWidth(el);
          el.style.width = prev;
          return sum + width;
        }, 0) +
        gap * Math.max(0, buttons.length - 1);
      const rowWidth = row.clientWidth;
      if (rowWidth > 0 && needed > 0) {
        const rowGap = parseFloat(getComputedStyle(row).columnGap) || 0;
        const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
        const trigger = this.showFilterTrigger ? this.filterButton : undefined;
        const triggerWidth = trigger ? measureWidth(trigger) + rowGap : 0;
        inline = SEARCH_MIN_REM * rem + triggerWidth + rowGap + needed <= rowWidth;
      }
    }
    if (inline !== this.endInline) {
      this.endInline = inline;
    }
  }

  /** `bit-button` stretches only in its `block` mode, so set it while the buttons fill a row. */
  private stretchEndButtons() {
    const buttons = [
      ...Array.from(this.endGroup?.querySelectorAll(":scope > bit-button") ?? []),
      ...(this.endSlot?.assignedElements() ?? []),
    ] as (HTMLElement & { block?: boolean })[];
    for (const el of buttons) {
      if (typeof el.block !== "boolean") {
        continue;
      }
      const stretchable = el as HTMLElement & { block: boolean };
      if (!this.endInline && !el.block) {
        el.block = true;
        this.stretched.add(stretchable);
      } else if (this.endInline && this.stretched.has(stretchable)) {
        el.block = false;
        this.stretched.delete(stretchable);
      }
    }
  }

  /**
   * Reconciles {@link filterDialogOpen} against the dialog. The trigger gates opening only: a
   * dialog already up stays up when the chip row goes inline, so a resize can't drop a drill-in
   * page or its focus.
   */
  private reconcileDialog() {
    const ref = this.dialogRef;
    if (this.filterDialogOpen && !ref) {
      if (this.showFilterTrigger) {
        this.showFilterDialog();
      } else if (this.collapseSettled) {
        // No trigger could have opened it, so drop the state rather than let it open later.
        this.setDialogOpen(false);
      }
    } else if (!this.filterDialogOpen && ref) {
      void ref.close();
    }
  }

  private setDialogOpen(open: boolean) {
    if (open !== this.filterDialogOpen) {
      this.filterDialogOpen = open;
      this.dispatchEvent(
        new CustomEvent("filterDialogOpenChange", { detail: open, bubbles: true, composed: true }),
      );
    }
  }

  private showFilterDialog() {
    const ref = openFilterDialog(this.filters);
    this.dialogRef = ref;
    void ref.closed.then(() => {
      if (this.dialogRef === ref) {
        this.dialogRef = undefined;
      }
      this.setDialogOpen(false);
    });
  }

  private async clearChip(chip: ChipGroupItem) {
    const focused = document.activeElement;
    const inRow = focused != null && this.activeChipRow?.contains(focused);
    this.activeChips.find((c) => c.chip.id === chip.id)?.clear();
    // Removing the last chip drops its element (or the row).
    if (inRow) {
      await this.updateComplete;
      if (focused?.isConnected) {
        return;
      }
      const group = this.activeChipRow?.querySelector("bit-chip-group");
      (group ?? this.filterButton)?.focus();
    }
  }

  /** Reset every filter's selection. Excludes search. */
  private async clearAll() {
    this.filters.forEach((filter) => filter.clear());
    // Clearing hides this button, so hand focus to the first chip.
    await this.updateComplete;
    this.filters[0]?.focus();
  }

  private renderCount() {
    if (!this.showCount) {
      return nothing;
    }
    const parts = this.rangeParts;
    // Not an overflow item: its width is reserved, so the row collapses before it is crowded out.
    return html`<span
      data-count
      data-testid="table-toolbar-count"
      class="tw-ms-auto tw-whitespace-nowrap tw-text-sm tw-tabular-nums tw-text-fg-body-subtle"
      >${
        parts
          ? html`${parts.before}<span class="tw-font-semibold tw-text-fg-heading"
                >${parts.range}</span
              >${parts.after}`
          : t("itemCount", this.table?.filteredCount ?? 0)
      }</span
    >`;
  }

  protected render() {
    const isList = this.isList;
    const insetX = isList ? "tw-px-3" : "tw-px-5";
    const collapsed = this.collapsed;
    const appliedCount = this.appliedCount;
    // An enabled `attachCollapseOnScroll` on the host draws the page's seam, so the toolbar leaves
    // the border to it. Opted out, the behavior draws nothing and the toolbar keeps its own divider.
    const borderClasses = this.collapseRegion
      ? ""
      : [
          "tw-border-0",
          "tw-border-b",
          "tw-border-solid",
          "tw-transition-colors",
          "tw-duration-200",
          isList && !this.table?.isScrolled ? "tw-border-transparent" : "tw-border-border-base",
        ].join(" ");
    const searchRowClasses = [
      "tw-flex",
      "tw-flex-wrap",
      "tw-items-center",
      "tw-gap-x-3",
      // Row gap for when the `slot=end` controls wrap to their own line on a narrow toolbar.
      "tw-gap-y-4",
      isList ? "tw-py-3" : "tw-py-5",
      insetX,
      ...(this.hasFilterRow && !isList
        ? ["tw-border-0", "tw-border-b", "tw-border-solid", "tw-border-border-base"]
        : []),
    ].join(" ");
    // Collapsed, the chip row stays laid out but invisible so the overflow list can keep
    // measuring it — `display: none` would zero every width and bounce it back open.
    const filterRowClasses = [
      "tw-flex",
      "tw-flex-wrap",
      "tw-items-center",
      "tw-gap-2",
      insetX,
      ...(isList ? ["tw-pt-0", "tw-pb-2"] : ["tw-py-3.5", "tw-min-h-[60px]"]),
      ...(!this.hasFilters && !this.showCount ? ["tw-hidden"] : []),
      ...(collapsed
        ? ["tw-invisible", "tw-pointer-events-none", "tw-absolute", "tw-inset-x-0", "tw-top-0"]
        : []),
    ].join(" ");
    const endClasses = this.endInline
      ? "tw-ms-auto tw-flex tw-items-center tw-gap-3"
      : "tw-w-full tw-grid tw-grid-flow-col tw-auto-cols-fr tw-gap-3 [&>*]:tw-min-w-0";
    const canCustomize = this.table?.canCustomizeColumns ?? false;
    const hasEnd = canCustomize || (this.endSlot?.assignedElements().length ?? 0) > 0;

    return html`<div class="toolbar tw-relative tw-flex tw-flex-col tw-min-w-0 ${borderClasses}">
      <div data-search-row class=${searchRowClasses}>
        <div class="tw-flex tw-min-w-0 tw-flex-1 ${this.compact ? "" : "tw-max-w-[25rem]"}">
          <slot name="search" class="tw-contents"></slot>
        </div>
        ${
          this.showFilterTrigger
            ? html`<div class="tw-relative tw-flex-none">
                <bit-icon-button
                  data-filter-button
                  icon="bwi-sliders"
                  label=${t("filters")}
                  @click=${() => this.setDialogOpen(true)}
                ></bit-icon-button>
                ${
                  appliedCount
                    ? html`<bit-berry
                        class="tw-pointer-events-none tw-absolute tw-end-0 tw-top-0"
                        .value=${appliedCount}
                      ></bit-berry>`
                    : nothing
                }
              </div>`
            : nothing
        }
        <div data-end-group class="${endClasses} ${hasEnd ? "" : "tw-hidden"}">
          ${
            canCustomize
              ? html`<bit-button
                  data-testid="customize-columns"
                  button-type="secondary"
                  start-icon="bwi-grid"
                  @click=${() => this.table?.openCustomizeColumns()}
                  >${t("customize")}</bit-button
                >`
              : nothing
          }
          <slot name="end" class="tw-contents" @slotchange=${() => this.requestUpdate()}></slot>
        </div>
      </div>
      <div data-filter-row class=${filterRowClasses}>
        <div
          data-filter-chips
          class="tw-flex tw-items-center tw-gap-2 ${this.hasFilters ? "" : "tw-hidden"}"
        >
          <slot @slotchange=${() => this.overflowList?.update()}></slot>
          <bit-button
            data-clear-all
            id="bit-table-toolbar_button_clear-all"
            class=${appliedCount ? "" : "tw-hidden"}
            button-type="subtleGhost"
            size="small"
            start-icon="bwi-clear"
            @click=${() => this.clearAll()}
            >${t("clearAll")}</bit-button
          >
        </div>
        ${this.renderCount()}
      </div>
      ${
        collapsed && this.activeFilters.length
          ? html`<div
              data-active-chip-row
              class="${insetX} ${isList ? "tw-pt-0 tw-pb-2" : "tw-py-3"}"
            >
              <bit-chip-group
                dismissible
                .chips=${this.activeChips.map((c) => c.chip)}
                @chipDismiss=${(e: CustomEvent<ChipGroupItem>) => this.clearChip(e.detail)}
              ></bit-chip-group>
            </div>`
          : nothing
      }
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-table-toolbar": BitTableToolbar;
  }
}
