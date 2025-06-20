import { Injectable } from "@angular/core";

import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { ProductTierType } from "@bitwarden/common/billing/enums";
import { OrganizationSubscriptionResponse } from "@bitwarden/common/billing/models/response/organization-subscription.response";
import { PlanResponse } from "@bitwarden/common/billing/models/response/plan.response";

@Injectable()
export class PricingCalculationService {
  calculatePasswordManagerSubtotal(
    selectedPlan: PlanResponse,
    subscription: OrganizationSubscriptionResponse,
    discount: number,
  ): number {
    if (!selectedPlan || !selectedPlan.PasswordManager) {
      return 0;
    }

    let subTotal = selectedPlan.PasswordManager.basePrice;
    if (selectedPlan.PasswordManager.hasAdditionalSeatsOption) {
      subTotal += this.calculatePasswordManagerSeatTotal(selectedPlan, subscription, false);
    }
    if (selectedPlan.PasswordManager.hasPremiumAccessOption) {
      subTotal += selectedPlan.PasswordManager.premiumAccessOptionPrice;
    }
    return subTotal - discount;
  }

  calculateSecretsManagerSubtotal(
    selectedPlan: PlanResponse,
    subscription: OrganizationSubscriptionResponse,
    secretsManagerTotal: number,
  ): number {
    const plan = selectedPlan;
    if (!plan || !plan.SecretsManager) {
      return secretsManagerTotal || 0;
    }

    if (secretsManagerTotal) {
      return secretsManagerTotal;
    }

    return (
      plan.SecretsManager.basePrice +
      this.calculateSecretsManagerSeatTotal(plan, subscription?.smSeats ?? 0) +
      this.calculateAdditionalServiceAccountTotal(plan, 0)
    ); // This will be calculated separately
  }

  getPasswordManagerSeats(
    selectedPlan: PlanResponse,
    subscription: OrganizationSubscriptionResponse,
  ): number {
    if (!selectedPlan) {
      return 0;
    }

    if (selectedPlan.productTier === ProductTierType.Families) {
      return selectedPlan.PasswordManager.baseSeats;
    }
    return subscription?.seats ?? 0;
  }

  calculateTotal(
    organization: Organization,
    selectedPlan: PlanResponse,
    passwordManagerSubtotal: number,
    estimatedTax: number,
    subscription: OrganizationSubscriptionResponse,
  ): number {
    if (!organization || !selectedPlan) {
      return 0;
    }

    if (organization.useSecretsManager) {
      return (
        this.calculateAdditionalStorageTotal(selectedPlan, subscription) +
        this.calculateSecretsManagerSubtotal(selectedPlan, subscription, 0) +
        estimatedTax
      );
    }
    return (
      passwordManagerSubtotal +
      this.calculateAdditionalStorageTotal(selectedPlan, subscription) +
      estimatedTax
    );
  }

  calculateAdditionalServiceAccount(
    currentPlan: PlanResponse,
    subscription: OrganizationSubscriptionResponse,
  ): number {
    if (!currentPlan || !currentPlan.SecretsManager) {
      return 0;
    }

    const baseServiceAccount = currentPlan.SecretsManager?.baseServiceAccount || 0;
    const usedServiceAccounts = subscription?.smServiceAccounts || 0;

    const additionalServiceAccounts = baseServiceAccount - usedServiceAccounts;

    return additionalServiceAccounts <= 0 ? Math.abs(additionalServiceAccounts) : 0;
  }

  calculatePasswordManagerSeatTotal(
    plan: PlanResponse,
    subscription: OrganizationSubscriptionResponse,
    isSecretsManagerTrial: boolean,
  ): number {
    if (!plan.PasswordManager.hasAdditionalSeatsOption || isSecretsManagerTrial) {
      return 0;
    }

    return plan.PasswordManager.seatPrice * Math.abs(subscription?.seats || 0);
  }

  calculateSecretsManagerSeatTotal(plan: PlanResponse, seats: number): number {
    if (!plan.SecretsManager.hasAdditionalSeatsOption) {
      return 0;
    }

    return plan.SecretsManager.seatPrice * Math.abs(seats || 0);
  }

  calculateAdditionalStorageTotal(
    plan: PlanResponse,
    subscription: OrganizationSubscriptionResponse,
  ): number {
    if (!plan.PasswordManager.hasAdditionalStorageOption) {
      return 0;
    }

    return (
      plan.PasswordManager.additionalStoragePricePerGb *
      Math.abs(subscription?.maxStorageGb ? subscription.maxStorageGb - 1 : 0)
    );
  }

  calculateAdditionalServiceAccountTotal(
    plan: PlanResponse,
    additionalServiceAccount: number,
  ): number {
    if (!plan.SecretsManager.hasAdditionalServiceAccountOption || additionalServiceAccount === 0) {
      return 0;
    }

    return plan.SecretsManager.additionalPricePerServiceAccount * additionalServiceAccount;
  }

  calculateTotalAppliedDiscount(total: number, discountPercentageFromSub: number): number {
    return total * (discountPercentageFromSub / 100);
  }
}
