import { CommonModule } from "@angular/common";
import { Component, computed, inject, viewChild } from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { Router } from "@angular/router";
import { combineLatest, distinctUntilChanged, map, shareReplay } from "rxjs";

import { NoResults, NoSendsIcon } from "@bitwarden/assets/svg";
import { BrowserPremiumUpgradePromptService } from "@bitwarden/browser/billing/popup/services/browser-premium-upgrade-prompt.service";
import { VaultLoadingSkeletonComponent } from "@bitwarden/browser/vault/popup/components/vault-loading-skeleton/vault-loading-skeleton.component";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { SendView } from "@bitwarden/common/tools/send/models/view/send.view";
import { SendService } from "@bitwarden/common/tools/send/services/send.service.abstraction";
import { SendType } from "@bitwarden/common/tools/send/types/send-type";
import { PremiumUpgradePromptService } from "@bitwarden/common/vault/abstractions/premium-upgrade-prompt.service";
import { SearchService } from "@bitwarden/common/vault/abstractions/search.service";
import { skeletonLoadingDelay } from "@bitwarden/common/vault/utils/skeleton-loading.operator";
import {
  ButtonModule,
  CalloutModule,
  StatusLockupComponent,
  SvgComponent,
} from "@bitwarden/components";
import {
  NewSendDropdownComponent,
  SendItemsService,
  SendListFiltersComponent,
  SendListFiltersService,
  SendListItemsContainerComponent,
  SendPolicyService,
  SendSearchComponent,
  SendTableV2Component,
} from "@bitwarden/send-ui";
import { I18nPipe } from "@bitwarden/ui-common";

import { CurrentAccountComponent } from "../../../auth/popup/account-switching/current-account.component";
import { PopOutComponent } from "../../../platform/popup/components/pop-out.component";
import { PopupHeaderComponent } from "../../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../../platform/popup/layout/popup-page.component";
import { VaultFadeInOutSkeletonComponent } from "../../../vault/popup/components/vault-fade-in-out-skeleton/vault-fade-in-out-skeleton.component";

import { SendFabComponent } from "./send-fab/send-fab.component";

/** A state of the Send list UI. */
export const SendState = Object.freeze({
  /** No sends exist for the current filter (file or text). */
  Empty: "Empty",
  /** Sends exist, but none match the current filter/search. */
  NoResults: "NoResults",
} as const);

/** A state of the Send list UI. */
export type SendState = (typeof SendState)[keyof typeof SendState];

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
    StatusLockupComponent,
    CommonModule,
    ButtonModule,
    NewSendDropdownComponent,
    SendListItemsContainerComponent,
    SendListFiltersComponent,
    SendSearchComponent,
    SvgComponent,
    VaultFadeInOutSkeletonComponent,
    VaultLoadingSkeletonComponent,
    SendFabComponent,
    SendTableV2Component,
    I18nPipe,
  ],
})
export class SendV2Component {
  sendType = SendType;
  sendState = SendState;

  protected listState: SendState | null = null;
  protected sends$ = this.sendItemsService.filteredAndSortedSends$;
  protected readonly allSends = toSignal(this.sendService.sendViews$);
  protected readonly tableEl = viewChild(SendTableV2Component);
  protected readonly filteredRowCount = computed(() => this.tableEl()?.filteredRowCount() ?? 0);
  protected readonly sendCountLabel = computed(() => {
    const rowCount = this.filteredRowCount();
    return rowCount === 1
      ? this.i18nService.t("oneSendCount")
      : this.i18nService.t("sendsCount", this.filteredRowCount());
  });
  protected sendsLoading$ = this.sendItemsService.loading$.pipe(
    distinctUntilChanged(),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  /** Skeleton Loading State */
  protected showSkeletonsLoaders$ = combineLatest([
    this.sendsLoading$,
    this.searchService.isSendSearching$,
  ]).pipe(
    map(([loading, cipherSearching]) => loading || cipherSearching),
    distinctUntilChanged(),
    skeletonLoadingDelay(),
  );

  protected title: string = "allSends";
  protected noItemIcon = NoSendsIcon;
  protected noResultsIcon = NoResults;

  private sendPolicyService = inject(SendPolicyService);
  protected readonly sendsDisabled = toSignal(this.sendPolicyService.disableSend$);

  protected readonly vfo1Enabled = toSignal(
    inject(ConfigService).getFeatureFlag$(FeatureFlag.VFO1Foundation),
    { initialValue: false },
  );

  private readonly sendTypeTitles: Record<SendType, string> = {
    [SendType.File]: "fileSends",
    [SendType.Text]: "textSends",
    [SendType.Item]: "itemSends",
  };

  constructor(
    protected sendItemsService: SendItemsService,
    protected sendListFiltersService: SendListFiltersService,
    private searchService: SearchService,
    private sendService: SendService,
    private router: Router,
    private i18nService: I18nService,
  ) {
    combineLatest([
      this.sendItemsService.emptyList$,
      this.sendItemsService.noFilteredResults$,
      this.sendListFiltersService.filters$,
    ])
      .pipe(takeUntilDestroyed())
      .subscribe(([emptyList, noFilteredResults, currentFilter]) => {
        if (currentFilter?.sendType !== null) {
          this.title = this.sendTypeTitles[currentFilter.sendType as SendType] ?? "allSends";
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
  }

  editSend(sendView: SendView) {
    void this.router.navigate(["/edit-send"], {
      queryParams: { sendId: sendView.id, type: sendView.type },
    });
  }
}
