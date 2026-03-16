import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";
import { ReactiveFormsModule } from "@angular/forms";
import { combineLatest, map, shareReplay } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { ChipSelectComponent } from "@bitwarden/components";

import { VaultPopupListFiltersService } from "../../../services/vault-popup-list-filters.service";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-vault-list-filters",
  templateUrl: "./vault-list-filters.component.html",
  imports: [CommonModule, JslibModule, ChipSelectComponent, ReactiveFormsModule],
})
export class VaultListFiltersComponent {
  protected filterForm = this.vaultPopupListFiltersService.filterForm;
  protected organizations$ = this.vaultPopupListFiltersService.organizations$;
  protected collections$ = this.vaultPopupListFiltersService.collections$;
  protected folders$ = this.vaultPopupListFiltersService.folders$;
  protected cipherTypes$ = this.vaultPopupListFiltersService.cipherTypes$;

  // Combine all filters into a single observable to eliminate the filters from loading separately in the UI.
  protected allFilters$ = combineLatest([
    this.organizations$,
    this.collections$,
    this.folders$,
  ]).pipe(
    map(([organizations, collections, folders]) => {
      return {
        organizations,
        collections,
        folders,
      };
    }),
    shareReplay({ bufferSize: 1, refCount: false }),
  );

  constructor(private vaultPopupListFiltersService: VaultPopupListFiltersService) {}
}
