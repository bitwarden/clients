import { Component, EventEmitter, Input, Output, ViewChild } from "@angular/core";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { PaymentMethodWarningsServiceAbstraction as PaymentMethodWarningService } from "@bitwarden/common/billing/abstractions/payment-method-warnings-service.abstraction";
import { PaymentMethodType } from "@bitwarden/common/billing/enums";
import { PaymentRequest } from "@bitwarden/common/billing/models/request/payment.request";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";

import { PaymentComponent } from "./payment.component";
import { TaxInfoComponent } from "./tax-info.component";

@Component({
  selector: "app-adjust-payment",
  templateUrl: "adjust-payment.component.html",
})
export class AdjustPaymentComponent {
  @ViewChild(PaymentComponent, { static: true }) paymentComponent: PaymentComponent;
  @ViewChild(TaxInfoComponent, { static: true }) taxInfoComponent: TaxInfoComponent;

  @Input() currentType?: PaymentMethodType;
  @Input() organizationId: string;
  @Output() onAdjusted = new EventEmitter();
  @Output() onCanceled = new EventEmitter();

  paymentMethodType = PaymentMethodType;
  formPromise: Promise<void>;

  constructor(
    private apiService: ApiService,
    private i18nService: I18nService,
    private platformUtilsService: PlatformUtilsService,
    private logService: LogService,
    private organizationApiService: OrganizationApiServiceAbstraction,
    private paymentMethodWarningService: PaymentMethodWarningService,
  ) {}

  async submit() {
    try {
      const request = new PaymentRequest();
      this.formPromise = this.paymentComponent.createPaymentToken().then((result) => {
        request.paymentToken = result[0];
        request.paymentMethodType = result[1];
        request.postalCode = this.taxInfoComponent.taxInfo.postalCode;
        request.country = this.taxInfoComponent.taxInfo.country;
        if (this.organizationId == null) {
          return this.apiService.postAccountPayment(request);
        } else {
          request.taxId = this.taxInfoComponent.taxInfo.taxId;
          request.state = this.taxInfoComponent.taxInfo.state;
          request.line1 = this.taxInfoComponent.taxInfo.line1;
          request.line2 = this.taxInfoComponent.taxInfo.line2;
          request.city = this.taxInfoComponent.taxInfo.city;
          request.state = this.taxInfoComponent.taxInfo.state;
          return this.organizationApiService.updatePayment(this.organizationId, request);
        }
      });
      await this.formPromise;
      if (this.organizationId) {
        await this.paymentMethodWarningService.removeSubscriptionRisk(this.organizationId);
      }
      this.platformUtilsService.showToast(
        "success",
        null,
        this.i18nService.t("updatedPaymentMethod"),
      );
      this.onAdjusted.emit();
    } catch (e) {
      this.logService.error(e);
    }
  }

  cancel() {
    this.onCanceled.emit();
  }

  changeCountry() {
    if (this.taxInfoComponent.taxInfo.country === "US") {
      this.paymentComponent.hideBank = !this.organizationId;
    } else {
      this.paymentComponent.hideBank = true;
      if (this.paymentComponent.method === PaymentMethodType.BankAccount) {
        this.paymentComponent.method = PaymentMethodType.Card;
        this.paymentComponent.changeMethod();
      }
    }
  }
}
