import { ChangeDetectionStrategy, Component, computed, input, output } from "@angular/core";

import { NoResults } from "@bitwarden/assets/svg";
import { ButtonModule, StatusLockupComponent, SvgComponent } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

/**
 * The empty state shown by the vault items table when there are no rows to display — either because
 * the vault is genuinely empty, or because the active filters exclude every item.
 */
@Component({
  selector: "vault-empty-vault",
  templateUrl: "./empty-vault.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonModule, I18nPipe, StatusLockupComponent, SvgComponent],
})
export class EmptyVaultComponent {
  /** Whether the vault has any items at all, ignoring active filters. */
  readonly hasItems = input.required<boolean>();

  /**
   * Whether at least one chip filter is active, excluding the search term. When true, the
   * "Clear all" button is visible so the user can reset to a full list.
   */
  readonly hasActiveFilters = input.required<boolean>();

  /** Emitted when the user clicks the "Clear all" button. */
  readonly clearFilters = output<void>();

  protected readonly noResultsIcon = NoResults;

  protected readonly titleKey = computed(() =>
    this.hasItems() ? "noMatchingItems" : "noItemsInVault",
  );

  protected readonly descriptionKey = computed(() =>
    this.hasItems() ? "clearFiltersOrTryAnother" : "emptyVaultDescription",
  );
}
