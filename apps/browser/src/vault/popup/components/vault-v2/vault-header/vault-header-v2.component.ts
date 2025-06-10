// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import { Component, inject, NgZone, ViewChild } from "@angular/core";
import { combineLatest, map, take } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  DisclosureComponent,
  DisclosureTriggerForDirective,
  IconButtonModule,
} from "@bitwarden/components";

import { runInsideAngular } from "../../../../../platform/browser/run-inside-angular.operator";
import { VaultPopupListFiltersService } from "../../../../../vault/popup/services/vault-popup-list-filters.service";
import { VaultListFiltersComponent } from "../vault-list-filters/vault-list-filters.component";
import { VaultV2SearchComponent } from "../vault-search/vault-v2-search.component";

@Component({
  selector: "app-vault-header-v2",
  templateUrl: "vault-header-v2.component.html",
  imports: [
    VaultV2SearchComponent,
    VaultListFiltersComponent,
    DisclosureComponent,
    IconButtonModule,
    DisclosureTriggerForDirective,
    CommonModule,
    JslibModule,
  ],
})
export class VaultHeaderV2Component {
  @ViewChild(DisclosureComponent) disclosure: DisclosureComponent;

  /** Emits the visibility status of the disclosure component. */
  protected isDisclosureShown$ = this.vaultPopupListFiltersService.filterVisibilityState$.pipe(
    runInsideAngular(inject(NgZone)), // Browser state updates can happen outside of `ngZone`
    map((v) => v ?? true),
  );

  // Only use the first value to avoid an infinite loop from two-way binding
  protected initialDisclosureVisibility$ = this.isDisclosureShown$.pipe(take(1));

  protected numberOfAppliedFilters$ = this.vaultPopupListFiltersService.numberOfAppliedFilters$;

  /** Emits true when the number of filters badge should be applied. */
  protected showBadge$ = combineLatest([
    this.numberOfAppliedFilters$,
    this.isDisclosureShown$,
  ]).pipe(map(([numberOfFilters, disclosureShown]) => numberOfFilters !== 0 && !disclosureShown));

  protected buttonSupportingText$ = this.numberOfAppliedFilters$.pipe(
    map((numberOfFilters) => {
      if (numberOfFilters === 0) {
        return null;
      }
      if (numberOfFilters === 1) {
        return this.i18nService.t("filterApplied");
      }

      return this.i18nService.t("filterAppliedPlural", numberOfFilters);
    }),
  );

  constructor(
    private vaultPopupListFiltersService: VaultPopupListFiltersService,
    private i18nService: I18nService,
  ) {}

  async toggleFilters(isShown: boolean) {
    await this.vaultPopupListFiltersService.updateFilterVisibility(isShown);
  }
}
