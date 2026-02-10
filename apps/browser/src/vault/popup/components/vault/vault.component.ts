import { LiveAnnouncer } from "@angular/cdk/a11y";
import { ScrollingModule } from "@angular/cdk/scrolling";
import { CommonModule } from "@angular/common";
import { Component, DestroyRef, effect, inject, OnDestroy, OnInit } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { Router, RouterModule } from "@angular/router";
import {
  BehaviorSubject,
  combineLatest,
  distinctUntilChanged,
  filter,
  firstValueFrom,
  map,
  Observable,
  shareReplay,
  switchMap,
  take,
  tap,
  withLatestFrom,
} from "rxjs";

import { PremiumUpgradeDialogComponent } from "@bitwarden/angular/billing/components";
import { JslibModule } from "@bitwarden/angular/jslib.module";
import { NudgesService, NudgeType } from "@bitwarden/angular/vault";
import { SpotlightComponent } from "@bitwarden/angular/vault/components/spotlight/spotlight.component";
import { DeactivatedOrg, NoResults, VaultOpen } from "@bitwarden/assets/svg";
import {
  AutoConfirmExtensionSetupDialogComponent,
  AutoConfirmState,
  AutomaticUserConfirmationService,
} from "@bitwarden/auto-confirm";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherId, CollectionId, OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { SearchService } from "@bitwarden/common/vault/abstractions/search.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { UnionOfValues } from "@bitwarden/common/vault/types/union-of-values";
import { skeletonLoadingDelay } from "@bitwarden/common/vault/utils/skeleton-loading.operator";
import {
  ButtonModule,
  DialogService,
  NoItemsModule,
  ScrollLayoutService,
  ToastService,
  TypographyModule,
} from "@bitwarden/components";
import {
  DecryptionFailureDialogComponent,
  VaultItemsTransferService,
  DefaultVaultItemsTransferService,
} from "@bitwarden/vault";

import { CurrentAccountComponent } from "../../../../auth/popup/account-switching/current-account.component";
import { PopOutComponent } from "../../../../platform/popup/components/pop-out.component";
import { PopupHeaderComponent } from "../../../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../../../platform/popup/layout/popup-page.component";
import { IntroCarouselService } from "../../services/intro-carousel.service";
import { VaultPopupItemsService } from "../../services/vault-popup-items.service";
import { VaultPopupListFiltersService } from "../../services/vault-popup-list-filters.service";
import { VaultPopupLoadingService } from "../../services/vault-popup-loading.service";
import { VaultPopupScrollPositionService } from "../../services/vault-popup-scroll-position.service";
import { AtRiskPasswordCalloutComponent } from "../at-risk-callout/at-risk-password-callout.component";
import { VaultFadeInOutComponent } from "../vault-fade-in-out/vault-fade-in-out.component";
import { VaultFadeInOutSkeletonComponent } from "../vault-fade-in-out-skeleton/vault-fade-in-out-skeleton.component";
import { VaultLoadingSkeletonComponent } from "../vault-loading-skeleton/vault-loading-skeleton.component";

import { BlockedInjectionBanner } from "./blocked-injection-banner/blocked-injection-banner.component";
import {
  NewItemDropdownComponent,
  NewItemInitialValues,
} from "./new-item-dropdown/new-item-dropdown.component";
import { VaultHeaderComponent } from "./vault-header/vault-header.component";

import { AutofillVaultListItemsComponent, VaultListItemsContainerComponent } from ".";

const VaultState = {
  Empty: 0,
  NoResults: 1,
  DeactivatedOrg: 2,
} as const;

