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

import { ProviderService } from "@bitwarden/common/admin-console/abstractions/provider.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import {
  DisplayAccountCreditComponent,
  DisplayBillingAddressComponent,
  DisplayPaymentMethodComponent,
} from "@bitwarden/web-vault/app/billing/payment/components";
import {
  BillingAddress,
  MaskedPaymentMethod,
} from "@bitwarden/web-vault/app/billing/payment/types";
import { BillingClient } from "@bitwarden/web-vault/app/billing/services";
import { BillableEntity, providerToBillableEntity } from "@bitwarden/web-vault/app/billing/types";
import { HeaderModule } from "@bitwarden/web-vault/app/layouts/header/header.module";
import { SharedModule } from "@bitwarden/web-vault/app/shared";

class RedirectError {
  constructor(
    public path: string[],
    public relativeTo: ActivatedRoute,
  ) {}
}

type View = {
  provider: BillableEntity;
  paymentMethod: MaskedPaymentMethod | null;
  billingAddress: BillingAddress | null;
  credit: number | null;
};

@Component({
  templateUrl: "./provider-payment-details.component.html",
  standalone: true,
  imports: [
    DisplayBillingAddressComponent,
    DisplayAccountCreditComponent,
    DisplayPaymentMethodComponent,
    HeaderModule,
    SharedModule,
  ],
  providers: [BillingClient],
})
export class ProviderPaymentDetailsComponent {
  private viewState$ = new BehaviorSubject<View | null>(null);

  private load$: Observable<View> = this.activatedRoute.params.pipe(
    switchMap(({ providerId }) => this.providerService.get$(providerId)),
    switchMap((provider) =>
      this.configService
        .getFeatureFlag$(FeatureFlag.PM21881_ManagePaymentDetailsOutsideCheckout)
        .pipe(
          map((managePaymentDetailsOutsideCheckout) => {
            if (!managePaymentDetailsOutsideCheckout) {
              throw new RedirectError(["../subscription"], this.activatedRoute);
            }
            return provider;
          }),
        ),
    ),
    providerToBillableEntity,
    switchMap(async (provider) => {
      const [paymentMethod, billingAddress, credit] = await Promise.all([
        this.billingClient.getPaymentMethod(provider),
        this.billingClient.getBillingAddress(provider),
        this.billingClient.getCredit(provider),
      ]);

      return {
        provider,
        paymentMethod,
        billingAddress,
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
    private activatedRoute: ActivatedRoute,
    private billingClient: BillingClient,
    private configService: ConfigService,
    private providerService: ProviderService,
    private router: Router,
  ) {}

  setBillingAddress = (billingAddress: BillingAddress) => {
    if (this.viewState$.value) {
      this.viewState$.next({
        ...this.viewState$.value,
        billingAddress,
      });
    }
  };

  setPaymentMethod = (paymentMethod: MaskedPaymentMethod) => {
    if (this.viewState$.value) {
      this.viewState$.next({
        ...this.viewState$.value,
        paymentMethod,
      });
    }
  };
}
