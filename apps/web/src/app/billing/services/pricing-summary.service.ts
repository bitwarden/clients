import { Injectable } from "@angular/core";

import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { TaxServiceAbstraction } from "@bitwarden/common/billing/abstractions/tax.service.abstraction";
import { PlanInterval, ProductTierType } from "@bitwarden/common/billing/enums";
import { TaxInformation } from "@bitwarden/common/billing/models/domain/tax-information";
import { PreviewOrganizationInvoiceRequest } from "@bitwarden/common/billing/models/request/preview-organization-invoice.request";
import { OrganizationSubscriptionResponse } from "@bitwarden/common/billing/models/response/organization-subscription.response";
import { PlanResponse } from "@bitwarden/common/billing/models/response/plan.response";

import { PricingSummaryData } from "../shared/pricing-summary/pricing-summary.component";

@Injectable({
  providedIn: "root",
})
export class PricingSummaryService {
  private estimatedTax: number = 0;

  constructor(private taxService: TaxServiceAbstraction) {}

  async getPricingSummaryData(
    plan: PlanResponse,
    sub: OrganizationSubscriptionResponse,
    organization: Organization,
    selectedInterval: PlanInterval,
    taxInformation: TaxInformation,
    isSecretsManagerTrial: boolean,
  ): Promise<PricingSummaryData> {
    // Calculation helpers
    const passwordManagerSeatTotal =
      plan.PasswordManager?.hasAdditionalSeatsOption && !isSecretsManagerTrial
        ? plan.PasswordManager.seatPrice * Math.abs(sub?.seats || 0)
        : 0;

    const secretsManagerSeatTotal = plan.SecretsManager?.hasAdditionalSeatsOption
      ? plan.SecretsManager.seatPrice * Math.abs(sub?.smSeats || 0)
      : 0;

    const additionalServiceAccount = this.getAdditionalServiceAccount(plan, sub);

    const additionalStorageTotal = plan.PasswordManager?.hasAdditionalStorageOption
      ? plan.PasswordManager.additionalStoragePricePerGb *
        (sub?.maxStorageGb ? sub.maxStorageGb - 1 : 0)
      : 0;

    const additionalStoragePriceMonthly = plan.PasswordManager?.additionalStoragePricePerGb || 0;

    const additionalServiceAccountTotal =
      plan.SecretsManager?.hasAdditionalServiceAccountOption && additionalServiceAccount > 0
        ? plan.SecretsManager.additionalPricePerServiceAccount * additionalServiceAccount
        : 0;

    let passwordManagerSubtotal = plan.PasswordManager?.basePrice || 0;
    if (plan.PasswordManager?.hasAdditionalSeatsOption) {
      passwordManagerSubtotal += passwordManagerSeatTotal;
    }
    if (plan.PasswordManager?.hasPremiumAccessOption) {
      passwordManagerSubtotal += plan.PasswordManager.premiumAccessOptionPrice;
    }

    const secretsManagerSubtotal = plan.SecretsManager
      ? (plan.SecretsManager.basePrice || 0) +
        secretsManagerSeatTotal +
        additionalServiceAccountTotal
      : 0;

    const totalAppliedDiscount = 0;
    const discountPercentageFromSub = isSecretsManagerTrial
      ? 0
      : (sub?.customerDiscount?.percentOff ?? 0);
    const discountPercentage = 20;
    const acceptingSponsorship = false;
    const storageGb = sub?.maxStorageGb ? sub?.maxStorageGb - 1 : 0;

    this.estimatedTax = await this.getEstimatedTax(organization, plan, sub, taxInformation);

    const total = organization?.useSecretsManager
      ? passwordManagerSubtotal +
        additionalStorageTotal +
        secretsManagerSubtotal +
        this.estimatedTax
      : passwordManagerSubtotal + additionalStorageTotal + this.estimatedTax;

    return {
      selectedPlanInterval: selectedInterval === PlanInterval.Annually ? "year" : "month",
      passwordManagerSeats:
        plan.productTier === ProductTierType.Families ? plan.PasswordManager.baseSeats : sub?.seats,
      passwordManagerSeatTotal,
      secretsManagerSeatTotal,
      additionalStorageTotal,
      additionalStoragePriceMonthly,
      additionalServiceAccountTotal,
      totalAppliedDiscount,
      secretsManagerSubtotal,
      passwordManagerSubtotal,
      total,
      organization,
      sub,
      selectedPlan: plan,
      selectedInterval,
      discountPercentageFromSub,
      discountPercentage,
      acceptingSponsorship,
      additionalServiceAccount,
      storageGb,
      isSecretsManagerTrial,
      estimatedTax: this.estimatedTax,
    };
  }

  async getEstimatedTax(
    organization: Organization,
    currentPlan: PlanResponse,
    sub: OrganizationSubscriptionResponse,
    taxInformation: TaxInformation,
  ) {
    if (!taxInformation || !taxInformation.country || !taxInformation.postalCode) {
      return 0;
    }

    const request: PreviewOrganizationInvoiceRequest = {
      organizationId: organization.id,
      passwordManager: {
        additionalStorage: 0,
        plan: currentPlan?.type,
        seats: sub.seats,
      },
      taxInformation: {
        postalCode: taxInformation.postalCode,
        country: taxInformation.country,
        taxId: taxInformation.taxId,
      },
    };

    if (organization.useSecretsManager) {
      request.secretsManager = {
        seats: sub.smSeats ?? 0,
        additionalMachineAccounts:
          (sub.smServiceAccounts ?? 0) - (sub.plan.SecretsManager?.baseServiceAccount ?? 0),
      };
    }
    const invoiceResponse = await this.taxService.previewOrganizationInvoice(request);
    return invoiceResponse.taxAmount;
  }

  getAdditionalServiceAccount(plan: PlanResponse, sub: OrganizationSubscriptionResponse): number {
    if (!plan || !plan.SecretsManager) {
      return 0;
    }
    const baseServiceAccount = plan.SecretsManager?.baseServiceAccount || 0;
    const usedServiceAccounts = sub?.smServiceAccounts || 0;
    const additionalServiceAccounts = baseServiceAccount - usedServiceAccounts;
    return additionalServiceAccounts <= 0 ? Math.abs(additionalServiceAccounts) : 0;
  }
}
