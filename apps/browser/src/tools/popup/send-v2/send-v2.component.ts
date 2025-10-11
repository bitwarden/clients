import { CommonModule } from "@angular/common";
import { Component, OnDestroy } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { combineLatest, switchMap } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { NoResults, NoSendsIcon } from "@bitwarden/assets/svg";
import { BrowserPremiumUpgradePromptService } from "@bitwarden/browser/vault/popup/services/browser-premium-upgrade-prompt.service";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
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

/** A state of the Send list UI. */
export const SendState = Object.freeze({
  /** No sends exist for the current filter (file or text). */
  Empty: "Empty",
  /** Sends exist, but none match the current filter/search. */
  NoResults: "NoResults",
} as const);

/** A state of the Send list UI. */
export type SendState = (typeof SendState)[keyof typeof SendState];

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
  ],
})
export class SendV2Component implements OnDestroy {
  sendType = SendType;
  sendState = SendState;

  protected listState: SendState | null = null;
  protected sends$ = this.sendItemsService.filteredAndSortedSends$;
  protected sendsLoading$ = this.sendItemsService.loading$;
  protected title: string = "allSends";
  protected noItemIcon = NoSendsIcon;
  protected noResultsIcon = NoResults;

  protected sendsDisabled = false;

  constructor(
    protected sendItemsService: SendItemsService,
    protected sendListFiltersService: SendListFiltersService,
    private policyService: PolicyService,
    private accountService: AccountService,
  ) {
    combineLatest([
      this.sendItemsService.emptyList$,
      this.sendItemsService.noFilteredResults$,
      this.sendListFiltersService.filters$,
    ])
      .pipe(takeUntilDestroyed())
      .subscribe(([emptyList, noFilteredResults, currentFilter]) => {
        if (currentFilter?.sendType !== null) {
          if (currentFilter.sendType === SendType.File) {
            this.title = "fileSends";
          } else if (currentFilter.sendType === SendType.Text) {
            this.title = "textSends";
          }
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
