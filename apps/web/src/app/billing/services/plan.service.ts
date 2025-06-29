import { Injectable } from "@angular/core";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationSubscriptionResponse } from "@bitwarden/common/billing/models/response/organization-subscription.response";
import { PlanResponse } from "@bitwarden/common/billing/models/response/plan.response";

@Injectable({ providedIn: "root" })
export class PlanService {
  constructor(private apiService: ApiService) {}

  async getPlanCards(
    currentPlan: PlanResponse,
    subscription: OrganizationSubscriptionResponse,
    isTrial: boolean = false,
  ) {
    const plans = await this.apiService.getPlans();

    const filteredPlans = plans.data.filter((plan) => !!plan.PasswordManager);

    const result =
      filteredPlans?.filter(
        (plan) => plan.productTier === currentPlan.productTier && this.planIsEnabled(plan),
      ) || [];

    return result.map((plan) => {
      let costPerMember = 0;

      if (plan.PasswordManager.basePrice) {
        costPerMember = plan.isAnnual
          ? plan.PasswordManager.basePrice / 12
          : plan.PasswordManager.basePrice;
      } else if (!plan.PasswordManager.basePrice && plan.PasswordManager.hasAdditionalSeatsOption) {
        costPerMember =
          ((subscription.useSecretsManager ? plan.SecretsManager.seatPrice : 0) +
            plan.PasswordManager.seatPrice) /
          (plan.isAnnual ? 12 : 1);
      }

      const percentOff = subscription.customerDiscount?.percentOff ?? 0;

      const discount = percentOff === 0 && plan.isAnnual ? 20 : percentOff;

      return {
        title: isTrial ? (plan.isAnnual ? "Annually" : "Monthly") : plan.name,
        costPerMember,
        discount,
        isDisabled: false,
        isSelected: false,
        isAnnual: plan.isAnnual,
        productTier: plan.productTier,
      };
    });
  }

  private planIsEnabled(plan: PlanResponse) {
    return !plan.disabled && !plan.legacyYear;
  }
}
