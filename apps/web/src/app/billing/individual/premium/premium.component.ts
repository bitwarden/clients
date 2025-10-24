// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, ViewChild } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormControl, FormGroup, Validators } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import {
  catchError,
  combineLatest,
  concatMap,
  filter,
  from,
  map,
  Observable,
  of,
  shareReplay,
  startWith,
  switchMap,
} from "rxjs";
import { debounceTime } from "rxjs/operators";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { PaymentMethodType } from "@bitwarden/common/billing/enums";
import { DefaultSubscriptionPricingService } from "@bitwarden/common/billing/services/subscription-pricing.service";
import { PersonalSubscriptionPricingTierIds } from "@bitwarden/common/billing/types/subscription-pricing-tier";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SyncService } from "@bitwarden/common/platform/sync";
import { ToastService } from "@bitwarden/components";
import { SubscriberBillingClient, TaxClient } from "@bitwarden/web-vault/app/billing/clients";
import {
  EnterBillingAddressComponent,
  EnterPaymentMethodComponent,
  getBillingAddressFromForm,
} from "@bitwarden/web-vault/app/billing/payment/components";
import {
  NonTokenizablePaymentMethods,
  tokenizablePaymentMethodToLegacyEnum,
} from "@bitwarden/web-vault/app/billing/payment/types";
import { mapAccountToSubscriber } from "@bitwarden/web-vault/app/billing/types";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  templateUrl: "./premium.component.html",
  standalone: false,
  providers: [SubscriberBillingClient, TaxClient],
})
export class PremiumComponent {
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @ViewChild(EnterPaymentMethodComponent) enterPaymentMethodComponent!: EnterPaymentMethodComponent;

  protected hasPremiumFromAnyOrganization$: Observable<boolean>;
  protected hasEnoughAccountCredit$: Observable<boolean>;

  protected formGroup = new FormGroup({
    additionalStorage: new FormControl<number>(0, [Validators.min(0), Validators.max(99)]),
    paymentMethod: EnterPaymentMethodComponent.getFormGroup(),
    billingAddress: EnterBillingAddressComponent.getFormGroup(),
  });

