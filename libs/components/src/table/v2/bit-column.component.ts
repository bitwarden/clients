import {
  afterNextRender,
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

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import type { SortDirection, SortFn } from "../table-data-source";

import { BitCellDefDirective } from "./bit-cell-def.directive";
import { BitCellLoadingDirective } from "./bit-cell-loading.directive";
import { BitHeaderCellComponent } from "./bit-header-cell.component";
import { BitTableV2Component } from "./table-v2.component";

/**
 * Declarative column wrapper for `bit-table-v2`. Carries column-level
 * metadata (sortable, defaultSort, sortFn, width). The column key and the
 * row-template come from a `*bitCellDef` child; the header template comes
 * from a `<bit-header-cell>` child.
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

  private readonly cellDir = contentChild(BitCellDefDirective);
  private readonly headerCell = contentChild(BitHeaderCellComponent);
  private readonly loadingDir = contentChild(BitCellLoadingDirective);

  /**
   * Column key, sourced from the `*bitCellDef` child. Returns `undefined`
   * if the column hasn't projected a cell template (transient state during
   * initial render).
   */
  readonly name = computed(() => this.cellDir()?.name());

  /** Template for stamping per-row cells. */
  readonly cellTemplate = computed(() => this.cellDir()?.template);

  /** Template for the header cell, sourced from the `<bit-header-cell>` child. */
  readonly headerTemplate = computed(() => this.headerCell()?.template());

  /** Optional skeleton template for loading rows, from a `bitCellLoading` child. */
  readonly loadingTemplate = computed(() => this.loadingDir()?.template);

  constructor() {
    const table = inject<BitTableV2Component>(forwardRef(() => BitTableV2Component));
    table.register(this);
    inject(DestroyRef).onDestroy(() => table.unregister(this));

    // The column key comes from `*bitCellDef`; without it the column is nameless
    // and silently drops out. Check after the first render — by then a wrapped
    // column's late-resolving binding has settled (see BitCellDefDirective).
    const logService = inject(LogService, { optional: true });
    afterNextRender(() => {
      if (this.name() == null) {
        logService?.warning(
          "bit-table-v2: a `<bit-column>` is missing a `*bitCellDef` and has no column key, " +
            'so it will not render. Add `*bitCellDef="table.columns.<field>"`.',
        );
      }
    });
  }
}
