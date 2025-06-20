import { Injectable } from "@angular/core";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { BillingApiServiceAbstraction } from "@bitwarden/common/billing/abstractions";
import { TaxServiceAbstraction } from "@bitwarden/common/billing/abstractions/tax.service.abstraction";
import { ProductTierType } from "@bitwarden/common/billing/enums";
import { TaxInformation } from "@bitwarden/common/billing/models/domain";
import { ExpandedTaxInfoUpdateRequest } from "@bitwarden/common/billing/models/request/expanded-tax-info-update.request";
import { PaymentRequest } from "@bitwarden/common/billing/models/request/payment.request";
import { PreviewOrganizationInvoiceRequest } from "@bitwarden/common/billing/models/request/preview-organization-invoice.request";
import { UpdatePaymentMethodRequest } from "@bitwarden/common/billing/models/request/update-payment-method.request";
import { OrganizationSubscriptionResponse } from "@bitwarden/common/billing/models/response/organization-subscription.response";
import { PlanResponse } from "@bitwarden/common/billing/models/response/plan.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ToastService } from "@bitwarden/components";

import { PaymentComponent } from "../payment/payment.component";

@Injectable()
export class TrialPaymentMethodService {
  isSecretsManagerTrial(subscription: OrganizationSubscriptionResponse): boolean {
    return (
      subscription?.subscription?.items?.some((item) =>
        subscription?.customerDiscount?.appliesTo?.includes(item.productId),
      ) ?? false
    );
  }

  shouldShowTaxIdField(
    organizationId: string,
    productTier: ProductTierType,
    providerId?: string,
  ): boolean {
    if (organizationId) {
      switch (productTier) {
        case ProductTierType.Free:
        case ProductTierType.Families:
          return false;
        default:
          return true;
      }
    } else {
      return !!providerId;
    }
  }

  async submitPayment(
    organizationId: string,
    paymentComponent: PaymentComponent,
    taxInformation: TaxInformation,
    billingApiService: BillingApiServiceAbstraction,
    apiService: ApiService,
  ): Promise<void> {
    if (organizationId) {
      await this.updateOrganizationPaymentMethod(
        organizationId,
        paymentComponent,
        taxInformation,
        billingApiService,
      );
    } else {
      await this.updatePremiumUserPaymentMethod(paymentComponent, taxInformation, apiService);
    }
  }

  async refreshSalesTax(
    organizationId: string,
    selectedPlan: PlanResponse,
    subscription: OrganizationSubscriptionResponse,
    organization: Organization,
    taxInformation: TaxInformation,
    taxService: TaxServiceAbstraction,
    i18nService: I18nService,
    toastService: ToastService,
  ): Promise<number> {
    const request: PreviewOrganizationInvoiceRequest = {
      organizationId: organizationId,
      passwordManager: {
        additionalStorage: 0,
        plan: selectedPlan?.type,
        seats: subscription.seats ?? 0,
      },
      taxInformation: {
        postalCode: taxInformation.postalCode,
        country: taxInformation.country,
        taxId: taxInformation.taxId,
      },
    };

    if (organization.useSecretsManager) {
      request.secretsManager = {
        seats: subscription.smSeats ?? 0,
        additionalMachineAccounts:
          (subscription.smServiceAccounts ?? 0) -
          (subscription.plan?.SecretsManager?.baseServiceAccount ?? 0),
      };
    }

    try {
      const invoice = await taxService.previewOrganizationInvoice(request);
      return invoice.taxAmount;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const translatedMessage = i18nService.t(errorMessage);
      toastService.showToast({
        title: "",
        variant: "error",
        message: !translatedMessage || translatedMessage === "" ? errorMessage : translatedMessage,
      });
      throw error;
    }
  }

  private async updateOrganizationPaymentMethod(
    organizationId: string,
    paymentComponent: PaymentComponent,
    taxInformation: TaxInformation,
    billingApiService: BillingApiServiceAbstraction,
  ): Promise<void> {
    const paymentSource = await paymentComponent.tokenize();

    const request = new UpdatePaymentMethodRequest();
    request.paymentSource = paymentSource;
    request.taxInformation = ExpandedTaxInfoUpdateRequest.From(taxInformation);

    await billingApiService.updateOrganizationPaymentMethod(organizationId, request);
  }

  private async updatePremiumUserPaymentMethod(
    paymentComponent: PaymentComponent,
    taxInformation: TaxInformation,
    apiService: ApiService,
  ): Promise<void> {
    const { type, token } = await paymentComponent.tokenize();

    const request = new PaymentRequest();
    request.paymentMethodType = type;
    request.paymentToken = token;
    request.country = taxInformation.country;
    request.postalCode = taxInformation.postalCode;
    request.taxId = taxInformation.taxId;
    request.state = taxInformation.state;
    request.line1 = taxInformation.line1;
    request.line2 = taxInformation.line2;
    request.city = taxInformation.city;
    request.state = taxInformation.state;

    await apiService.postAccountPayment(request);
  }
}
