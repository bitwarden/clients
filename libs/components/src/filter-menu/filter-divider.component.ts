import { ChangeDetectionStrategy, Component } from "@angular/core";

/**
 * A vertical rule for separating groups of filter chips in a `bit-table-v2`'s
 * chrome. Purely presentational — drop it between chips in the chip row.
 *
 * @example
 * ```html
 * <bit-filter-menu key="type" placeholderText="Type">…</bit-filter-menu>
 * <bit-filter-divider></bit-filter-divider>
 * <bit-filter-toggle key="favorite" label="Favorites"></bit-filter-toggle>
 * ```
 */
@Component({
  selector: "bit-filter-divider",
  template: "",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: "separator",
    "aria-orientation": "vertical",
    class: "tw-mx-1 tw-inline-block tw-h-6 tw-w-px tw-bg-secondary-500",
  },
})
export class FilterDividerComponent {}
