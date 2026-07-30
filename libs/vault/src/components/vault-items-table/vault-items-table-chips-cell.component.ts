import { ChangeDetectionStrategy, Component, computed, input } from "@angular/core";

import { BitwardenIcon, IconModule, ChipActionComponent } from "@bitwarden/components";

/**
 * Renders a row's shared folder or folder memberships as chips: the first name as a labelled
 * chip, an overflow `+N` chip when more remain, and an em dash when there are none.
 *
 * Shared by the "Shared folders" and "My folders" columns, which differ only in their icon and
 * the names they're given.
 */
@Component({
  selector: "vault-items-table-chips-cell",
  templateUrl: "./vault-items-table-chips-cell.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconModule, ChipActionComponent],
})
export class VaultItemsTableChipsCellComponent {
  /** The membership names, in display order. */
  readonly names = input.required<string[]>();

  /** Leading icon for the first chip. */
  readonly icon = input.required<BitwardenIcon>();

  /**
   * Already-translated accessible label for the empty state, announced in place of the em dash
   * (e.g. "No shared folder"). Supplied by the parent so terminology stays a caller concern.
   */
  readonly emptyLabel = input.required<string>();

  protected readonly first = computed(() => this.names().at(0));

  protected readonly overflow = computed(() => Math.max(0, this.names().length - 1));

  /** The names the `+N` chip stands in for — surfaced as its tooltip and accessible name. */
  protected readonly overflowNames = computed(() => this.names().slice(1).join(", "));
}
