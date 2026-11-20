import { ChangeDetectionStrategy, Component, forwardRef } from "@angular/core";

import { FILTER_ENTRY, FilterEntry } from "./filter-tokens";

/**
 * Separates groups of options within a `bit-filter-menu`. Declared between top-level
 * entries; nesting it inside a `bit-filter-section` has no effect.
 *
 * The chip draws the separation itself, so this never renders: the popover puts a rule
 * between the rows it divides, and the dialog starts a new card instead.
 *
 * @example
 * ```html
 * <bit-filter-menu key="folder" placeholderText="My folders" multiple>
 *   <bit-filter-option [value]="null">No folders</bit-filter-option>
 *   <bit-filter-option-divider></bit-filter-option-divider>
 *   <bit-filter-option [value]="'work'">Work</bit-filter-option>
 * </bit-filter-menu>
 * ```
 */
@Component({
  selector: "bit-filter-option-divider",
  template: "",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "tw-hidden" },
  providers: [
    { provide: FILTER_ENTRY, useExisting: forwardRef(() => FilterOptionDividerComponent) },
  ],
})
export class FilterOptionDividerComponent implements FilterEntry {
  readonly kind = "divider" as const;
}
