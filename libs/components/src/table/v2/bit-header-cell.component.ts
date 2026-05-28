import { ChangeDetectionStrategy, Component, computed, forwardRef, inject } from "@angular/core";

import { BIT_COLUMN_CONTEXT } from "./bit-column-context";
import { BitTableV2Component } from "./table-v2.component";

/**
 * Styles and renders a header cell. Consumers write `<th bit-cell>` inside a
 * `*bitColumnHeader` template; the component wraps projected content in a
 * sort button when the surrounding `<bit-column>` is sortable, and exposes
 * `aria-sort` on the host.
 *
 * The column it belongs to comes from the table-provided
 * {@link BIT_COLUMN_CONTEXT}, set on the wrapper that stamps the header
 * template.
 */
@Component({
  selector: "th[bit-cell]",
  templateUrl: "./bit-header-cell.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: "tw-h-12 tw-px-3 tw-py-0 tw-text-sm tw-font-medium tw-text-start tw-align-middle",
    "[attr.aria-sort]": "ariaSort()",
  },
})
export class BitHeaderCellComponent {
  private readonly ctx = inject(BIT_COLUMN_CONTEXT, { optional: true });
  private readonly table = inject(
    forwardRef(() => BitTableV2Component),
    { optional: true },
  );

  protected readonly column = computed(() => this.ctx?.bitColumnContext());
  protected readonly sortable = computed(() => this.column()?.sortable() ?? false);

  protected readonly active = computed(() => {
    const col = this.column();
    if (!col) {
      return false;
    }
    return this.table?.dataSource()?.sort?.column === col.name();
  });

  protected readonly ariaSort = computed(() => {
    const col = this.column();
    if (!col || !col.sortable()) {
      return undefined;
    }
    const sort = this.table?.dataSource()?.sort;
    if (sort?.column !== col.name()) {
      return undefined;
    }
    return sort.direction === "asc" ? "ascending" : "descending";
  });

  protected readonly sortIcon = computed(() => {
    const sort = this.table?.dataSource()?.sort;
    const col = this.column();
    if (!col || sort?.column !== col.name()) {
      return "bwi-up-down-btn";
    }
    return sort.direction === "asc" ? "bwi-up-solid" : "bwi-down-solid";
  });

  protected onSortClick(): void {
    const col = this.column();
    if (col && this.table) {
      this.table.toggleSort(col);
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
