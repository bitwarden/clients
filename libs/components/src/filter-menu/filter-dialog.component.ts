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

  /** How many filters currently have a selection — shown in the footer. */
  protected readonly selectedCount = computed(() => this.filters.filter((f) => f.active()).length);

  /** Kept out of the template so no whitespace lands between the label and the colon. */
  protected rowLabel(filter: FilterPresenter): string {
    return filter.summary() ? `${filter.label()}:` : filter.label();
  }

  // The rows come from the chip's template, shared with the popover, so the card and
  // dividers are applied from out here.
  protected readonly optionListClasses = [
    "tw-overflow-hidden",
    "tw-rounded-lg",
    "tw-border",
    "tw-border-solid",
    "tw-border-border-base",
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
  }

  /** Clearing removes this button, so hand focus to Done rather than dropping it. */
  protected clearAllAndKeepFocus(): void {
    this.clearAll();
    focusAfterRender(this.injector, () => this.doneButtonEl()?.nativeElement);
  }

  /** Dismiss the dialog. Selections apply live, so this just closes. */
  protected close(): void {
    void this.dialogRef.close();
  }
}
