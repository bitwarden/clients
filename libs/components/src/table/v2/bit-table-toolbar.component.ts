import {
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChildren,
  inject,
} from "@angular/core";

import { I18nPipe } from "@bitwarden/ui-common";

import { BerryComponent } from "../../berry/berry.component";
import { ButtonModule } from "../../button";
import { ChipComponent } from "../../chips";
import { DialogService } from "../../dialog";
import {
  FilterDialogComponent,
  FilterDialogParams,
} from "../../filter-menu/filter-dialog.component";
import { FILTER_PRESENTER, FilterPresenter } from "../../filter-menu/filter-tokens";
import { IconButtonModule } from "../../icon-button";
import { isAtOrLargerThanBreakpointSignal } from "../../utils/responsive-utils";

import { BitTableV2Component } from "./table-v2.component";

/**
 * Toolbar for `bit-table-v2`, rendered inside the table chrome above the header
 * row. Project a `<bit-search>` (its own slot), filter chips (`bit-filter-menu` /
 * `bit-filter-toggle`), and arbitrary controls via `slot="end"`.
 *
 * Filter chips register their values with the table directly by resolving its
 * `FILTER_HOST` — the toolbar doesn't own filter state. It observes its
 * projected filters (their shared `FILTER_PRESENTER` contract) for the responsive
 * collapse: below `md` the chip row is hidden and replaced by a single trigger
 * (with {@link appliedCount} as a berry) that opens the filters in a dialog. The
 * filter row stays in use on small screens, showing the {@link activeFilters} as
 * dismissible chips that clear on click. On wide screens, a "Clear all" button
 * appears alongside the chips (see {@link clearAll}) once any filter is active.
 */
@Component({
  selector: "bit-table-toolbar",
  templateUrl: "./bit-table-toolbar.component.html",
  imports: [I18nPipe, IconButtonModule, BerryComponent, ChipComponent, ButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: "tw-block tw-border-0 tw-border-b tw-border-solid tw-border-border-base",
  },
})
export class BitTableToolbarComponent {
  private readonly dialogService = inject(DialogService);

  /** The table this toolbar is projected into; the source of the item count. */
  protected readonly table = inject(BitTableV2Component, { optional: true });

  /** Whether the viewport is wide enough for the inline chip row (vs. the dialog). */
  protected readonly isLargeScreen = isAtOrLargerThanBreakpointSignal("md");

  /** The projected filters, matched by their shared `FILTER_PRESENTER` contract. */
  private readonly filters = contentChildren(FILTER_PRESENTER, { descendants: true });

  /** Whether any filter chips are projected — false for a search-only toolbar. */
  protected readonly hasFilters = computed(() => this.filters().length > 0);

  /** How many projected filters currently have a selection — the trigger's berry count. */
  readonly appliedCount = computed(() => this.filters().filter((f) => f.active()).length);

  /** The filters with a selection — shown as dismissible chips on the small-screen filter row. */
  protected readonly activeFilters = computed(() => this.filters().filter((f) => f.active()));

  /** Whether a filter row renders below the search row; gates the divider between the two. */
  protected readonly hasFilterRow = computed(() =>
    this.isLargeScreen() ? this.hasFilters() : this.activeFilters().length > 0,
  );

  protected readonly searchRowClasses = computed(() => [
    "tw-flex",
    "tw-flex-wrap",
    "tw-items-center",
    "tw-gap-3",
    "tw-p-5",
    ...(this.hasFilterRow()
      ? ["tw-border-0", "tw-border-b", "tw-border-solid", "tw-border-border-base"]
      : []),
  ]);

  /** An active filter's chip label: `label`, or `label: summary` when it has a summary. */
  protected appliedLabel(filter: FilterPresenter): string {
    const summary = filter.summary();
    return summary ? `${filter.label()}: ${summary}` : filter.label();
  }

  /** Rows matching the active filters — shown as the "N items" count on the filter row. */
  protected readonly itemCount = computed(() => this.table?.filteredCount() ?? 0);

  /** Opens the projected filters in a dialog (a bottom sheet on small screens). */
  protected openFilterDialog(): void {
    this.dialogService.open<unknown, FilterDialogParams>(FilterDialogComponent, {
      data: { filters: this.filters() },
    });
  }

  /**
   * Reset every projected filter's selection. Deliberately scoped to filter chips and
   * excludes search.
   * Mirrors {@link FilterDialogComponent.clearAll}.
   */
  protected clearAll(): void {
    this.filters().forEach((filter) => filter.clear());
  }
}
