import {
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChildren,
  inject,
} from "@angular/core";

import { I18nPipe } from "@bitwarden/ui-common";

import { FILTER_CONTROL } from "../../filter-menu/filter-tokens";

import { BitTableV2Component } from "./table-v2.component";

/**
 * Toolbar for `bit-table-v2`, rendered inside the table chrome above the header
 * row. Project a `<bit-search>` (its own slot), filter chips (`bit-filter-chip` /
 * `bit-filter-toggle`), and arbitrary controls via `slot="end"`; they lay out in
 * a wrapping row.
 *
 * Filter chips register their values with the table directly via the
 * `bitTableFilter` bridge — the toolbar doesn't own filter state. It does observe
 * its projected filters (by their shared `FILTER_CONTROL` contract) to surface
 * {@link appliedCount}, which drives the responsive collapse: on small screens the
 * chip row folds into a single trigger + dialog, with the count shown as a berry.
 */
@Component({
  selector: "bit-table-toolbar",
  templateUrl: "./bit-table-toolbar.component.html",
  imports: [I18nPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: "tw-block tw-border-0 tw-border-b tw-border-solid tw-border-border-base",
  },
})
export class BitTableToolbarComponent {
  /** The table this toolbar is projected into; the source of the item count. */
  protected readonly table = inject(BitTableV2Component, { optional: true });

  /** The projected filter chips/toggles, matched by their shared `FILTER_CONTROL`. */
  private readonly filters = contentChildren(FILTER_CONTROL, { descendants: true });

  /** How many projected filters currently have a selection — the trigger's berry count. */
  readonly appliedCount = computed(() => this.filters().filter((f) => f.active()).length);

  /** Rows matching the active filters — shown as the "N items" count on the filter row. */
  protected readonly itemCount = computed(() => this.table?.table().filtered().length ?? 0);
}