type VaultState = UnionOfValues<typeof VaultState>;

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-vault",
  templateUrl: "vault.component.html",
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
    NewItemDropdownComponent,
    ScrollingModule,
    VaultHeaderComponent,
    AtRiskPasswordCalloutComponent,
    SpotlightComponent,
    RouterModule,
    TypographyModule,
    VaultLoadingSkeletonComponent,
    VaultFadeInOutSkeletonComponent,
    VaultFadeInOutComponent,
  ],
  providers: [{ provide: VaultItemsTransferService, useClass: DefaultVaultItemsTransferService }],
})
export class VaultComponent implements OnInit, OnDestroy {
  NudgeType = NudgeType;
  cipherType = CipherType;
  private activeUserId$ = this.accountService.activeAccount$.pipe(getUserId);
  showEmptyVaultSpotlight$: Observable<boolean> = this.activeUserId$.pipe(
    switchMap((userId) =>
      this.nudgesService.showNudgeSpotlight$(NudgeType.EmptyVaultNudge, userId),
    ),
  );
  showHasItemsVaultSpotlight$: Observable<boolean> = this.activeUserId$.pipe(
    switchMap((userId) => this.nudgesService.showNudgeSpotlight$(NudgeType.HasVaultItems, userId)),
  );

  activeUserId: UserId | null = null;

  /**
   * Subject that indicates whether the vault is ready to render
   * and that all initialization tasks have been completed (ngOnInit).
   * @private
   */
  private readySubject = new BehaviorSubject(false);

  /**
   * Indicates whether the vault is loading and not yet ready to be displayed.
   * @protected
   */
  protected loading$ = combineLatest([
    this.vaultPopupLoadingService.loading$,
    this.readySubject.asObservable(),
  ]).pipe(
    map(([loading, ready]) => loading || !ready),
    distinctUntilChanged(),
    tap((loading) => {
      const key = loading ? "loadingVault" : "vaultLoaded";
      void this.liveAnnouncer.announce(this.i18nService.translate(key), "polite");
    }),
  );

  protected premiumSpotlightFeatureFlag$ = this.configService.getFeatureFlag$(
    FeatureFlag.BrowserPremiumSpotlight,
  );

  protected readonly hasSearchText$ = this.vaultPopupItemsService.hasSearchText$;
  protected readonly numberOfAppliedFilters$ =
    this.vaultPopupListFiltersService.numberOfAppliedFilters$;

  protected filteredCiphers$ = this.vaultPopupItemsService.filteredCiphers$;
  protected favoriteCiphers$ = this.vaultPopupItemsService.favoriteCiphers$;
  protected remainingCiphers$ = this.vaultPopupItemsService.remainingCiphers$;
  protected allFilters$ = this.vaultPopupListFiltersService.allFilters$;
  protected cipherCount$ = this.vaultPopupItemsService.cipherCount$;
  protected hasPremium$ = this.activeUserId$.pipe(
    switchMap((userId) => this.billingAccountService.hasPremiumFromAnySource$(userId)),
  );
  protected accountAgeInDays$ = this.accountService.activeAccount$.pipe(
    map((account) => {
      if (!account || !account.creationDate) {
        return 0;
      }
      const creationDate = account.creationDate;
      const ageInMilliseconds = Date.now() - creationDate.getTime();
      return Math.floor(ageInMilliseconds / (1000 * 60 * 60 * 24));
    }),
  );

