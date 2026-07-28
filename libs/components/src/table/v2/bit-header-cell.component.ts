import { NgTemplateOutlet } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  forwardRef,
  inject,
  TemplateRef,
  viewChild,
} from "@angular/core";

import { IconComponent } from "../../icon";

import { BitColumnComponent } from "./bit-column.component";
import { BitTableV2Component } from "./table-v2.component";

/**
 * A header cell. Defines its rendered markup — a `<div role="columnheader">`
 * with cell sizing, wrapping the projected content in a sort button when the
 * surrounding `<bit-column>` is sortable — inside an `<ng-template>` exposed
 * via {@link template}.
 *
 * Two render paths share that one template:
 * - Column-def mode: the cell sits inside a `<bit-column>`, which reads
 *   {@link template} and lets `<bit-table-v2>` stamp it into the header row.
 *   The component host itself is an unprojected content child of the empty
 *   `<bit-column>`, so it never renders; only the stamped template does.
 * - Manual mode: the cell is projected directly into a `<bit-header-row>`
 *   with no `<bit-column>` ancestor, so it stamps its own template inline
 *   (see `manual()`). The `display: contents` host makes the rendered
 *   `columnheader` div the direct grid item of the row.
 *
 * Either way the cell finds its column and table via DI on the element
 * injector, and `aria-sort` is applied to the rendered div (the semantic
 * owner) rather than the component host.
 */
@Component({
  selector: "bit-header-cell",
  templateUrl: "./bit-header-cell.component.html",
  imports: [NgTemplateOutlet, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: "tw-contents",
  },
})
export class BitHeaderCellComponent {
  private readonly column = inject(
    forwardRef(() => BitColumnComponent),
    { optional: true },
  );
  private readonly table = inject(
    forwardRef(() => BitTableV2Component),
    { optional: true },
  );

  /** The rendered header markup, stamped by `<bit-table-v2>` in column-def mode. */
  readonly template = viewChild.required<TemplateRef<void>>("tpl");

  /** True when there's no owning column, so the cell renders itself inline. */
  protected readonly manual = computed(() => this.column == null);

  /**
   * Whether to render the sort affordance. The column must opt in via `sortable`,
   * and the table must be in `table` presentation — `list` presentation hides the
   * header visually, so a sort button there would be a focusable, invisible
   * control. (Until a list-mode sort control exists, list mode is unsortable.)
   */
  protected readonly sortable = computed(
    () => (this.column?.sortable() ?? false) && this.table?.presentation() !== "list",
  );

  protected readonly active = computed(() => {
    if (!this.column) {
      return false;
    }
    return this.table?.sort()?.column === this.column.name();
  });

  protected readonly ariaSort = computed(() => {
    if (!this.sortable()) {
      return undefined;
    }
    const sort = this.table?.sort();
    if (sort?.column !== this.column?.name()) {
      return undefined;
    }
    return sort.direction === "asc" ? "ascending" : "descending";
  });

  protected readonly sortIcon = computed(() => {
    const sort = this.table?.sort();
    if (!this.column || sort?.column !== this.column.name()) {
      return "bwi-up-down-btn";
    }
    return sort.direction === "asc" ? "bwi-up-solid" : "bwi-down-solid";
  });

  protected onSortClick(): void {
    if (this.column && this.table) {
      this.table.toggleSort(this.column);
    }
  }

  protected readonly sortButtonClasses = [
    "tw-min-w-max",
    "tw-font-medium",
    "tw-border",
    "tw-border-solid",
    "tw-rounded",
    "tw-transition",
    "hover:tw-no-underline",
    "focus:tw-outline-none",
    "tw-bg-transparent",
    "!tw-text-muted",
    "tw-border-transparent",
    "hover:tw-bg-transparent-hover",
    "hover:tw-border-primary-700",
    "focus-visible:before:tw-ring-primary-700",
    "disabled:tw-opacity-60",
    "disabled:hover:tw-border-transparent",
    "disabled:hover:tw-bg-transparent",
    "tw-relative",
    "before:tw-content-['']",
    "before:tw-block",
    "before:tw-absolute",
    "before:-tw-inset-[3px]",
    "before:tw-rounded-md",
    "before:tw-transition",
    "before:tw-ring",
    "before:tw-ring-transparent",
    "focus-visible:tw-z-10",
  ];
}
