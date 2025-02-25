import { CdkVirtualScrollableElement, ScrollingModule } from "@angular/cdk/scrolling";
import { CommonModule } from "@angular/common";
import { AfterViewInit, Component, DestroyRef, OnDestroy, OnInit, ViewChild } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { RouterLink } from "@angular/router";
import {
  combineLatest,
  filter,
  map,
  firstValueFrom,
  Observable,
  shareReplay,
  switchMap,
  take,
} from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { VaultProfileService } from "@bitwarden/angular/vault/services/vault-profile.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { CipherId, CollectionId, OrganizationId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import {
  BannerComponent,
  ButtonModule,
  DialogService,
  Icons,
  NoItemsModule,
} from "@bitwarden/components";
import { DecryptionFailureDialogComponent, VaultIcons } from "@bitwarden/vault";

import { CurrentAccountComponent } from "../../../../auth/popup/account-switching/current-account.component";
import { PopOutComponent } from "../../../../platform/popup/components/pop-out.component";
import { PopupHeaderComponent } from "../../../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../../../platform/popup/layout/popup-page.component";
import { VaultPopupItemsService } from "../../services/vault-popup-items.service";
import { VaultPopupListFiltersService } from "../../services/vault-popup-list-filters.service";
import { VaultPopupScrollPositionService } from "../../services/vault-popup-scroll-position.service";
import { AtRiskPasswordCalloutComponent } from "../at-risk-callout/at-risk-password-callout.component";

import { BlockedInjectionBanner } from "./blocked-injection-banner/blocked-injection-banner.component";
import {
  NewItemDropdownV2Component,
  NewItemInitialValues,
} from "./new-item-dropdown/new-item-dropdown-v2.component";
import { NewSettingsCalloutComponent } from "./new-settings-callout/new-settings-callout.component";
import { VaultHeaderV2Component } from "./vault-header/vault-header-v2.component";
import { VaultPageService } from "./vault-page.service";

import { AutofillVaultListItemsComponent, VaultListItemsContainerComponent } from ".";

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
    BlockedInjectionBanner,
    PopupPageComponent,
    PopupHeaderComponent,
    PopOutComponent,
    CurrentAccountComponent,
    NoItemsModule,
    JslibModule,
    CommonModule,
    AutofillVaultListItemsComponent,
    VaultListItemsContainerComponent,
    ButtonModule,
    RouterLink,
    NewItemDropdownV2Component,
    ScrollingModule,
    VaultHeaderV2Component,
    DecryptionFailureDialogComponent,
    BannerComponent,
    AtRiskPasswordCalloutComponent,
    NewSettingsCalloutComponent,
  ],
  providers: [VaultPageService],
})
export class VaultV2Component implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild(CdkVirtualScrollableElement) virtualScrollElement?: CdkVirtualScrollableElement;

  cipherType = CipherType;

  protected favoriteCiphers$ = this.vaultPopupItemsService.favoriteCiphers$;
  protected remainingCiphers$ = this.vaultPopupItemsService.remainingCiphers$;
  protected allFilters$ = this.vaultPopupListFiltersService.allFilters$;

  protected loading$ = combineLatest([this.vaultPopupItemsService.loading$, this.allFilters$]).pipe(
    map(([itemsLoading, filters]) => itemsLoading || !filters),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

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
  protected showNewCustomizationSettingsCallout = false;

  constructor(
    private vaultPopupItemsService: VaultPopupItemsService,
    private vaultPopupListFiltersService: VaultPopupListFiltersService,
    private vaultScrollPositionService: VaultPopupScrollPositionService,
    private accountService: AccountService,
    private destroyRef: DestroyRef,
    private cipherService: CipherService,
    private dialogService: DialogService,
    private vaultProfileService: VaultProfileService,
    private vaultPageService: VaultPageService,
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
  }

  ngAfterViewInit(): void {
    if (this.virtualScrollElement) {
      // The filters component can cause the size of the virtual scroll element to change,
      // which can cause the scroll position to be land in the wrong spot. To fix this,
      // wait until all filters are populated before restoring the scroll position.
      this.allFilters$.pipe(take(1), takeUntilDestroyed(this.destroyRef)).subscribe(() => {
        this.vaultScrollPositionService.start(this.virtualScrollElement!);
      });
    }
  }

  async ngOnInit() {
    const activeUserId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));

    this.cipherService
      .failedToDecryptCiphers$(activeUserId)
      .pipe(
        map((ciphers) => ciphers.filter((c) => !c.isDeleted)),
        filter((ciphers) => ciphers.length > 0),
        take(1),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((ciphers) => {
        DecryptionFailureDialogComponent.open(this.dialogService, {
          cipherIds: ciphers.map((c) => c.id as CipherId),
        });
      });
  }

  ngOnDestroy() {
    this.vaultScrollPositionService.stop();
  }

  protected readonly FeatureFlag = FeatureFlag;
}
