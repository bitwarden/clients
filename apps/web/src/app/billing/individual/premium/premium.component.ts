// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, ViewChild } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormControl, FormGroup, Validators } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { combineLatest, concatMap, from, map, Observable, of, startWith, switchMap } from "rxjs";
import { debounceTime } from "rxjs/operators";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { PaymentMethodType } from "@bitwarden/common/billing/enums";
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
  tokenizablePaymentMethodToLegacyEnum,
  NonTokenizablePaymentMethods,
} from "@bitwarden/web-vault/app/billing/payment/types";
import { mapAccountToSubscriber } from "@bitwarden/web-vault/app/billing/types";

@Component({
  templateUrl: "./premium.component.html",
  standalone: false,
  providers: [SubscriberBillingClient, TaxClient],
})
export class PremiumComponent {
  @ViewChild(EnterPaymentMethodComponent) enterPaymentMethodComponent!: EnterPaymentMethodComponent;

  protected hasPremiumFromAnyOrganization$: Observable<boolean>;
  protected accountCredit$: Observable<number>;
  protected hasEnoughAccountCredit$: Observable<boolean>;

  protected formGroup = new FormGroup({
    additionalStorage: new FormControl<number>(0, [Validators.min(0), Validators.max(99)]),
    paymentMethod: EnterPaymentMethodComponent.getFormGroup(),
    billingAddress: EnterBillingAddressComponent.getFormGroup(),
  });

  protected cloudWebVaultURL: string;
  protected isSelfHost = false;

  protected estimatedTax: number = 0;
  protected readonly familyPlanMaxUserCount = 6;
  protected readonly premiumPrice = 10;
  protected readonly storageGBPrice = 4;

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
  ) {
    this.isSelfHost = this.platformUtilsService.isSelfHost();

    this.hasPremiumFromAnyOrganization$ = this.accountService.activeAccount$.pipe(
      switchMap((account) =>
        this.billingAccountProfileStateService.hasPremiumFromAnyOrganization$(account.id),
      ),
    );

    // Fetch account credit
    this.accountCredit$ = this.accountService.activeAccount$.pipe(
      mapAccountToSubscriber,
      switchMap((account) => this.subscriberBillingClient.getCredit(account)),
    );

    // Check if user has enough account credit for the purchase
    this.hasEnoughAccountCredit$ = combineLatest([
      this.accountCredit$,
      this.formGroup.valueChanges.pipe(startWith(this.formGroup.value)),
    ]).pipe(
      map(([credit, formValue]) => {
        const selectedPaymentType = formValue.paymentMethod?.type;
        if (selectedPaymentType !== NonTokenizablePaymentMethods.accountCredit) {
          return true; // Not using account credit, so this check doesn't apply
        }
        return credit >= this.total;
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

    this.formGroup.valueChanges
      .pipe(
        debounceTime(1000),
        switchMap(async () => await this.refreshSalesTax()),
        takeUntilDestroyed(),
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

    if (selectedPaymentType === "accountCredit") {
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

  protected get additionalStorageCost(): number {
    return this.storageGBPrice * this.formGroup.value.additionalStorage;
  }

  protected get premiumURL(): string {
    return `${this.cloudWebVaultURL}/#/settings/subscription/premium`;
  }

  protected get subtotal(): number {
    return this.premiumPrice + this.additionalStorageCost;
  }

  protected get total(): number {
    return this.subtotal + this.estimatedTax;
  }

  protected async onLicenseFileSelectedChanged(): Promise<void> {
    await this.postFinalizeUpgrade();
  }

  private async refreshSalesTax(): Promise<void> {
    if (this.formGroup.invalid) {
      return;
    }

    const billingAddress = getBillingAddressFromForm(this.formGroup.controls.billingAddress);

    const taxAmounts = await this.taxClient.previewTaxForPremiumSubscriptionPurchase(
      this.formGroup.value.additionalStorage,
      billingAddress,
    );

    this.estimatedTax = taxAmounts.tax;
  }
}
