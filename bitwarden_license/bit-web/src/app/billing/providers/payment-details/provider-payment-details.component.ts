import { Component, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import {
  BehaviorSubject,
  combineLatest,
  EMPTY,
  filter,
  firstValueFrom,
  from,
  map,
  merge,
  Observable,
  of,
  shareReplay,
  Subject,
  switchMap,
  take,
  takeUntil,
  tap,
} from "rxjs";
import { catchError } from "rxjs/operators";

import { ProviderService } from "@bitwarden/common/admin-console/abstractions/provider.service";
import { Provider } from "@bitwarden/common/admin-console/models/domain/provider";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { SubscriberBillingClient } from "@bitwarden/web-vault/app/billing/clients";
import {
  DisplayAccountCreditComponent,
  DisplayBillingAddressComponent,
  DisplayPaymentMethodComponent,
} from "@bitwarden/web-vault/app/billing/payment/components";
import {
  BillingAddress,
  MaskedPaymentMethod,
} from "@bitwarden/web-vault/app/billing/payment/types";
import {
  BitwardenSubscriber,
  mapProviderToSubscriber,
} from "@bitwarden/web-vault/app/billing/types";
import { TaxIdWarningType } from "@bitwarden/web-vault/app/billing/warnings/types";
import { HeaderModule } from "@bitwarden/web-vault/app/layouts/header/header.module";
import { SharedModule } from "@bitwarden/web-vault/app/shared";

import { ProviderWarningsService } from "../warnings/services";

class RedirectError {
  constructor(
    public path: string[],
    public relativeTo: ActivatedRoute,
  ) {}
}

type View = {
  provider: BitwardenSubscriber;
  paymentMethod: MaskedPaymentMethod | null;
  billingAddress: BillingAddress | null;
  credit: number | null;
  taxIdWarning: TaxIdWarningType | null;
};

@Component({
  templateUrl: "./provider-payment-details.component.html",
  imports: [
    DisplayAccountCreditComponent,
    DisplayBillingAddressComponent,
    DisplayPaymentMethodComponent,
    HeaderModule,
    SharedModule,
  ],
})
export class ProviderPaymentDetailsComponent implements OnInit, OnDestroy {
  private viewState$ = new BehaviorSubject<View | null>(null);

  private provider$ = combineLatest([
    this.activatedRoute.params,
    this.accountService.activeAccount$.pipe(getUserId),
  ]).pipe(
    switchMap(([{ providerId }, userId]) => this.providerService.get$(providerId, userId)),
    filter((provider) => provider != null),
  );

  private load$: Observable<View> = this.provider$.pipe(
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
    mapProviderToSubscriber,
    switchMap(async (provider) => {
      const getTaxIdWarning = firstValueFrom(
        this.providerWarningsService.getTaxIdWarning$(provider.data as Provider),
      );

      const [paymentMethod, billingAddress, credit, taxIdWarning] = await Promise.all([
        this.billingClient.getPaymentMethod(provider),
        this.billingClient.getBillingAddress(provider),
        this.billingClient.getCredit(provider),
        getTaxIdWarning,
      ]);

      return {
        provider,
        paymentMethod,
        billingAddress,
        credit,
        taxIdWarning,
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

  private destroy$ = new Subject<void>();

  protected enableTaxIdWarning!: boolean;

  constructor(
    private activatedRoute: ActivatedRoute,
    private billingClient: SubscriberBillingClient,
    private configService: ConfigService,
    private providerService: ProviderService,
    private providerWarningsService: ProviderWarningsService,
    private router: Router,
    private subscriberBillingClient: SubscriberBillingClient,
    private accountService: AccountService,
  ) {}

  async ngOnInit() {
    this.enableTaxIdWarning = await this.configService.getFeatureFlag(
      FeatureFlag.PM22415_TaxIDWarnings,
    );

    if (this.enableTaxIdWarning) {
      this.providerWarningsService.taxIdWarningRefreshed$
        .pipe(
          switchMap((warning) =>
            combineLatest([
              of(warning),
              this.provider$.pipe(take(1)).pipe(
                mapProviderToSubscriber,
                switchMap((provider) => this.subscriberBillingClient.getBillingAddress(provider)),
              ),
            ]),
          ),
          takeUntil(this.destroy$),
        )
        .subscribe(([taxIdWarning, billingAddress]) => {
          if (this.viewState$.value) {
            this.viewState$.next({
              ...this.viewState$.value,
              taxIdWarning,
              billingAddress,
            });
          }
        });
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  setBillingAddress = (billingAddress: BillingAddress) => {
    if (this.viewState$.value) {
      if (
        this.enableTaxIdWarning &&
        this.viewState$.value.billingAddress?.taxId !== billingAddress.taxId
      ) {
        this.providerWarningsService.refreshTaxIdWarning();
      }
      this.viewState$.next({
        ...this.viewState$.value,
        billingAddress,
      });
    }
  };

  setPaymentMethod = async (paymentMethod: MaskedPaymentMethod) => {
    if (this.viewState$.value) {
      const billingAddress =
        this.viewState$.value.billingAddress ??
        (await this.subscriberBillingClient.getBillingAddress(this.viewState$.value.provider));

      this.viewState$.next({
        ...this.viewState$.value,
        paymentMethod,
        billingAddress,
      });
    }
  };
}
