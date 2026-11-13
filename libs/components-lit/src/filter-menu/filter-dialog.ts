import { html, nothing, PropertyValues } from "lit";
import { customElement, property, query, queryAll, state } from "lit/decorators.js";
import { repeat } from "lit/directives/repeat.js";

import { BitElement } from "../core/bit-element";
import { t } from "../core/i18n";
import type { DialogRef } from "../dialog/dialog-ref";
import { openDialog } from "../dialog/dialog-service";
import type { OverflowListState } from "../overflow-list/attach-overflow-list";
import { tooltip } from "../tooltip/tooltip-directive";
import "../button/button";
import "../dialog/dialog";
import "../icon/icon";
import "../icon-button/icon-button";
import "../overflow-list/overflow-list";

import { FilterPresenter, selectionCount } from "./filter-model";

/** Data passed to `bit-filter-dialog` when a toolbar opens it. */
export interface FilterDialogParams {
  /** The toolbar's filters, in row order. */
  readonly filters: readonly FilterPresenter[];
}

// The rows come from the chip's template, shared with the popover, so the card and dividers are
// applied from out here. The card lands on the row list rather than this wrapper so the in-menu
// search and result count stay outside it, per spec. The list scrolls, which already clips its
// rows to the rounded corners.
const optionListClasses = [
  // The popover insets the search to line up with its rows; here the card spans the full width,
  // so drop the inset and use the spec's 12px gaps above the list.
  "[&_[data-filter-search-row]]:tw-px-0",
  "[&_[data-filter-search-row]]:tw-pb-3",
  "[&_[data-filter-result-count]]:tw-pb-3",
  // Single-select is one flat card around the whole list.
  "[&_[data-filter-option-list]]:tw-rounded-lg",
  "[&_[data-filter-option-list]]:tw-border",
  "[&_[data-filter-option-list]]:tw-border-solid",
  "[&_[data-filter-option-list]]:tw-border-border-base",
  "[&_[data-filter-option-row]]:tw-rounded-none",
  "[&_[data-filter-option-row]]:tw-border-0",
  "[&_[data-filter-option-row]]:tw-border-b",
  "[&_[data-filter-option-row]]:tw-border-solid",
  "[&_[data-filter-option-row]]:tw-border-border-base",
  "[&_[data-filter-option-list]>[data-filter-option-row]:last-child]:tw-border-b-0",
  // Multi-select draws a card per group instead, so a section reads as an accordion over its own
  // options rather than a header inside one long list.
  "[&_[data-filter-card-list]_[data-filter-option-row]]:tw-border-x",
  // `!` where the utility ties with the `tw-rounded-none`/`tw-border-0` above on specificity.
  "[&_[data-filter-card-top]]:!tw-rounded-t-lg",
  "[&_[data-filter-card-top]]:!tw-border-t",
  "[&_[data-filter-card-bottom]]:!tw-rounded-b-lg",
  "[&_[data-filter-card-bottom]:not(:last-child)]:tw-mb-3",
  // A divider reads as the gap between two cards, so the popover's rule is dropped.
  "[&_[data-filter-divider]]:tw-hidden",
  // The accordion bar: tinted, label inset 12px. The tint is what marks it as a header, so its
  // label keeps the option rows' weight — unlike the popover, where there is no tint to do that.
  "[&_[data-filter-section-row]]:tw-bg-bg-secondary",
  "[&_[data-filter-section-row]]:tw-ps-3",
  "[&_[data-filter-section-row]_[data-filter-row-label]]:tw-font-normal",
].join(" ");

/** Kept out of the template so no whitespace lands between the label and the colon. */
function rowLabel(filter: FilterPresenter): string {
  return filter.summary ? `${filter.label}:` : filter.label;
}

/**
 * The row's full text for its tooltip. Unlike {@link rowLabel} this keeps the summary, since the
 * row truncates its label and hides any selection past the first few behind a `+N`.
 */
function rowTooltip(filter: FilterPresenter): string {
  return filter.summary ? `${filter.label}: ${filter.summary}` : filter.label;
}

/**
 * The small-screen filter view: a row per filter, drilling into a filter's options or flipping a
 * toggle in place. Open it with {@link openFilterDialog}.
 */
@customElement("bit-filter-dialog")
export class BitFilterDialog extends BitElement {
  /** The filters, in row order. */
  @property({ attribute: false }) filters: readonly FilterPresenter[] = [];

  /** The filter being drilled into, or `undefined` on the list page. */
  @state() private activeFilter?: FilterPresenter;

  /** `+N` per filter row, from its overflow list. */
  @state() private overflowCounts = new Map<string, number>();

  @query("[data-done]") private doneButton?: HTMLElement;

  /** The list page's rows, in `filters` order. Empty while drilled into a filter. */
  @queryAll("[data-filter-row]") private rowEls!: NodeListOf<HTMLElement>;

  private unsubscribes: (() => void)[] = [];

  /** Set by `openDialog`. */
  set data(data: FilterDialogParams | undefined) {
    this.filters = data?.filters ?? [];
  }

  /** The list page's row for filter `key`, for anchoring a popover. */
  row(key: string): HTMLElement | undefined {
    const index = this.filters.findIndex((filter) => filter.key === key);
    return this.rowEls[index];
  }

  connectedCallback() {
    super.connectedCallback();
    this.subscribeAll();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.unsubscribeAll();
  }

  protected willUpdate(changed: PropertyValues<this>) {
    if (changed.has("filters") && this.isConnected) {
      this.subscribeAll();
      if (this.activeFilter && !this.filters.includes(this.activeFilter)) {
        this.activeFilter = undefined;
      }
    }
  }

