import { Directive, TemplateRef, inject } from "@angular/core";

/**
 * Optional skeleton `<bit-cell>` for a `<bit-column>` while the table is
 * loading — applied structurally, mirroring `*bitCellDef`. The table stamps it
 * (sized to the column's grid track) for each placeholder row; when a column
 * omits it, the table renders a default skeleton cell.
 *
 * @example
 * ```html
 * <bit-column>
 *   <bit-header-cell>Name</bit-header-cell>
 *   <bit-cell *bitCellDef="table.columns.name; let row">{{ row.name }}</bit-cell>
 *   <bit-cell *bitCellLoading><bit-skeleton-text class="tw-w-3/4" /></bit-cell>
 * </bit-column>
 * ```
 */
@Directive({
  selector: "[bitCellLoading]",
})
export class BitCellLoadingDirective {
  readonly template = inject<TemplateRef<void>>(TemplateRef);
}
