// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, OnInit, ViewChild } from "@angular/core";
import { FormControl, FormGroup, Validators } from "@angular/forms";
import { Router } from "@angular/router";
import { firstValueFrom, Observable } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { TokenService } from "@bitwarden/common/auth/abstractions/token.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { ToastService } from "@bitwarden/components";

import { PaymentComponent, TaxInfoComponent } from "../../shared";

@Component({
  templateUrl: "premium.component.html",
})
export class PremiumComponent implements OnInit {
  @ViewChild(PaymentComponent) paymentComponent: PaymentComponent;
  @ViewChild(TaxInfoComponent) taxInfoComponent: TaxInfoComponent;

  canAccessPremium$: Observable<boolean>;
  selfHosted = false;
  premiumPrice = 10;
  familyPlanMaxUserCount = 6;
  storageGbPrice = 4;
  cloudWebVaultUrl: string;
  licenseFile: File = null;

  formPromise: Promise<any>;
  protected licenseForm = new FormGroup({
    file: new FormControl(null, [Validators.required]),
  });
  protected addonForm = new FormGroup({
    additionalStorage: new FormControl(0, [Validators.max(99), Validators.min(0)]),
  });
  constructor(
    private apiService: ApiService,
    private i18nService: I18nService,
    private platformUtilsService: PlatformUtilsService,
    private tokenService: TokenService,
    private router: Router,
    private messagingService: MessagingService,
    private syncService: SyncService,
    private environmentService: EnvironmentService,
    private billingAccountProfileStateService: BillingAccountProfileStateService,
    private toastService: ToastService,
  ) {
    this.selfHosted = platformUtilsService.isSelfHost();
    this.canAccessPremium$ = billingAccountProfileStateService.hasPremiumFromAnySource$;
  }
  protected setSelectedFile(event: Event) {
    const fileInputEl = <HTMLInputElement>event.target;
    const file: File = fileInputEl.files.length > 0 ? fileInputEl.files[0] : null;
    this.licenseFile = file;
  }
  async ngOnInit() {
    this.cloudWebVaultUrl = await firstValueFrom(this.environmentService.cloudWebVaultUrl$);
    if (await firstValueFrom(this.billingAccountProfileStateService.hasPremiumPersonally$)) {
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.router.navigate(["/settings/subscription/user-subscription"]);
      return;
    }
  }
  submit = async () => {
    if (this.taxInfoComponent) {
      if (!this.taxInfoComponent?.taxFormGroup.valid) {
        this.taxInfoComponent.taxFormGroup.markAllAsTouched();
        return;
      }
    }
    this.licenseForm.markAllAsTouched();
    this.addonForm.markAllAsTouched();
    if (this.selfHosted) {
      if (this.licenseFile == null) {
        this.toastService.showToast({
          variant: "error",
          title: this.i18nService.t("errorOccurred"),
          message: this.i18nService.t("selectFile"),
        });
        return;
      }
    }

    if (this.selfHosted) {
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      if (!this.tokenService.getEmailVerified()) {
        this.toastService.showToast({
          variant: "error",
          title: this.i18nService.t("errorOccurred"),
          message: this.i18nService.t("verifyEmailFirst"),
        });
        return;
      }

      const fd = new FormData();
      fd.append("license", this.licenseFile);
      await this.apiService.postAccountLicense(fd).then(() => {
        return this.finalizePremium();
      });
    } else {
      await this.paymentComponent
        .createPaymentToken()
        .then((result) => {
          const fd = new FormData();
          fd.append("paymentMethodType", result[1].toString());
          if (result[0] != null) {
            fd.append("paymentToken", result[0]);
          }
          fd.append("additionalStorageGb", (this.additionalStorage || 0).toString());
          fd.append("country", this.taxInfoComponent?.taxFormGroup?.value.country);
          fd.append("postalCode", this.taxInfoComponent?.taxFormGroup?.value.postalCode);
          return this.apiService.postPremium(fd);
        })
        .then((paymentResponse) => {
          if (!paymentResponse.success && paymentResponse.paymentIntentClientSecret != null) {
            return this.paymentComponent.handleStripeCardPayment(
              paymentResponse.paymentIntentClientSecret,
              () => this.finalizePremium(),
            );
          } else {
            return this.finalizePremium();
          }
        });
    }
  };

  async finalizePremium() {
    await this.apiService.refreshIdentityToken();
    await this.syncService.fullSync(true);
    this.toastService.showToast({
      variant: "success",
      title: null,
      message: this.i18nService.t("premiumUpdated"),
    });
    await this.router.navigate(["/settings/subscription/user-subscription"]);
  }

  get additionalStorage(): number {
    return this.addonForm.get("additionalStorage").value;
  }
  get additionalStorageTotal(): number {
    return this.storageGbPrice * Math.abs(this.additionalStorage || 0);
  }

  get subtotal(): number {
    return this.premiumPrice + this.additionalStorageTotal;
  }

  get taxCharges(): number {
    return this.taxInfoComponent != null && this.taxInfoComponent.taxRate != null
      ? (this.taxInfoComponent.taxRate / 100) * this.subtotal
      : 0;
  }

  get total(): number {
    return this.subtotal + this.taxCharges || 0;
  }
}
