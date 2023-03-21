import { Component, OnInit, ViewChild } from "@angular/core";
import { FormBuilder, FormControl, Validators } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { I18nService } from "@bitwarden/common/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/abstractions/log.service";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/abstractions/organization/organization-api.service.abstraction";
import { PlatformUtilsService } from "@bitwarden/common/abstractions/platformUtils.service";
import { PaymentMethodType } from "@bitwarden/common/enums/paymentMethodType";
import { VerifyBankRequest } from "@bitwarden/common/models/request/verify-bank.request";
import { BillingPaymentResponse } from "@bitwarden/common/models/response/billing-payment.response";
import { OrganizationResponse } from "@bitwarden/common/models/response/organization.response";
import { Guid } from "@bitwarden/common/types/guid";

import { TaxInfoComponent } from "./tax-info.component";

@Component({
  selector: "app-payment-method",
  templateUrl: "payment-method.component.html",
})
// eslint-disable-next-line rxjs-angular/prefer-takeuntil
export class PaymentMethodComponent implements OnInit {
  @ViewChild(TaxInfoComponent) taxInfo: TaxInfoComponent;

  loading = false;
  firstLoaded = false;
  showAdjustPayment = false;
  showAddCredit = false;
  billing: BillingPaymentResponse;
  org: OrganizationResponse;
  paymentMethodType = PaymentMethodType;
  organizationId: Guid;

  verifyBankPromise: Promise<any>;
  taxFormPromise: Promise<any>;

  verifyBankForm = this.formBuilder.group({
    amount1: new FormControl<number>(null, [
      Validators.required,
      Validators.max(99),
      Validators.min(0),
    ]),
    amount2: new FormControl<number>(null, [
      Validators.required,
      Validators.max(99),
      Validators.min(0),
    ]),
  });

  constructor(
    protected apiService: ApiService,
    protected organizationApiService: OrganizationApiServiceAbstraction,
    protected i18nService: I18nService,
    protected platformUtilsService: PlatformUtilsService,
    private router: Router,
    private logService: LogService,
    private route: ActivatedRoute,
    private formBuilder: FormBuilder
  ) {}

  async ngOnInit() {
    // eslint-disable-next-line rxjs-angular/prefer-takeuntil, rxjs/no-async-subscribe
    this.route.params.subscribe(async (params) => {
      if (params.organizationId) {
        this.organizationId = params.organizationId;
      } else if (this.platformUtilsService.isSelfHost()) {
        this.router.navigate(["/settings/subscription"]);
        return;
      }

      await this.load();
      this.firstLoaded = true;
    });
  }

  async load() {
    if (this.loading) {
      return;
    }
    this.loading = true;

    if (this.forOrganization) {
      const billingPromise = this.organizationApiService.getBilling(this.organizationId);
      const orgPromise = this.organizationApiService.get(this.organizationId);

      [this.billing, this.org] = await Promise.all([billingPromise, orgPromise]);
    } else {
      this.billing = await this.apiService.getUserBillingPayment();
    }

    this.loading = false;
  }

  addCredit() {
    if (this.paymentSourceInApp) {
      this.platformUtilsService.showDialog(
        this.i18nService.t("cannotPerformInAppPurchase"),
        this.i18nService.t("addCredit"),
        null,
        null,
        "warning"
      );
      return;
    }
    this.showAddCredit = true;
  }

  closeAddCredit(load: boolean) {
    this.showAddCredit = false;
    if (load) {
      this.load();
    }
  }

  changePayment() {
    if (this.paymentSourceInApp) {
      this.platformUtilsService.showDialog(
        this.i18nService.t("cannotPerformInAppPurchase"),
        this.i18nService.t("changePaymentMethod"),
        null,
        null,
        "warning"
      );
      return;
    }
    this.showAdjustPayment = true;
  }

  closePayment(load: boolean) {
    this.showAdjustPayment = false;
    if (load) {
      this.load();
    }
  }

  async verifyBank() {
    if (this.loading || !this.forOrganization) {
      return;
    }

    try {
      const request = new VerifyBankRequest();
      request.amount1 = this.verifyBankForm.value.amount1;
      request.amount2 = this.verifyBankForm.value.amount2;
      this.verifyBankPromise = this.organizationApiService.verifyBank(this.organizationId, request);
      await this.verifyBankPromise;
      this.platformUtilsService.showToast(
        "success",
        null,
        this.i18nService.t("verifiedBankAccount")
      );
      this.load();
    } catch (e) {
      this.logService.error(e);
    }
  }

  async submitTaxInfo() {
    this.taxFormPromise = this.taxInfo.submitTaxInfo();
    await this.taxFormPromise;
    this.platformUtilsService.showToast("success", null, this.i18nService.t("taxInfoUpdated"));
  }

  get isCreditBalance() {
    return this.billing == null || this.billing.balance <= 0;
  }

  get creditOrBalance() {
    return Math.abs(this.billing != null ? this.billing.balance : 0);
  }

  get paymentSource() {
    return this.billing != null ? this.billing.paymentSource : null;
  }

  get forOrganization() {
    return this.organizationId != null;
  }

  get headerClass() {
    return this.forOrganization ? ["page-header"] : ["tabbed-header"];
  }

  get paymentSourceClasses() {
    if (this.paymentSource == null) {
      return [];
    }
    switch (this.paymentSource.type) {
      case PaymentMethodType.Card:
        return ["bwi-credit-card"];
      case PaymentMethodType.BankAccount:
        return ["bwi-bank"];
      case PaymentMethodType.Check:
        return ["bwi-money"];
      case PaymentMethodType.AppleInApp:
        return ["bwi-apple text-muted"];
      case PaymentMethodType.GoogleInApp:
        return ["bwi-google text-muted"];
      case PaymentMethodType.PayPal:
        return ["bwi-paypal text-primary"];
      default:
        return [];
    }
  }

  get paymentSourceInApp() {
    return (
      this.paymentSource != null &&
      (this.paymentSource.type === PaymentMethodType.AppleInApp ||
        this.paymentSource.type === PaymentMethodType.GoogleInApp)
    );
  }
}
