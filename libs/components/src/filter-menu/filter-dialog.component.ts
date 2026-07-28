import { NgTemplateOutlet } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, inject, signal } from "@angular/core";

import { I18nPipe } from "@bitwarden/ui-common";

import { ButtonModule } from "../button";
import { DIALOG_DATA, DialogModule, DialogRef } from "../dialog";
import { IconComponent } from "../icon";
import { IconButtonModule } from "../icon-button";

import { FilterPresenter } from "./filter-tokens";

/** Data passed to {@link FilterDialogComponent} when the toolbar opens it. */
export interface FilterDialogParams {
  /** The toolbar's projected filters, in row order. */
  readonly filters: readonly FilterPresenter[];
}

/**
 * The small-screen filter view: the toolbar's chip row collapsed into a dialog
 * (a bottom sheet on small screens, via the dialog service's responsive position).
 * The list page shows one row per filter; tapping a filter with options drills
 * into a page that stamps that filter's own options template (the same options its
 * desktop popover shows), and a toggle flips in place. Opened by `bit-table-toolbar`.
 */
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
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FilterDialogComponent {
  private readonly dialogRef = inject(DialogRef);

  /** The filters to present, in row order. */
  protected readonly filters = inject<FilterDialogParams>(DIALOG_DATA).filters;

  /** The filter being drilled into, or `undefined` on the list page. */
  protected readonly activeFilter = signal<FilterPresenter | undefined>(undefined);

  /** How many filters currently have a selection — shown in the footer. */
  protected readonly selectedCount = computed(() => this.filters.filter((f) => f.active()).length);

  /** A row's text: the filter label, plus `": summary"` when it has a selection. */
  protected rowText(filter: FilterPresenter): string {
    const summary = filter.summary();
    return summary ? `${filter.label()}: ${summary}` : filter.label();
  }

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

  /** Dismiss the dialog. Selections apply live, so this just closes. */
  protected close(): void {
    void this.dialogRef.close();
  }
}
