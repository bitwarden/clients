import { CommonModule } from "@angular/common";
import { Component, OnInit } from "@angular/core";
import { ReactiveFormsModule } from "@angular/forms";
import { Subject, combineLatest, delay, map, take, takeUntil } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { ChipSelectComponent } from "@bitwarden/components";

import { VaultListFilterLoadingStateService } from "../../../services/vault-list-filter-loading-state.service";
import { VaultPopupListFiltersService } from "../../../services/vault-popup-list-filters.service";

@Component({
  standalone: true,
  selector: "app-vault-list-filters",
  templateUrl: "./vault-list-filters.component.html",
  imports: [CommonModule, JslibModule, ChipSelectComponent, ReactiveFormsModule],
})
export class VaultListFiltersComponent implements OnInit {
  protected filterForm = this.vaultPopupListFiltersService.filterForm;
  protected organizations$ = this.vaultPopupListFiltersService.organizations$;
  protected collections$ = this.vaultPopupListFiltersService.collections$;
  protected folders$ = this.vaultPopupListFiltersService.folders$;
  protected cipherTypes = this.vaultPopupListFiltersService.cipherTypes;

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
  );

  constructor(
    private vaultPopupListFiltersService: VaultPopupListFiltersService,
    private vaultListFilterLoadingStateService: VaultListFilterLoadingStateService,
  ) {}

  private destroy$ = new Subject<void>();

  ngOnInit() {
    this.allFilters$.pipe(take(1), delay(0), takeUntil(this.destroy$)).subscribe(() => {
      requestAnimationFrame(() => {
        this.vaultListFilterLoadingStateService.emitFiltersLoaded();
      });
    });
  }
}
