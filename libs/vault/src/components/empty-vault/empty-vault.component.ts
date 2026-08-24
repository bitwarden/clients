import { ChangeDetectionStrategy, Component, computed, inject, input, output } from "@angular/core";

import { NoResults, VaultIcon } from "@bitwarden/assets/svg";
import {
  BitTableV2Component,
  ButtonModule,
  StatusLockupComponent,
  SvgComponent,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { EmptyVaultService } from "./empty-vault.service";

/**
 * The empty state shown by the vault items table when there are no rows to display — either because
 * the vault is genuinely empty, or because the active filters exclude every item.
 */
@Component({
  selector: "vault-empty-vault",
  templateUrl: "./empty-vault.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonModule, I18nPipe, StatusLockupComponent, SvgComponent],
  providers: [EmptyVaultService],
})
export class EmptyVaultComponent {
  private readonly emptyVaultService = inject(EmptyVaultService);
  private readonly table = inject(BitTableV2Component, { optional: true });

  /** The combined filter-chip values from the host table, if any. */
  readonly filterValues = this.table?.filterValues;

  /** Whether the vault has any items at all, ignoring active filters. */
  readonly hasItems = input.required<boolean>();

  /**
   * Whether at least one chip filter is active, excluding the search term. When true, the
   * "Clear all" button is visible so the user can reset to a full list.
   */
  readonly hasActiveFilters = input.required<boolean>();

  /**
   * Whether the Vault chip is set exclusively to "My vault". When true and the vault is genuinely
   * empty, the empty state is scoped to My vault rather than the generic all-vaults message.
   *
   * Route-based My vault detection is handled automatically via {@link EmptyVaultService}; this
   * input covers the filter-chip case where the host table knows the chip state.
   */
  readonly isMyVaultSelected = input(false);

  /** Emitted when the user clicks the "Clear all" button. */
  readonly clearFilters = output<void>();

  /** True when either the route scope or the host-passed chip state indicates My vault. */
  private readonly isMyVault = computed(
    () => this.isMyVaultSelected() || this.emptyVaultService.isMyVaultScope(),
  );

  protected readonly titleKey = computed(() => {
    if (this.hasItems()) {
      return "noMatchingItems";
    }
    if (this.isMyVault()) {
      return "noItemsInMyVault";
    }
    return "noItemsInVault";
  });

  protected readonly descriptionKey = computed(() => {
    if (this.hasItems()) {
      return "clearFiltersOrTryAnother";
    }
    if (this.isMyVault()) {
      return "emptyMyVaultDescription";
    }
    return "emptyVaultDescription";
  });

  protected readonly icon = computed(() => {
    if (this.hasItems()) {
      return NoResults;
    }
    if (this.isMyVault()) {
      return VaultIcon;
    }
    return NoResults;
  });
}