  protected showPremiumSpotlight$ = combineLatest([
    this.premiumSpotlightFeatureFlag$,
    this.activeUserId$.pipe(
      switchMap((userId) =>
        this.nudgesService.showNudgeSpotlight$(NudgeType.PremiumUpgrade, userId),
      ),
    ),
    this.showHasItemsVaultSpotlight$,
    this.hasPremium$,
    this.cipherCount$,
    this.accountAgeInDays$,
  ]).pipe(
    map(([featureFlagEnabled, showPremiumNudge, showHasItemsNudge, hasPremium, count, age]) => {
      return (
        featureFlagEnabled &&
        showPremiumNudge &&
        !showHasItemsNudge &&
        !hasPremium &&
        count >= 5 &&
        age >= 7
      );
    }),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  showPremiumDialog() {
    PremiumUpgradeDialogComponent.open(this.dialogService);
  }

  /** When true, show skeleton loading state with debouncing to prevent flicker */
  protected showSkeletonsLoaders$ = combineLatest([
    this.loading$,
    this.searchService.isCipherSearching$,
    this.vaultItemsTransferService.transferInProgress$,
  ]).pipe(
    map(([loading, cipherSearching, transferInProgress]) => {
      return loading || cipherSearching || transferInProgress;
    }),
    distinctUntilChanged(),
    skeletonLoadingDelay(),
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

  protected vaultIcon = VaultOpen;
  protected deactivatedIcon = DeactivatedOrg;
  protected noResultsIcon = NoResults;

  protected VaultStateEnum = VaultState;

  constructor(
    private vaultPopupItemsService: VaultPopupItemsService,
    private vaultPopupListFiltersService: VaultPopupListFiltersService,
    private vaultScrollPositionService: VaultPopupScrollPositionService,
    private vaultPopupLoadingService: VaultPopupLoadingService,
    private accountService: AccountService,
    private destroyRef: DestroyRef,
    private cipherService: CipherService,
    private dialogService: DialogService,
    private introCarouselService: IntroCarouselService,
    private nudgesService: NudgesService,
    private router: Router,
    private autoConfirmService: AutomaticUserConfirmationService,
    private toastService: ToastService,
    private billingAccountService: BillingAccountProfileStateService,
    private liveAnnouncer: LiveAnnouncer,
    private i18nService: I18nService,
    private configService: ConfigService,
    private searchService: SearchService,
    private vaultItemsTransferService: VaultItemsTransferService,
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

  private readonly scrollLayout = inject(ScrollLayoutService);

  private readonly _scrollPositionEffect = effect((onCleanup) => {
    const sub = combineLatest([this.scrollLayout.scrollableRef$, this.allFilters$, this.loading$])
      .pipe(
        filter(([ref, _filters, loading]) => !!ref && !loading),
        take(1),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(([ref]) => {
        this.vaultScrollPositionService.start(ref!.nativeElement);
      });

    onCleanup(() => sub.unsubscribe());
  });

  async ngOnInit() {
    this.activeUserId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));

    await this.introCarouselService.setIntroCarouselDismissed();

    this.cipherService
      .failedToDecryptCiphers$(this.activeUserId)
      .pipe(
        map((ciphers) => (ciphers ? ciphers.filter((c) => !c.isDeleted) : [])),
        filter((ciphers) => ciphers.length > 0),
        take(1),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((ciphers) => {
        DecryptionFailureDialogComponent.open(this.dialogService, {
          cipherIds: ciphers.map((c) => c.id as CipherId),
        });
      });

    const autoConfirmState$ = this.autoConfirmService.configuration$(this.activeUserId);

    combineLatest([
      this.autoConfirmService.canManageAutoConfirm$(this.activeUserId),
      autoConfirmState$,
    ])
      .pipe(
        filter(([canManage, state]) => canManage && state.showBrowserNotification === undefined),
        take(1),
        switchMap(() => AutoConfirmExtensionSetupDialogComponent.open(this.dialogService).closed),
        withLatestFrom(autoConfirmState$, this.accountService.activeAccount$.pipe(getUserId)),
        switchMap(([result, state, userId]) => {
          const newState: AutoConfirmState = {
            ...state,
            enabled: result ?? false,
            showBrowserNotification: !result,
          };

          if (result) {
            this.toastService.showToast({
              message: this.i18nService.t("autoConfirmEnabled"),
              variant: "success",
            });
          }

          return this.autoConfirmService.upsert(userId, newState);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
    await this.vaultItemsTransferService.enforceOrganizationDataOwnership(this.activeUserId);

    this.readySubject.next(true);
  }

  ngOnDestroy() {
    this.vaultScrollPositionService.stop();
  }

  async navigateToImport() {
    await this.router.navigate(["/import"]);
  }

  async dismissVaultNudgeSpotlight(type: NudgeType) {
    await this.nudgesService.dismissNudge(type, this.activeUserId as UserId);
  }

  protected readonly FeatureFlag = FeatureFlag;
}
