import { ScrollingModule } from "@angular/cdk/scrolling";
import { CommonModule } from "@angular/common";
import { Component, OnDestroy, OnInit } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { combineLatest, firstValueFrom, Observable, shareReplay, switchMap } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { DomainSettingsService } from "@bitwarden/common/autofill/services/domain-settings.service";
import { CollectionId, OrganizationId } from "@bitwarden/common/types/guid";
import { CipherType } from "@bitwarden/common/vault/enums";
import { BannerModule, ButtonModule, Icons, NoItemsModule } from "@bitwarden/components";
import { VaultIcons } from "@bitwarden/vault";

import { CurrentAccountComponent } from "../../../../auth/popup/account-switching/current-account.component";
import { PopOutComponent } from "../../../../platform/popup/components/pop-out.component";
import { PopupHeaderComponent } from "../../../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../../../platform/popup/layout/popup-page.component";
import { VaultPopupAutofillService } from "../../services/vault-popup-autofill.service";
import { VaultPopupItemsService } from "../../services/vault-popup-items.service";
import { VaultPopupListFiltersService } from "../../services/vault-popup-list-filters.service";
import { VaultUiOnboardingService } from "../../services/vault-ui-onboarding.service";
import { AutofillVaultListItemsComponent, VaultListItemsContainerComponent } from "../vault-v2";
import {
  NewItemDropdownV2Component,
  NewItemInitialValues,
} from "../vault-v2/new-item-dropdown/new-item-dropdown-v2.component";
import { VaultHeaderV2Component } from "../vault-v2/vault-header/vault-header-v2.component";

enum VaultState {
  Empty,
  NoResults,
  DeactivatedOrg,
}

@Component({
  selector: "app-vault",
  templateUrl: "vault-v2.component.html",
  standalone: true,
  imports: [
    PopupPageComponent,
    PopupHeaderComponent,
    PopOutComponent,
    CurrentAccountComponent,
    NoItemsModule,
    JslibModule,
    CommonModule,
    AutofillVaultListItemsComponent,
    VaultListItemsContainerComponent,
    BannerModule,
    ButtonModule,
    NewItemDropdownV2Component,
    ScrollingModule,
    VaultHeaderV2Component,
  ],
  providers: [VaultUiOnboardingService],
})
export class VaultV2Component implements OnInit, OnDestroy {
  cipherType = CipherType;

  protected favoriteCiphers$ = this.vaultPopupItemsService.favoriteCiphers$;
  protected remainingCiphers$ = this.vaultPopupItemsService.remainingCiphers$;
  protected loading$ = this.vaultPopupItemsService.loading$;
  protected scriptInjectionIsBlocked = false;
  protected showScriptInjectionIsBlockedBanner = false;
  protected autofillTabHostname: string = null;
  protected sectionIndicators: string[] = [];

  protected newItemItemValues$: Observable<NewItemInitialValues> =
    this.vaultPopupListFiltersService.filters$.pipe(
      switchMap(
        async (filter) =>
          ({
            organizationId: (filter.organization?.id ||
              filter.collection?.organizationId) as OrganizationId,
            collectionId: filter.collection?.id as CollectionId,
            folderId: filter.folder?.id,
          }) as NewItemInitialValues,
      ),
      shareReplay({ refCount: true, bufferSize: 1 }),
    );

  /** Visual state of the vault */
  protected vaultState: VaultState | null = null;

  protected vaultIcon = VaultIcons.Vault;
  protected deactivatedIcon = VaultIcons.DeactivatedOrg;
  protected noResultsIcon = Icons.NoResults;

  protected VaultStateEnum = VaultState;

  constructor(
    private vaultPopupItemsService: VaultPopupItemsService,
    private vaultPopupListFiltersService: VaultPopupListFiltersService,
    private domainSettingsService: DomainSettingsService,
    private vaultPopupAutofillService: VaultPopupAutofillService,
    private vaultUiOnboardingService: VaultUiOnboardingService,
  ) {
    combineLatest([
      this.vaultPopupItemsService.emptyVault$,
      this.vaultPopupItemsService.noFilteredResults$,
      this.vaultPopupItemsService.showDeactivatedOrg$,
    ])
      .pipe(takeUntilDestroyed())
      .subscribe(([emptyVault, noResults, deactivatedOrg]) => {
        switch (true) {
          case emptyVault:
            this.vaultState = VaultState.Empty;
            break;
          case deactivatedOrg:
            // The deactivated org state takes precedence over the no results state
            this.vaultState = VaultState.DeactivatedOrg;
            break;
          case noResults:
            this.vaultState = VaultState.NoResults;
            break;
          default:
            this.vaultState = null;
        }
      });

    combineLatest([
      this.domainSettingsService.blockedInteractionsUris$,
      this.vaultPopupAutofillService.currentAutofillTab$,
    ])
      .pipe(takeUntilDestroyed())
      .subscribe(([blockedInteractionsUris, currentAutofillTab]) => {
        if (blockedInteractionsUris && currentAutofillTab?.url?.length) {
          const autofillTabURL = new URL(currentAutofillTab.url);
          this.autofillTabHostname = autofillTabURL.hostname;
          const autofillTabIsBlocked = Object.keys(blockedInteractionsUris).includes(
            autofillTabURL.hostname,
          );

          this.scriptInjectionIsBlocked = autofillTabIsBlocked;

          if (autofillTabIsBlocked) {
            this.sectionIndicators.push("autofillDisabled");
          }

          this.showScriptInjectionIsBlockedBanner =
            autofillTabIsBlocked &&
            !blockedInteractionsUris[autofillTabURL.hostname]?.bannerIsDismissed;
        }
      });
  }

  async ngOnInit() {
    await this.vaultUiOnboardingService.showOnboardingDialog();
  }

  ngOnDestroy(): void {}

  handleScriptInjectionIsBlockedBannerDismiss() {
    firstValueFrom(this.domainSettingsService.blockedInteractionsUris$)
      .then((blockedURIs) => {
        this.showScriptInjectionIsBlockedBanner = false;
        this.domainSettingsService
          .setBlockedInteractionsUris({
            ...blockedURIs,
            [this.autofillTabHostname]: { bannerIsDismissed: true },
          })
          .catch(() => {
            /* no-op */
          });
      })
      .catch(() => {
        /* no-op */
      });
  }
}