  private subscribeAll() {
    this.unsubscribeAll();
    this.unsubscribes = this.filters.map((filter) => filter.subscribe(() => this.requestUpdate()));
  }

  private unsubscribeAll() {
    this.unsubscribes.forEach((unsubscribe) => unsubscribe());
    this.unsubscribes = [];
  }

  /** How many options are selected across every filter, or in the drilled-into one. */
  private get footerSelectedCount(): number {
    const filters = this.activeFilter ? [this.activeFilter] : this.filters;
    return filters.reduce((total, filter) => total + selectionCount(filter), 0);
  }

  /** A row tap: drill into a filter that has options, or flip a toggle in place. */
  private select(filter: FilterPresenter) {
    if (filter.optionsTemplate()) {
      this.activeFilter = filter;
    } else {
      filter.flip();
    }
  }

  private back() {
    this.activeFilter = undefined;
  }

  /** Clearing removes the button that was clicked, so move focus rather than drop it. */
  private async clearAndKeepFocus() {
    if (this.activeFilter) {
      this.activeFilter.clear();
    } else {
      this.filters.forEach((filter) => filter.clear());
    }
    await this.updateComplete;
    this.doneButton?.focus();
  }

  private onOverflow(key: string, event: CustomEvent<OverflowListState>) {
    const count = event.detail.overflow.length;
    if (this.overflowCounts.get(key) !== count) {
      this.overflowCounts = new Map(this.overflowCounts).set(key, count);
    }
  }

  private renderRow(filter: FilterPresenter) {
    const selections = filter.selections;
    return html`<button
      data-filter-row
      type="button"
      class="tw-flex tw-w-full tw-items-center tw-gap-3 tw-rounded-lg tw-border tw-border-solid tw-border-secondary-300 tw-bg-transparent tw-p-3 tw-text-start tw-text-main tw-cursor-pointer hover:tw-bg-secondary-100 focus-visible:tw-outline-none focus-visible:tw-ring-2 focus-visible:tw-ring-inset focus-visible:tw-ring-border-focus"
      ${tooltip(rowTooltip(filter))}
      @click=${() => this.select(filter)}
    >
      <!-- Rendered only when active: the spec lets an inactive row's icon take the dot's place
           rather than holding the column open. -->
      ${
        filter.active
          ? html`<span class="tw-size-2 tw-flex-none tw-rounded-full tw-bg-bg-brand"></span>`
          : nothing
      }
      ${
        filter.icon
          ? html`<bit-icon name=${filter.icon} class="tw-flex-none" aria-hidden="true"></bit-icon>`
          : nothing
      }
      <span class="tw-flex tw-min-w-0 tw-flex-1 tw-items-center tw-gap-1">
        <span class="tw-truncate">${rowLabel(filter)}</span>
        ${
          selections.length
            ? html`<bit-overflow-list
                gap="4"
                class="tw-min-w-0 tw-flex-1 tw-text-fg-body"
                @overflowChange=${(event: CustomEvent<OverflowListState>) =>
                  this.onOverflow(filter.key, event)}
              >
                ${selections.map(
                  (selection, index) =>
                    html`<span class="tw-whitespace-nowrap"
                      >${
                        index === selections.length - 1 ? selection.label : `${selection.label},`
                      }</span
                    >`,
                )}
                <span slot="trigger" class="tw-whitespace-nowrap"
                  >+${this.overflowCounts.get(filter.key) ?? 0}</span
                >
              </bit-overflow-list>`
            : nothing
        }
      </span>
      ${
        filter.optionsTemplate()
          ? html`<bit-icon
              name="bwi-angle-right"
              class="tw-flex-none tw-text-fg-body-subtle"
            ></bit-icon>`
          : nothing
      }
    </button>`;
  }

  render() {
    const filter = this.activeFilter;
    const count = this.footerSelectedCount;
    return html`<bit-dialog heading=${filter?.label ?? t("filter")} dialog-size="default">
      ${
        filter
          ? html`<bit-icon-button
              slot="header-start"
              icon="bwi-angle-left"
              button-type="primaryGhost"
              size="small"
              label=${t("back")}
              @click=${() => this.back()}
            ></bit-icon-button>`
          : nothing
      }
      ${
        filter
          ? html`<div class=${optionListClasses}>${filter.optionsTemplate()}</div>`
          : html`<div class="tw-flex tw-flex-col tw-gap-2">
              ${repeat(
                this.filters,
                (f) => f.key,
                (f) => this.renderRow(f),
              )}
            </div>`
      }
      ${
        count
          ? html`<span slot="footer" class="tw-text-sm tw-text-fg-body-subtle"
                >${t("filtersSelected", count)}</span
              >
              <bit-button
                slot="footer"
                button-type="secondary"
                class="tw-ms-auto"
                start-icon="bwi-clear"
                @click=${() => this.clearAndKeepFocus()}
                >${filter ? t("clear") : t("clearAll")}</bit-button
              >`
          : nothing
      }
      <bit-button
        slot="footer"
        button-type="primary"
        class=${count ? "" : "tw-ms-auto"}
        data-done
        data-bit-dialog-close
        >${t("done")}</bit-button
      >
    </bit-dialog>`;
  }
}

/** Opens the responsive filter dialog over `filters`. Replaces `DialogService.open(FilterDialogComponent)`. */
export function openFilterDialog(
  filters: readonly FilterPresenter[],
): DialogRef<unknown, FilterDialogParams> {
  return openDialog<unknown, FilterDialogParams>("bit-filter-dialog", { data: { filters } });
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-filter-dialog": BitFilterDialog;
  }
}
