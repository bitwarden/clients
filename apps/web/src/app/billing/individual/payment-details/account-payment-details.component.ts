import { Component } from "@angular/core";
import { BehaviorSubject, filter, merge, Observable, shareReplay, switchMap, tap } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";

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
export class AccountPaymentDetailsComponent {
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
    private subscriberBillingClient: SubscriberBillingClient,
  ) {}

  setPaymentMethod = (paymentMethod: MaskedPaymentMethod) => {
    if (this.viewState$.value) {
      this.viewState$.next({
        ...this.viewState$.value,
        paymentMethod,
      });
    }
  };
}