  premiumPrices$ = this.subscriptionPricingService.getPersonalSubscriptionPricingTiers$().pipe(
    map((tiers) => {
      const premiumPlan = tiers.find(
        (tier) => tier.id === PersonalSubscriptionPricingTierIds.Premium,
      );

      if (!premiumPlan) {
        throw new Error("Could not find Premium plan");
      }

      return {
        seat: premiumPlan.passwordManager.annualPrice,
        storage: premiumPlan.passwordManager.annualPricePerAdditionalStorageGB,
      };
    }),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  premiumPrice$ = this.premiumPrices$.pipe(map((prices) => prices.seat));

  storagePrice$ = this.premiumPrices$.pipe(map((prices) => prices.storage));

  protected isLoadingPrices$ = this.premiumPrices$.pipe(
    map(() => false),
    startWith(true),
    catchError(() => of(false)),
  );

  storageCost$ = combineLatest([
    this.storagePrice$,
    this.formGroup.controls.additionalStorage.valueChanges.pipe(
      startWith(this.formGroup.value.additionalStorage),
    ),
  ]).pipe(map(([storagePrice, additionalStorage]) => storagePrice * additionalStorage));

  subtotal$ = combineLatest([this.premiumPrice$, this.storageCost$]).pipe(
    map(([premiumPrice, storageCost]) => premiumPrice + storageCost),
  );

  tax$ = this.formGroup.valueChanges.pipe(
    filter(() => this.formGroup.valid),
    debounceTime(1000),
    switchMap(async () => {
      const billingAddress = getBillingAddressFromForm(this.formGroup.controls.billingAddress);
      const taxAmounts = await this.taxClient.previewTaxForPremiumSubscriptionPurchase(
        this.formGroup.value.additionalStorage,
        billingAddress,
      );
      return taxAmounts.tax;
    }),
    startWith(0),
  );

  total$ = combineLatest([this.subtotal$, this.tax$]).pipe(
    map(([subtotal, tax]) => subtotal + tax),
  );

  protected cloudWebVaultURL: string;
  protected isSelfHost = false;
  protected readonly familyPlanMaxUserCount = 6;

  constructor(
    private activatedRoute: ActivatedRoute,
    private apiService: ApiService,
    private billingAccountProfileStateService: BillingAccountProfileStateService,
    private environmentService: EnvironmentService,
    private i18nService: I18nService,
    private platformUtilsService: PlatformUtilsService,
    private router: Router,
    private syncService: SyncService,
    private toastService: ToastService,
    private accountService: AccountService,
    private subscriberBillingClient: SubscriberBillingClient,
    private taxClient: TaxClient,
    private subscriptionPricingService: DefaultSubscriptionPricingService,
  ) {
    this.isSelfHost = this.platformUtilsService.isSelfHost();

    this.hasPremiumFromAnyOrganization$ = this.accountService.activeAccount$.pipe(
      switchMap((account) =>
        this.billingAccountProfileStateService.hasPremiumFromAnyOrganization$(account.id),
      ),
    );

    const accountCredit$ = this.accountService.activeAccount$.pipe(
      mapAccountToSubscriber,
      switchMap((account) => this.subscriberBillingClient.getCredit(account)),
    );

    this.hasEnoughAccountCredit$ = combineLatest([
      accountCredit$,
      this.total$,
      this.formGroup.controls.paymentMethod.controls.type.valueChanges.pipe(
        startWith(this.formGroup.value.paymentMethod.type),
      ),
    ]).pipe(
      map(([credit, total, paymentMethod]) => {
        if (paymentMethod !== NonTokenizablePaymentMethods.accountCredit) {
          return true;
        }
        return credit >= total;
      }),
    );

    combineLatest([
      this.accountService.activeAccount$.pipe(
        switchMap((account) =>
          this.billingAccountProfileStateService.hasPremiumPersonally$(account.id),
        ),
      ),
      this.environmentService.cloudWebVaultUrl$,
    ])
      .pipe(
        takeUntilDestroyed(),
        concatMap(([hasPremiumPersonally, cloudWebVaultURL]) => {
          if (hasPremiumPersonally) {
            return from(this.navigateToSubscriptionPage());
          }

          this.cloudWebVaultURL = cloudWebVaultURL;
          return of(true);
        }),
      )
      .subscribe();
  }

  finalizeUpgrade = async () => {
    await this.apiService.refreshIdentityToken();
    await this.syncService.fullSync(true);
  };

  postFinalizeUpgrade = async () => {
    this.toastService.showToast({
      variant: "success",
      title: null,
      message: this.i18nService.t("premiumUpdated"),
    });
    await this.navigateToSubscriptionPage();
  };

  navigateToSubscriptionPage = (): Promise<boolean> =>
    this.router.navigate(["../user-subscription"], { relativeTo: this.activatedRoute });

  submitPayment = async (): Promise<void> => {
    if (this.formGroup.invalid) {
      return;
    }

    // Check if account credit is selected
    const selectedPaymentType = this.formGroup.value.paymentMethod.type;

    let paymentMethodType: number;
    let paymentToken: string;

    if (selectedPaymentType === NonTokenizablePaymentMethods.accountCredit) {
      // Account credit doesn't need tokenization
      paymentMethodType = PaymentMethodType.Credit;
      paymentToken = "";
    } else {
      // Tokenize for card, bank account, or PayPal
      const paymentMethod = await this.enterPaymentMethodComponent.tokenize();
      paymentMethodType = tokenizablePaymentMethodToLegacyEnum(paymentMethod.type);
      paymentToken = paymentMethod.token;
    }

    const formData = new FormData();
    formData.append("paymentMethodType", paymentMethodType.toString());
    formData.append("paymentToken", paymentToken);
    formData.append("additionalStorageGb", this.formGroup.value.additionalStorage.toString());
    formData.append("country", this.formGroup.value.billingAddress.country);
    formData.append("postalCode", this.formGroup.value.billingAddress.postalCode);

    await this.apiService.postPremium(formData);
    await this.finalizeUpgrade();
    await this.postFinalizeUpgrade();
  };

  protected get premiumURL(): string {
    return `${this.cloudWebVaultURL}/#/settings/subscription/premium`;
  }

  protected async onLicenseFileSelectedChanged(): Promise<void> {
    await this.postFinalizeUpgrade();
  }
}
