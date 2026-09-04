import { NgTemplateOutlet } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  computed,
  inject,
  signal,
  viewChild,
} from "@angular/core";

import { I18nPipe } from "@bitwarden/ui-common";

import { ButtonModule } from "../button";
import { DIALOG_DATA, DialogModule, DialogRef } from "../dialog";
import { IconComponent } from "../icon";
import { IconButtonModule } from "../icon-button";
import {
  OverflowItemDirective,
  OverflowListDirective,
  OverflowTriggerDirective,
} from "../overflow-list";
import { focusAfterRender } from "../utils/focus-after-render";

import { FilterPresenter } from "./filter-tokens";

/** Data passed to {@link FilterDialogComponent} when the toolbar opens it. */
export interface FilterDialogParams {
  /** The toolbar's projected filters, in row order. */
  readonly filters: readonly FilterPresenter[];
}

/** A toggle reports no labels, so its `active` state stands in for its one selection. */
function optionCount(filter: FilterPresenter): number {
  return Math.max(filter.summaryLabels().length, filter.active() ? 1 : 0);
}

/** The small-screen filter view. Opened by `bit-table-toolbar`. */
@Component({
  selector: "bit-filter-dialog",
  templateUrl: "./filter-dialog.component.html",
  imports: [
    NgTemplateOutlet,
    DialogModule,
    ButtonModule,
    IconButtonModule,
    IconComponent,
    I18nPipe,
    OverflowListDirective,
    OverflowItemDirective,
    OverflowTriggerDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FilterDialogComponent {
  private readonly dialogRef = inject(DialogRef);
  private readonly injector = inject(Injector);

  private readonly doneButtonEl = viewChild("doneButton", { read: ElementRef<HTMLElement> });

  /** The filters to present, in row order. */
  protected readonly filters = inject<FilterDialogParams>(DIALOG_DATA).filters;

  /** The filter being drilled into, or `undefined` on the list page. */
  protected readonly activeFilter = signal<FilterPresenter | undefined>(undefined);

  /** How many options are selected across every filter — shown in the list page's footer. */
  protected readonly selectedCount = computed(() =>
    this.filters.reduce((total, filter) => total + optionCount(filter), 0),
  );

  /** The same count for the filter being drilled into. */
  protected readonly activeSelectedCount = computed(() => {
    const filter = this.activeFilter();
    return filter ? optionCount(filter) : 0;
  });

  /** Kept out of the template so no whitespace lands between the label and the colon. */
  protected rowLabel(filter: FilterPresenter): string {
    return filter.summary() ? `${filter.label()}:` : filter.label();
  }

  // The rows come from the chip's template, shared with the popover, so the card and
  // dividers are applied from out here. The card lands on the row list rather than this
  // wrapper so the in-menu search and result count stay outside it, per spec. The list
  // scrolls, which already clips its rows to the rounded corners.
  protected readonly optionListClasses = [
    // The popover insets the search to line up with its rows; here the card spans the
    // full width, so drop the inset and use the spec's 12px gaps above the list.
    "[&_[data-filter-search-row]]:tw-px-0",
    "[&_[data-filter-search-row]]:tw-pb-3",
    "[&_[data-filter-result-count]]:tw-pb-3",
    "[&_[data-filter-option-list]]:tw-rounded-lg",
    "[&_[data-filter-option-list]]:tw-border",
    "[&_[data-filter-option-list]]:tw-border-solid",
    "[&_[data-filter-option-list]]:tw-border-border-base",
    "[&_[data-filter-option-row]]:tw-rounded-none",
    "[&_[data-filter-option-row]]:tw-border-0",
    "[&_[data-filter-option-row]]:tw-border-b",
    "[&_[data-filter-option-row]]:tw-border-solid",
    "[&_[data-filter-option-row]]:tw-border-border-base",
    "[&_[data-filter-option-row]:last-child]:tw-border-b-0",
  ].join(" ");

  /** A row tap: drill into a filter that has options, or flip a toggle in place. */
  protected select(filter: FilterPresenter): void {
    if (filter.optionsTemplate()) {
      this.activeFilter.set(filter);
    } else {
      filter.flip();
    }
  }

  /** Return from a drill-in page to the list. */
  protected back(): void {
    this.activeFilter.set(undefined);
  }

  /** Reset every filter's selection. */
  protected clearAll(): void {
    this.filters.forEach((filter) => filter.clear());
    this.keepFocusOnDone();
  }

  /** Reset just the filter being drilled into. */
  protected clearActive(): void {
    this.activeFilter()?.clear();
    this.keepFocusOnDone();
  }

  /** Clearing removes the button that was clicked, so move focus rather than drop it. */
  private keepFocusOnDone(): void {
    focusAfterRender(this.injector, () => this.doneButtonEl()?.nativeElement);
  }

  /** Dismiss the dialog. Selections apply live, so this just closes. */
  protected close(): void {
    void this.dialogRef.close();
  }
}
