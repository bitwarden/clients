// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, OnInit } from "@angular/core";
import { catchError, from, map, Observable, of, switchMap } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";

import { AccountBillingClient } from "../clients/account-billing.client";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  templateUrl: "subscription.component.html",
  standalone: false,
})
export class SubscriptionComponent implements OnInit {
  showSubscriptionPageLink$: Observable<boolean>;
  selfHosted: boolean;

  constructor(
    private platformUtilsService: PlatformUtilsService,
    accountService: AccountService,
    accountBillingClient: AccountBillingClient,
    logService: LogService,
  ) {
    this.showSubscriptionPageLink$ = accountService.activeAccount$.pipe(
      switchMap((account) => {
        if (!account) {
          return of(false);
        }
        return from(accountBillingClient.getSubscription()).pipe(
          map((subscription) => !!subscription),
          catchError((error: unknown) => {
            logService.error("Failed to fetch subscription for tab link", error);
            return of(false);
          }),
        );
      }),
    );
  }

  ngOnInit() {
    this.selfHosted = this.platformUtilsService.isSelfHost();
  }
}
