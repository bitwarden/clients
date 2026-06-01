import { NgTemplateOutlet } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, forwardRef, inject } from "@angular/core";

import { BitColumnComponent } from "./bit-column.component";
import { BitTableV2Component } from "./table-v2.component";

/**
 * A header cell. Renders a `<div role="columnheader">` internally with cell
 * sizing and, when the surrounding `<bit-column>` is sortable, wraps the
 * projected content in a sort button. `aria-sort` is applied to the rendered
 * div (the semantic owner) rather than the component host.
 *
 * The component host is `display: contents` so the inner header div becomes
 * the direct grid item of the parent `<bit-header-row>`.
 *
 * Finds its column and table via the template's *declaration* injector tree
 * — the header template is declared inside `<bit-column>` inside
 * `<bit-table-v2>`, so element-injector lookups walk that chain regardless
 * of where the table stamps the template.
 */
@Component({
  selector: "bit-header-cell",
  templateUrl: "./bit-header-cell.component.html",
  imports: [NgTemplateOutlet],
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

  protected readonly sortable = computed(() => this.column?.sortable() ?? false);

  protected readonly active = computed(() => {
    if (!this.column) {
      return false;
    }
    return this.table?.sort()?.column === this.column.name();
  });

  protected readonly ariaSort = computed(() => {
    if (!this.column || !this.column.sortable()) {
      return undefined;
    }
    const sort = this.table?.sort();
    if (sort?.column !== this.column.name()) {
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
