import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  TemplateRef,
  contentChild,
  forwardRef,
  inject,
  input,
} from "@angular/core";

import type { SortDirection, SortFn } from "../table-data-source";

import { BitTableV2Component } from "./table-v2.component";

/**
 * Declarative column definition for `bit-table-v2`.
 *
 * Registers itself with the nearest ancestor `<bit-table-v2>` via DI, so the
 * `<bit-column>` element can appear anywhere in the descendant tree — including
 * inside wrapper components. The table reads columns by `name` from the
 * `displayedColumns` input.
 */
@Component({
  selector: "bit-column",
  template: "",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BitColumnComponent {
  /** Column key. Used as the data-property accessor when no cell template is provided. */
  readonly name = input.required<string>();

  /** Plain-text header. Leave blank for headerless columns (e.g. action menus). */
  readonly header = input<string>("");

  /** CSS width (e.g. `120px`, `20%`). Applied to both `<th>` and `<td>`. */
  readonly width = input<string>();

  /** Enable click-to-sort on this column's header. */
  readonly sortable = input(false, { transform: booleanAttribute });

  /**
   * Apply this sort direction as the initial sort. Only one column should set
   * this per table; if multiple do, the first one registered wins.
   */
  readonly defaultSort = input<SortDirection>();

  /** Custom sort comparator. See {@link SortFn}. */
  readonly sortFn = input<SortFn>();

  /** Cell renderer. Receives the row as `$implicit` context. */
  readonly cellTemplate = contentChild(TemplateRef);

  constructor() {
    const table = inject<BitTableV2Component>(forwardRef(() => BitTableV2Component));
    table.register(this);
    inject(DestroyRef).onDestroy(() => table.unregister(this));
  }
}
