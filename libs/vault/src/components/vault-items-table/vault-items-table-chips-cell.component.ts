import { ChangeDetectionStrategy, Component, computed, inject, input, output } from "@angular/core";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { BitwardenIcon, IconModule, ChipActionComponent } from "@bitwarden/components";

/** One of a row's memberships: the name shown, and the filter value clicking it selects. */
export type VaultItemsTableChip = {
  /** The value the column's filter chip is set to on click — a collection or folder id. */
  value: string;
  /** Already-resolved display name. */
  name: string;
};

/**
 *
 * NOTE: This will be re-worked after CL-1175. Likely, only the mapping logic from
 * VaultItemsTableChip to label and value (for chip select events) will remain.
 *
 * Renders a row's shared folder or folder memberships as chips: the first as a labelled chip that
 * filters the table down to it when activated, an overflow `+N` chip when more remain, and an em
 * dash when there are none.
 *
 * Shared by the "Shared folders" and "My folders" columns, which differ only in their icon, the
 * memberships they're given, and which filter their {@link chipSelect} drives.
 */
@Component({
  selector: "vault-items-table-chips-cell",
  templateUrl: "./vault-items-table-chips-cell.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconModule, ChipActionComponent],
})
export class VaultItemsTableChipsCellComponent {
  private readonly i18nService = inject(I18nService);

  /** The row's memberships, in display order. */
  readonly chips = input.required<VaultItemsTableChip[]>();

  /** Leading icon for the first chip. */
  readonly icon = input.required<BitwardenIcon>();

  /**
   * Already-translated accessible label for the empty state, announced in place of the em dash
   * (e.g. "No shared folder"). Supplied by the parent so terminology stays a caller concern.
   */
  readonly emptyLabel = input.required<string>();

  /** Emits the activated chip's {@link VaultItemsTableChip.value}. */
  readonly chipSelect = output<string>();

  protected readonly first = computed(() => this.chips().at(0));

  protected readonly overflow = computed(() => Math.max(0, this.chips().length - 1));

  /** The names the `+N` chip stands in for — surfaced as its tooltip and accessible name. */
  protected readonly overflowNames = computed(() =>
    this.chips()
      .slice(1)
      .map((chip) => chip.name)
      .join(", "),
  );

  /**
   * Accessible name for the first chip. Its visible text is only the membership name, which
   * doesn't convey that activating it filters. Unlike {@link emptyLabel} the wording is identical
   * for both columns, so it's resolved here rather than passed in.
   */
  protected readonly filterLabel = computed(() => {
    const first = this.first();
    return first ? this.i18nService.t("filterByName", first.name) : "";
  });
}
