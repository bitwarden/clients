import { Component, OnInit, ViewChild } from "@angular/core";
import { FormBuilder, FormControl, Validators } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { PaymentMethodType } from "@bitwarden/common/billing/enums";
import { BillingPaymentResponse } from "@bitwarden/common/billing/models/response/billing-payment.response";
import { OrganizationSubscriptionResponse } from "@bitwarden/common/billing/models/response/organization-subscription.response";
import { SubscriptionResponse } from "@bitwarden/common/billing/models/response/subscription.response";
import { VerifyBankRequest } from "@bitwarden/common/models/request/verify-bank.request";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { DialogService } from "@bitwarden/components";

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
  org: OrganizationSubscriptionResponse;
  sub: SubscriptionResponse;
  paymentMethodType = PaymentMethodType;
  organizationId: string;
  isUnpaid = false;

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
    private formBuilder: FormBuilder,
    private dialogService: DialogService
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
      const organizationSubscriptionPromise = this.organizationApiService.getSubscription(
        this.organizationId
      );

      [this.billing, this.org] = await Promise.all([
        billingPromise,
        organizationSubscriptionPromise,
      ]);
    } else {
      const billingPromise = this.apiService.getUserBillingPayment();
      const subPromise = this.apiService.getUserSubscription();

      [this.billing, this.sub] = await Promise.all([billingPromise, subPromise]);
    }

    this.isUnpaid = this.subscription?.status === "unpaid" ?? false;

    this.loading = false;
  }

  addCredit() {
    if (this.paymentSourceInApp) {
      this.dialogService.openSimpleDialog({
        title: { key: "addCredit" },
        content: { key: "cannotPerformInAppPurchase" },
        acceptButtonText: { key: "ok" },
        cancelButtonText: null,
        type: "warning",
      });

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
      this.dialogService.openSimpleDialog({
        title: { key: "changePaymentMethod" },
        content: { key: "cannotPerformInAppPurchase" },
        acceptButtonText: { key: "ok" },
        cancelButtonText: null,
        type: "warning",
      });

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

  get subscription() {
    return this.sub?.subscription ?? this.org?.subscription ?? null;
  }
}
