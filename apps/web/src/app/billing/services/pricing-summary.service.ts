import { Injectable } from "@angular/core";

import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { PlanInterval, ProductTierType } from "@bitwarden/common/billing/enums";
import { OrganizationSubscriptionResponse } from "@bitwarden/common/billing/models/response/organization-subscription.response";
import { PlanResponse } from "@bitwarden/common/billing/models/response/plan.response";

import { PricingSummaryData } from "../shared/pricing-summary/pricing-summary.component";

@Injectable({
  providedIn: "root",
})
export class PricingSummaryService {
  async getPricingSummaryData(
    plan: PlanResponse,
    sub: OrganizationSubscriptionResponse,
    organization: Organization,
    selectedInterval: PlanInterval,
    isSecretsManagerTrial: boolean,
    estimatedTax: number,
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
        (sub.maxStorageGb - plan.PasswordManager.baseStorageGb)
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
    if (plan.PasswordManager?.hasAdditionalStorageOption) {
      passwordManagerSubtotal += additionalStorageTotal;
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
    const storageGb = sub?.maxStorageGb
      ? sub?.maxStorageGb - plan.PasswordManager.baseStorageGb
      : 0;

    const total = organization?.useSecretsManager
      ? passwordManagerSubtotal + secretsManagerSubtotal + estimatedTax
      : passwordManagerSubtotal + estimatedTax;

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
      estimatedTax,
    };
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
