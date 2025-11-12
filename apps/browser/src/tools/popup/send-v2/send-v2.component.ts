import { LiveAnnouncer } from "@angular/cdk/a11y";
import { CommonModule } from "@angular/common";
import { Component, OnDestroy } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { combineLatest, distinctUntilChanged, map, switchMap, tap } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { NoResults, NoSendsIcon } from "@bitwarden/assets/svg";
import { VaultLoadingSkeletonComponent } from "@bitwarden/browser/vault/popup/components/vault-loading-skeleton/vault-loading-skeleton.component";
import { BrowserPremiumUpgradePromptService } from "@bitwarden/browser/vault/popup/services/browser-premium-upgrade-prompt.service";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { SendType } from "@bitwarden/common/tools/send/enums/send-type";
import { PremiumUpgradePromptService } from "@bitwarden/common/vault/abstractions/premium-upgrade-prompt.service";
import {
  ButtonModule,
  CalloutModule,
  NoItemsModule,
  TypographyModule,
} from "@bitwarden/components";
import {
  NewSendDropdownComponent,
  SendItemsService,
  SendListFiltersComponent,
  SendListFiltersService,
  SendListItemsContainerComponent,
  SendSearchComponent,
} from "@bitwarden/send-ui";

import { CurrentAccountComponent } from "../../../auth/popup/account-switching/current-account.component";
import { PopOutComponent } from "../../../platform/popup/components/pop-out.component";
import { PopupHeaderComponent } from "../../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../../platform/popup/layout/popup-page.component";
import { VaultFadeInOutSkeletonComponent } from "../../../vault/popup/components/vault-fade-in-out-skeleton/vault-fade-in-out-skeleton.component";

// FIXME: update to use a const object instead of a typescript enum
// eslint-disable-next-line @bitwarden/platform/no-enums
export enum SendState {
  Empty,
  NoResults,
}

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  templateUrl: "send-v2.component.html",
  providers: [
    {
      provide: PremiumUpgradePromptService,
      useClass: BrowserPremiumUpgradePromptService,
    },
  ],
  imports: [
    CalloutModule,
    PopupPageComponent,
    PopupHeaderComponent,
    PopOutComponent,
    CurrentAccountComponent,
    NoItemsModule,
    JslibModule,
    CommonModule,
    ButtonModule,
    NewSendDropdownComponent,
    SendListItemsContainerComponent,
    SendListFiltersComponent,
    SendSearchComponent,
    TypographyModule,
    VaultFadeInOutSkeletonComponent,
    VaultLoadingSkeletonComponent,
  ],
})
export class SendV2Component implements OnDestroy {
  sendType = SendType;
  sendState = SendState;

  protected listState: SendState | null = null;
  protected sends$ = this.sendItemsService.filteredAndSortedSends$;
  private skeletonFeatureFlag$ = this.configService.getFeatureFlag$(
    FeatureFlag.VaultLoadingSkeletons,
  );
  protected sendsLoading$ = this.sendItemsService.loading$.pipe(
    distinctUntilChanged(),
    tap((loading) => {
      const key = loading ? "loadingSendPage" : "sendPageLoaded";
      void this.liveAnnouncer.announce(this.i18nService.translate(key), "polite");
    }),
  );

  /** Spinner Loading State */
  protected showSpinnerLoaders$ = combineLatest([
    this.sendsLoading$,
    this.skeletonFeatureFlag$,
  ]).pipe(map(([loading, skeletonsEnabled]) => loading && !skeletonsEnabled));

  /** Skeleton Loading State */
  protected showSkeletonsLoaders$ = combineLatest([
    this.sendsLoading$,
    this.skeletonFeatureFlag$,
  ]).pipe(map(([loading, skeletonsEnabled]) => loading && skeletonsEnabled));

  protected title: string = "allSends";
  protected noItemIcon = NoSendsIcon;
  protected noResultsIcon = NoResults;

  protected sendsDisabled = false;

  constructor(
    protected sendItemsService: SendItemsService,
    protected sendListFiltersService: SendListFiltersService,
    private policyService: PolicyService,
    private accountService: AccountService,
    private liveAnnouncer: LiveAnnouncer,
    private i18nService: I18nService,
    private configService: ConfigService,
  ) {
    combineLatest([
      this.sendItemsService.emptyList$,
      this.sendItemsService.noFilteredResults$,
      this.sendListFiltersService.filters$,
    ])
      .pipe(takeUntilDestroyed())
      .subscribe(([emptyList, noFilteredResults, currentFilter]) => {
        if (currentFilter?.sendType !== null) {
          this.title = `${this.sendType[currentFilter.sendType].toLowerCase()}Sends`;
        } else {
          this.title = "allSends";
        }

        if (emptyList) {
          this.listState = SendState.Empty;
          return;
        }

        if (noFilteredResults) {
          this.listState = SendState.NoResults;
          return;
        }

        this.listState = null;
      });

    this.accountService.activeAccount$
      .pipe(
        getUserId,
        switchMap((userId) =>
          this.policyService.policyAppliesToUser$(PolicyType.DisableSend, userId),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((sendsDisabled) => {
        this.sendsDisabled = sendsDisabled;
      });
  }

  ngOnDestroy(): void {}
}
