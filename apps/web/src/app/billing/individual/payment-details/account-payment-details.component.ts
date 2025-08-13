import { Component } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import {
  BehaviorSubject,
  EMPTY,
  filter,
  from,
  map,
  merge,
  Observable,
  shareReplay,
  switchMap,
  tap,
} from "rxjs";
import { catchError } from "rxjs/operators";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";

import { HeaderModule } from "../../../layouts/header/header.module";
import { SharedModule } from "../../../shared";
import {
  DisplayAccountCreditComponent,
  DisplayPaymentMethodComponent,
} from "../../payment/components";
import { MaskedPaymentMethod } from "../../payment/types";
import { BillingClient } from "../../services";
import { accountToBillableEntity, BillableEntity } from "../../types";

class RedirectError {
  constructor(
    public path: string[],
    public relativeTo: ActivatedRoute,
  ) {}
}

type View = {
  account: BillableEntity;
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
  providers: [BillingClient],
})
export class AccountPaymentDetailsComponent {
  private viewState$ = new BehaviorSubject<View | null>(null);

  private load$: Observable<View> = this.accountService.activeAccount$.pipe(
    switchMap((account) =>
      this.configService
        .getFeatureFlag$(FeatureFlag.PM21881_ManagePaymentDetailsOutsideCheckout)
        .pipe(
          map((managePaymentDetailsOutsideCheckout) => {
            if (!managePaymentDetailsOutsideCheckout) {
              throw new RedirectError(["../payment-method"], this.activatedRoute);
            }
            return account;
          }),
        ),
    ),
    accountToBillableEntity,
    switchMap(async (account) => {
      const [paymentMethod, credit] = await Promise.all([
        this.billingClient.getPaymentMethod(account),
        this.billingClient.getCredit(account),
      ]);

      return {
        account,
        paymentMethod,
        credit,
      };
    }),
    shareReplay({ bufferSize: 1, refCount: false }),
    catchError((error: unknown) => {
      if (error instanceof RedirectError) {
        return from(this.router.navigate(error.path, { relativeTo: error.relativeTo })).pipe(
          switchMap(() => EMPTY),
        );
      }
      throw error;
    }),
  );

  view$: Observable<View> = merge(
    this.load$.pipe(tap((view) => this.viewState$.next(view))),
    this.viewState$.pipe(filter((view): view is View => view !== null)),
  ).pipe(shareReplay({ bufferSize: 1, refCount: true }));

  constructor(
    private accountService: AccountService,
    private activatedRoute: ActivatedRoute,
    private billingClient: BillingClient,
    private configService: ConfigService,
    private router: Router,
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
