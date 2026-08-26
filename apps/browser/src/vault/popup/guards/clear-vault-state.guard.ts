import { inject } from "@angular/core";
import { CanDeactivateFn } from "@angular/router";
import { map, take } from "rxjs";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";

import { VaultComponent } from "../components/vault/vault.component";
import { VaultPopupItemsService } from "../services/vault-popup-items.service";
import { VaultPopupListFiltersService } from "../services/vault-popup-list-filters.service";
import { VaultPopupListTableFiltersService } from "../services/vault-popup-list-table-filters.service";

/**
 * Guard to clear the vault state (search and filter) when navigating away from the vault view.
 * This ensures the search and filter state is reset when navigating between different tabs,
 * except viewing or editing a cipher.
 */
export const clearVaultStateGuard: CanDeactivateFn<VaultComponent> = (
  component: VaultComponent,
  currentRoute,
  currentState,
  nextState,
) => {
  if (!nextState || isCipherOpen(nextState.url)) {
    return true;
  }

  const configService = inject(ConfigService);
  const vaultPopupItemsService = inject(VaultPopupItemsService);
  const vaultPopupListFiltersService = inject(VaultPopupListFiltersService);
  const vaultPopupListTableFiltersService = inject(VaultPopupListTableFiltersService);

  vaultPopupItemsService.applyFilter("");

  return configService.getFeatureFlag$(FeatureFlag.VFO1Foundation).pipe(
    take(1),
    map((vfo1Enabled) => {
      if (vfo1Enabled) {
        vaultPopupListTableFiltersService.saveFilters({});
      } else {
        vaultPopupListFiltersService.resetFilterForm();
      }
      return true;
    }),
  );
};

const isCipherOpen = (url: string): boolean =>
  url.includes("view-cipher") ||
  url.includes("assign-collections") ||
  url.includes("edit-cipher") ||
  url.includes("clone-cipher");
