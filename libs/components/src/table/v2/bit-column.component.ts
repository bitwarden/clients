import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  contentChild,
  forwardRef,
  inject,
  input,
} from "@angular/core";

import type { SortDirection, SortFn } from "../table-data-source";

import { BitColumnForDirective } from "./bit-column-for.directive";
import { BitColumnHeaderDirective } from "./bit-column-header.directive";
import { BitTableV2Component } from "./table-v2.component";

/**
 * Declarative column wrapper for `bit-table-v2`. Carries column-level
 * metadata (sortable, defaultSort, sortFn, width). The column key and the
 * row-template come from a `*bitColumnFor` child; the header template comes
 * from a `*bitColumnHeader` child.
 *
 * Registers itself with the nearest ancestor `<bit-table-v2>` via DI so the
 * column can sit anywhere in the descendant tree — including inside a wrapper
 * component.
 */
@Component({
  selector: "bit-column",
  template: "",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BitColumnComponent {
  /** Enable click-to-sort on this column's header. */
  readonly sortable = input(false, { transform: booleanAttribute });

  /**
   * Apply this sort direction as the initial sort. Only one column should set
   * this per table; if multiple do, the first registered wins.
   */
  readonly defaultSort = input<SortDirection>();

  /** Custom sort comparator. */
  readonly sortFn = input<SortFn>();

  /**
   * Grid track size for this column. Any valid `grid-template-columns` track
   * value works: `"120px"`, `"1fr"`, `"max-content"`, `"minmax(240px, 480px)"`.
   * Defaults to `"1fr"` (equal share of remainder) when unset.
   *
   * Caveat: intrinsic sizing keywords (`max-content`, `min-content`, `auto`)
   * compute per-row in the current grid implementation, so they won't
   * cross-align under virtualization. Use explicit pixel widths or `fr`
   * units when alignment across rows matters.
   */
  readonly width = input<string>();

  private readonly cellDir = contentChild(BitColumnForDirective);
  private readonly headerDir = contentChild(BitColumnHeaderDirective);

  /**
   * Column key, sourced from the `*bitColumnFor` child. Returns `undefined`
   * if the column hasn't projected a cell template (transient state during
   * initial render).
   */
  readonly name = computed(() => this.cellDir()?.name());

  /** Template for stamping per-row cells. */
  readonly cellTemplate = computed(() => this.cellDir()?.template);

  /** Template for the header cell. */
  readonly headerTemplate = computed(() => this.headerDir()?.template);

  constructor() {
    const table = inject<BitTableV2Component>(forwardRef(() => BitTableV2Component));
    table.register(this);
    inject(DestroyRef).onDestroy(() => table.unregister(this));
  }
}
