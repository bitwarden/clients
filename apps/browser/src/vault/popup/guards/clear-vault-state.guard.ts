import { inject } from "@angular/core";
import { CanDeactivateFn } from "@angular/router";
import { map, take } from "rxjs";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";

import { VaultComponent } from "../components/vault/vault.component";
import { VaultPopupItemsService } from "../services/vault-popup-items.service";
import { VaultPopupListFiltersService } from "../services/vault-popup-list-filters.service";

/**
 * Guard to clear the vault state (search and filter) when navigating away from the vault view.
 * This ensures the search and filter state is reset when navigating between different tabs,
 * except viewing or editing a cipher.
 *
 * VFO1 intentionally persists search/filter state across navigation (see
 * `VaultPopupListTableFiltersService`'s view-cache-backed filters), so this guard is a no-op
 * when the flag is on. Once VFO1 is fully rolled out and the legacy `VaultPopupListFiltersService`
 * path is removed, this guard becomes dead code and can be deleted entirely.
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

  return configService.getFeatureFlag$(FeatureFlag.VFO1Foundation).pipe(
    take(1),
    map((vfo1Enabled) => {
      if (!vfo1Enabled) {
        vaultPopupItemsService.applyFilter("");
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
