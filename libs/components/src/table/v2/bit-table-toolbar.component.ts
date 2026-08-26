import {
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChildren,
  effect,
  inject,
  viewChild,
  viewChildren,
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
import {
  OverflowItemDirective,
  OverflowListDirective,
  OverflowTriggerDirective,
} from "../../overflow-list";
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
  imports: [
    I18nPipe,
    IconButtonModule,
    BerryComponent,
    ChipComponent,
    ButtonModule,
    OverflowListDirective,
    OverflowItemDirective,
    OverflowTriggerDirective,
  ],
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

  /** The projected chips, as overflow items — the toolbar feeds these to the list. */
  private readonly projectedItems = contentChildren(OverflowItemDirective, { descendants: true });

  /** Overflow items declared in this template (the "Clear all" button). */
  private readonly localItems = viewChildren(OverflowItemDirective);

  /**
   * Everything competing for the chip row, in DOM order. `bitOverflowList` can't
   * query the projected chips itself (they're this component's content, not the
   * row's), so they're passed in via its `items` input.
   */
  protected readonly overflowItems = computed(() => [
    ...this.projectedItems(),
    ...this.localItems(),
  ]);

  private readonly overflowList = viewChild(OverflowListDirective);

  /**
   * Whether the filter row is collapsed to the single trigger + dialog. Below `md`
   * always; above it, once the chips, "Clear all", and the item count stop fitting
   * on one line. Gated on `ready()` so the first paint doesn't flash the collapsed
   * view before the row has been measured.
   */
  protected readonly collapsed = computed(() => {
    if (!this.isLargeScreen()) {
      return true;
    }
    const list = this.overflowList();
    return (list?.ready() && list.overflow().length > 0) ?? false;
  });

  /** Whether a filter row renders below the search row; gates the divider between the two. */
  protected readonly hasFilterRow = computed(() =>
    this.collapsed() ? this.activeFilters().length > 0 : this.hasFilters(),
  );

  /**
   * The chip row. While collapsed it stays laid out but invisible and out of flow,
   * so `bitOverflowList` can keep measuring it — hiding it with `display: none`
   * would zero every width and bounce it straight back open.
   */
  protected readonly filterRowClasses = computed(() => [
    "tw-flex",
    "tw-flex-wrap",
    "tw-items-center",
    "tw-gap-2",
    "tw-px-5",
    "tw-py-3.5",
    "empty:tw-hidden",
    ...(this.collapsed()
      ? ["tw-invisible", "tw-pointer-events-none", "tw-absolute", "tw-inset-x-0", "tw-top-0"]
      : []),
  ]);

  protected readonly searchRowClasses = computed(() => [
    "tw-flex",
    "tw-flex-wrap",
    "tw-items-center",
    "tw-gap-3",
    // Row gap for when the `slot=end` controls wrap to their own line below `md`.
    "tw-gap-y-4",
    "tw-p-5",
    ...(this.hasFilterRow()
      ? ["tw-border-0", "tw-border-b", "tw-border-solid", "tw-border-border-base"]
      : []),
  ]);

  /**
   * The projected search. Capped on wide viewports so it doesn't run the length of
   * the toolbar; below `md` it fills its row, the `slot=end` controls having moved off.
   */
  protected readonly searchClasses = computed(() => [
    "tw-flex",
    "tw-min-w-0",
    "tw-flex-1",
    ...(this.isLargeScreen() ? ["tw-max-w-[25rem]"] : []),
  ]);

  /**
   * The projected `slot=end` controls. Below `md` they wrap to a full-width line and
   * split it evenly, so a table's actions never crowd the search field.
   */
  protected readonly endSlotClasses = computed(() => [
    "tw-flex",
    "tw-items-center",
    "tw-gap-3",
    ...(this.isLargeScreen() ? ["tw-ms-auto"] : ["tw-w-full", "[&>*]:tw-flex-1"]),
  ]);

  constructor() {
    // Chips and the item count change width in place — a chip's label grows to
    // "Type: Login", the count gains a digit (and its width is what the row reserves
    // for the trigger). `bitOverflowList` only remeasures when the item set changes,
    // so its cached widths would go stale and the collapse decision with them.
    effect(() => {
      for (const filter of this.filters()) {
        filter.active();
        filter.summary();
      }
      this.countDigits();
      this.overflowList()?.remeasure();
    });
  }

  /** An active filter's chip label: `label`, or `label: summary` when it has a summary. */
  protected appliedLabel(filter: FilterPresenter): string {
    const summary = filter.summary();
    return summary ? `${filter.label()}: ${summary}` : filter.label();
  }

  /** Rows matching the active filters — shown as the "N items" count on the filter row. */
  protected readonly itemCount = computed(() => this.table?.filteredCount() ?? 0);

  /** The count's width tracks its digits, not its value — see the remeasure effect. */
  private readonly countDigits = computed(() => String(this.itemCount()).length);

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
