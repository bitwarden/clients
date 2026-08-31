import { inject, Injectable } from "@angular/core";
import { combineLatest, map, shareReplay, startWith, switchMap } from "rxjs";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { VaultCopyButtonsService } from "@bitwarden/vault";

import { VaultPopupItemsService } from "./vault-popup-items.service";
import { VaultPopupListFiltersService } from "./vault-popup-list-filters.service";
import { VaultPopupListTableFiltersService } from "./vault-popup-list-table-filters.service";

@Injectable({
  providedIn: "root",
})
export class VaultPopupLoadingService {
  private vaultPopupItemsService = inject(VaultPopupItemsService);
  private vaultPopupListFiltersService = inject(VaultPopupListFiltersService);
  private vaultPopupListTableFiltersService = inject(VaultPopupListTableFiltersService);
  private vaultCopyButtonsService = inject(VaultCopyButtonsService);
  private configService = inject(ConfigService);
  private vfo1Flag$ = this.configService
    .getFeatureFlag$(FeatureFlag.VFO1Foundation)
    .pipe(startWith(false));

  private readonly listFiltersPopulated$ = this.vfo1Flag$.pipe(
    switchMap((vfo1Enabled) =>
      vfo1Enabled
        ? combineLatest([
            this.vaultPopupListTableFiltersService.organizations$,
            this.vaultPopupListTableFiltersService.collections$,
            this.vaultPopupListTableFiltersService.folders$,
          ])
        : this.vaultPopupListFiltersService.allFilters$,
    ),
  );

  /** Loading state of the vault */
  loading$ = combineLatest([
    this.vaultPopupItemsService.loading$,
    this.listFiltersPopulated$,
    // Added as a dependency to avoid flashing the copyActions on slower devices
    this.vaultCopyButtonsService.showQuickCopyActions$,
  ]).pipe(
    map(([itemsLoading, filters]) => itemsLoading || !filters),
    shareReplay({ bufferSize: 1, refCount: true }),
    startWith(true),
  );
}
