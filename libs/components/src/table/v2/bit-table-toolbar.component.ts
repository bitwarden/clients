import { ChangeDetectionStrategy, Component, computed, forwardRef, inject } from "@angular/core";

import { I18nPipe } from "@bitwarden/ui-common";

import { ChipComponent } from "../../chips";
import { IconButtonModule } from "../../icon-button";

import { BitTableV2Component } from "./table-v2.component";

/**
 * Header toolbar for `bit-table-v2`, rendered inside the table chrome above the
 * header row. It's a view over the table's filter state, found via DI: it
 * renders the applied-filters row and handles chip dismissal and clear-all —
 * holding no filter state of its own.
 *
 * A `<bit-search>` is projected into its own slot (rendered first, on the left)
 * and wires to the table's search term automatically. Other left controls (e.g.
 * a Filters menu) use `slot="start"`; actions use `slot="end"`. Append filter
 * chips from those controls by updating the table's `filters` model; the
 * applied-filters row and removal are handled here.
 */
@Component({
  selector: "bit-table-toolbar",
  templateUrl: "./bit-table-toolbar.component.html",
  imports: [IconButtonModule, ChipComponent, I18nPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: "tw-block tw-border-0 tw-border-b tw-border-solid tw-border-border-base",
  },
})
export class BitTableToolbarComponent {
  private readonly table = inject(
    forwardRef(() => BitTableV2Component),
    { optional: true },
  );

  protected readonly applied = computed(() => this.table?.filterModel().appliedFilters() ?? []);

  protected remove(id: string): void {
    this.table?.filterModel().remove(id);
  }

  protected clear(): void {
    this.table?.filterModel().clear();
  }
}
