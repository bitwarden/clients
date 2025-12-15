import { Component, OnInit } from "@angular/core";
import { Router } from "@angular/router";
import { BehaviorSubject, filter, merge, Observable, shareReplay, switchMap, tap } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";

import { HeaderModule } from "../../../layouts/header/header.module";
import { SharedModule } from "../../../shared";
import { SubscriberBillingClient } from "../../clients";
import {
  DisplayAccountCreditComponent,
  DisplayPaymentMethodComponent,
} from "../../payment/components";
import { MaskedPaymentMethod } from "../../payment/types";
import { mapAccountToSubscriber, BitwardenSubscriber } from "../../types";

type View = {
  account: BitwardenSubscriber;
  paymentMethod: MaskedPaymentMethod | null;
  credit: number | null;
};

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  templateUrl: "./account-payment-details.component.html",
  standalone: true,
  imports: [
    DisplayAccountCreditComponent,
    DisplayPaymentMethodComponent,
    HeaderModule,
    SharedModule,
  ],
  providers: [SubscriberBillingClient],
})
export class AccountPaymentDetailsComponent implements OnInit {
  private viewState$ = new BehaviorSubject<View | null>(null);

  private load$: Observable<View> = this.accountService.activeAccount$.pipe(
    mapAccountToSubscriber,
    switchMap(async (account) => {
      const [paymentMethod, credit] = await Promise.all([
        this.subscriberBillingClient.getPaymentMethod(account),
        this.subscriberBillingClient.getCredit(account),
      ]);

      return {
        account,
        paymentMethod,
        credit,
      };
    }),
    shareReplay({ bufferSize: 1, refCount: false }),
  );

  view$: Observable<View> = merge(
    this.load$.pipe(tap((view) => this.viewState$.next(view))),
    this.viewState$.pipe(filter((view): view is View => view !== null)),
  ).pipe(shareReplay({ bufferSize: 1, refCount: true }));

  constructor(
    private accountService: AccountService,
    private platformUtilsService: PlatformUtilsService,
    private router: Router,
    private subscriberBillingClient: SubscriberBillingClient,
  ) {}

  async ngOnInit() {
    if (this.platformUtilsService.isSelfHost()) {
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.router.navigate(["/settings/subscription"]);
      return;
    }
  }

  setPaymentMethod = (paymentMethod: MaskedPaymentMethod) => {
    if (this.viewState$.value) {
      this.viewState$.next({
        ...this.viewState$.value,
        paymentMethod,
      });
    }
  };
}
