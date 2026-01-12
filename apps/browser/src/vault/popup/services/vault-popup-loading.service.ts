import { inject, Injectable } from "@angular/core";
import { combineLatest, map, shareReplay, startWith,tap } from "rxjs";

import { VaultPopupCopyButtonsService } from "./vault-popup-copy-buttons.service";
import { VaultPopupItemsService } from "./vault-popup-items.service";
import { VaultPopupListFiltersService } from "./vault-popup-list-filters.service";

@Injectable({
  providedIn: "root",
})
export class VaultPopupLoadingService {
  private vaultPopupItemsService = inject(VaultPopupItemsService);
  private vaultPopupListFiltersService = inject(VaultPopupListFiltersService);
  private vaultCopyButtonsService = inject(VaultPopupCopyButtonsService);

  /** Loading state of the vault */
  loading$ = combineLatest([
    this.vaultPopupItemsService.loading$
      .pipe(tap(loading => {
        console.log("[vault popup loading service] vault popup items loading state:", loading);
      })),
    this.vaultPopupListFiltersService.allFilters$
      .pipe(tap(loading => {
        console.log("[vault popup loading service] vault poupuplist items loading state:", loading);
      })),
    // Added as a dependency to avoid flashing the copyActions on slower devices
    this.vaultCopyButtonsService.showQuickCopyActions$
      .pipe(tap(loading => {
        console.log("[vault popup loading service] vault copy buttons loading state:", loading);
      })),
  ]).pipe(
    map(([itemsLoading, filters]) => itemsLoading || !filters),
    tap(loading => {
      console.log("[vault popup loading service] combined vault loading state:", loading);
    }),
    shareReplay({ bufferSize: 1, refCount: true }),
    startWith(true),
  );
}
