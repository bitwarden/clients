import { ChangeDetectionStrategy, Component } from "@angular/core";

import { OverflowItemDirective } from "../overflow-list";

/**
 * A vertical rule for separating groups of filter chips.
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
    class: "tw-mx-2 tw-inline-block tw-h-6 tw-w-px tw-bg-border-base",
  },
  // Lets a `bitOverflowList` ancestor measure the divider; inert with no such ancestor.
  hostDirectives: [OverflowItemDirective],
})
export class FilterDividerComponent {}
