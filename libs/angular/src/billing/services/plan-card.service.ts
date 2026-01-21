import { Injectable } from "@angular/core";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationSubscriptionResponse } from "@bitwarden/common/billing/models/response/organization-subscription.response";
import { PlanResponse } from "@bitwarden/common/billing/models/response/plan.response";

@Injectable({ providedIn: "root" })
export class PlanCardService {
  constructor(private apiService: ApiService) {}

  async getCadenceCards(
    currentPlan: PlanResponse,
    subscription: OrganizationSubscriptionResponse,
    isSecretsManagerTrial: boolean,
  ) {
    const plans = await this.apiService.getPlans();

    const filteredPlans = plans.data.filter((plan) => !!plan.PasswordManager);

    const result =
      filteredPlans?.filter(
        (plan) =>
          plan.productTier === currentPlan.productTier && !plan.disabled && !plan.legacyYear,
      ) || [];

    const planCards = result.map((plan) => {
      let costPerMember = 0;

      if (plan.PasswordManager.basePrice) {
        costPerMember = plan.isAnnual
          ? plan.PasswordManager.basePrice / 12
          : plan.PasswordManager.basePrice;
      } else if (!plan.PasswordManager.basePrice && plan.PasswordManager.hasAdditionalSeatsOption) {
        const secretsManagerCost = subscription.useSecretsManager
          ? plan.SecretsManager.seatPrice
          : 0;
        const passwordManagerCost = isSecretsManagerTrial ? 0 : plan.PasswordManager.seatPrice;
        costPerMember = (secretsManagerCost + passwordManagerCost) / (plan.isAnnual ? 12 : 1);
      }

      const percentOff = subscription.customerDiscount?.percentOff ?? 0;

      const discount =
        (percentOff === 0 && plan.isAnnual) || isSecretsManagerTrial ? 20 : percentOff;

      return {
        title: plan.isAnnual ? "Annually" : "Monthly",
        costPerMember,
        discount,
        isDisabled: false,
        isSelected: plan.isAnnual,
        isAnnual: plan.isAnnual,
        productTier: plan.productTier,
      };
    });

    return planCards.reverse();
  }
}
