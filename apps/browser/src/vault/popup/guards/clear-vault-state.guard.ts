import { inject } from "@angular/core";
import { CanDeactivateFn } from "@angular/router";

import { VaultV2Component } from "../components/vault-v2/vault-v2.component";
import { VaultPopupItemsService } from "../services/vault-popup-items.service";
import { VaultPopupListFiltersService } from "../services/vault-popup-list-filters.service";

/**
 * Guard to clear the vault state (search and filter) when navigating away from the vault view.
 * This ensures the search and filter state is reset when navigating between different tabs,
 * except viewing or editing a cipher.
 */
export const clearVaultStateGuard: CanDeactivateFn<VaultV2Component> = (
  component: VaultV2Component,
  currentRoute,
  currentState,
  nextState,
) => {
  const vaultPopupItemsService = inject(VaultPopupItemsService);
  const vaultPopupListFiltersService = inject(VaultPopupListFiltersService);
  if (nextState && !isCipherOpen(nextState.url)) {
    vaultPopupItemsService.applyFilter("");
    vaultPopupListFiltersService.resetFilterForm();
  }

  return true;
};

const isCipherOpen = (url: string): boolean =>
  url.includes("view-cipher") ||
  url.includes("assign-collections") ||
  url.includes("edit-cipher") ||
  url.includes("clone-cipher");
