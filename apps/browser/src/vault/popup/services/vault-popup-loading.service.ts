import { inject, Injectable } from "@angular/core";
import { combineLatest, map, shareReplay, startWith } from "rxjs";

import { VaultCopyButtonsService } from "@bitwarden/vault";

import { VaultPopupItemsService } from "./vault-popup-items.service";
import { VaultPopupListFiltersService } from "./vault-popup-list-filters.service";

@Injectable({
  providedIn: "root",
})
export class VaultPopupLoadingService {
  private vaultPopupItemsService = inject(VaultPopupItemsService);
  private vaultPopupListFiltersService = inject(VaultPopupListFiltersService);
  private vaultCopyButtonsService = inject(VaultCopyButtonsService);

  /** Loading state of the vault */
  loading$ = combineLatest([
    this.vaultPopupItemsService.loading$,
    this.vaultPopupListFiltersService.allFilters$,
    // Added as a dependency to avoid flashing the copyActions on slower devices
    this.vaultCopyButtonsService.showQuickCopyActions$,
  ]).pipe(
    map(([itemsLoading, filters]) => itemsLoading || !filters),
    shareReplay({ bufferSize: 1, refCount: true }),
    startWith(true),
  );
}
