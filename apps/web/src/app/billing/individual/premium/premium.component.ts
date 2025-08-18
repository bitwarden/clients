// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, ViewChild } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormControl, FormGroup, Validators } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { combineLatest, concatMap, from, Observable, of, switchMap } from "rxjs";
import { debounceTime } from "rxjs/operators";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { TokenService } from "@bitwarden/common/auth/abstractions/token.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { TaxServiceAbstraction } from "@bitwarden/common/billing/abstractions/tax.service.abstraction";
import { PreviewIndividualInvoiceRequest } from "@bitwarden/common/billing/models/request/preview-individual-invoice.request";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SyncService } from "@bitwarden/common/platform/sync";
import { ToastService } from "@bitwarden/components";

import { PaymentComponent } from "../../shared/payment/payment.component";
import { TaxInfoComponent } from "../../shared/tax-info.component";

@Component({
  templateUrl: "./premium.component.html",
  standalone: false,
})
export class PremiumComponent {
  @ViewChild(PaymentComponent) paymentComponent: PaymentComponent;
  @ViewChild(TaxInfoComponent) taxInfoComponent: TaxInfoComponent;

  protected hasPremiumFromAnyOrganization$: Observable<boolean>;

  protected addOnFormGroup = new FormGroup({
    additionalStorage: new FormControl<number>(0, [Validators.min(0), Validators.max(99)]),
  });

  protected licenseFormGroup = new FormGroup({
    file: new FormControl<File>(null, [Validators.required]),
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
    private configService: ConfigService,
    private environmentService: EnvironmentService,
    private i18nService: I18nService,
    private platformUtilsService: PlatformUtilsService,
    private router: Router,
    private syncService: SyncService,
    private toastService: ToastService,
    private tokenService: TokenService,
    private taxService: TaxServiceAbstraction,
    private accountService: AccountService,
  ) {
    this.isSelfHost = this.platformUtilsService.isSelfHost();

    this.hasPremiumFromAnyOrganization$ = this.accountService.activeAccount$.pipe(
      switchMap((account) =>
        this.billingAccountProfileStateService.hasPremiumFromAnyOrganization$(account.id),
      ),
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

    this.addOnFormGroup.controls.additionalStorage.valueChanges
      .pipe(debounceTime(1000), takeUntilDestroyed())
      .subscribe(() => {
        this.refreshSalesTax();
      });
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

  onLicenseFileSelected = (event: Event): void => {
    const element = event.target as HTMLInputElement;
    this.licenseFormGroup.value.file = element.files.length > 0 ? element.files[0] : null;
  };

  submitPremiumLicense = async (): Promise<void> => {
    this.licenseFormGroup.markAllAsTouched();

    if (this.licenseFormGroup.invalid) {
      return this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("errorOccurred"),
        message: this.i18nService.t("selectFile"),
      });
    }

    const emailVerified = await this.tokenService.getEmailVerified();
    if (!emailVerified) {
      return this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("errorOccurred"),
        message: this.i18nService.t("verifyEmailFirst"),
      });
    }

    const formData = new FormData();
    formData.append("license", this.licenseFormGroup.value.file);

    await this.apiService.postAccountLicense(formData);
    await this.finalizeUpgrade();
    await this.postFinalizeUpgrade();
  };

  submitPayment = async (): Promise<void> => {
    this.taxInfoComponent.taxFormGroup.markAllAsTouched();
    if (this.taxInfoComponent.taxFormGroup.invalid) {
      return;
    }

    const { type, token } = await this.paymentComponent.tokenize();

    const formData = new FormData();
    formData.append("paymentMethodType", type.toString());
    formData.append("paymentToken", token);
    formData.append("additionalStorageGb", this.addOnFormGroup.value.additionalStorage.toString());
    formData.append("country", this.taxInfoComponent.country);
    formData.append("postalCode", this.taxInfoComponent.postalCode);

    await this.apiService.postPremium(formData);
    await this.finalizeUpgrade();
    await this.postFinalizeUpgrade();
  };

  protected get additionalStorageCost(): number {
    return this.storageGBPrice * this.addOnFormGroup.value.additionalStorage;
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

  private refreshSalesTax(): void {
    if (!this.taxInfoComponent.country || !this.taxInfoComponent.postalCode) {
      return;
    }
    const request: PreviewIndividualInvoiceRequest = {
      passwordManager: {
        additionalStorage: this.addOnFormGroup.value.additionalStorage,
      },
      taxInformation: {
        postalCode: this.taxInfoComponent.postalCode,
        country: this.taxInfoComponent.country,
      },
    };

    this.taxService
      .previewIndividualInvoice(request)
      .then((invoice) => {
        this.estimatedTax = invoice.taxAmount;
      })
      .catch((error) => {
        this.toastService.showToast({
          title: "",
          variant: "error",
          message: this.i18nService.t(error.message),
        });
      });
  }

  protected onTaxInformationChanged(): void {
    this.refreshSalesTax();
  }
}
