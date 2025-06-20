import { Injectable } from "@angular/core";

import { PlanInterval, ProductTierType } from "@bitwarden/common/billing/enums";
import { PlanResponse } from "@bitwarden/common/billing/models/response/plan.response";

@Injectable()
export class PlanSelectionService {
  getPlanCardContainerClasses(
    plan: PlanResponse,
    index: number,
    isCardDisabled: (index: number) => boolean,
  ): string[] {
    const isSelected = plan.isAnnual;
    const isDisabled = isCardDisabled(index);

    if (isDisabled) {
      return [
        "tw-cursor-not-allowed",
        "tw-bg-secondary-100",
        "tw-font-normal",
        "tw-bg-blur",
        "tw-text-muted",
        "tw-block",
        "tw-rounded",
      ];
    }

    return isSelected
      ? [
          "tw-cursor-pointer",
          "tw-block",
          "tw-rounded",
          "tw-border",
          "tw-border-solid",
          "tw-border-primary-600",
          "hover:tw-border-primary-700",
          "focus:tw-border-2",
          "focus:tw-border-primary-700",
          "focus:tw-rounded-lg",
        ]
      : [
          "tw-cursor-pointer",
          "tw-block",
          "tw-rounded",
          "tw-border",
          "tw-border-solid",
          "tw-border-secondary-300",
          "hover:tw-border-text-main",
          "focus:tw-border-2",
          "focus:tw-border-primary-700",
        ];
  }

  selectPlan(
    plan: PlanResponse,
    selectedInterval: number,
    currentPlan: PlanResponse,
    onPlanSelected: (selectedPlan: PlanResponse) => void,
  ): void {
    if (
      selectedInterval === PlanInterval.Monthly &&
      plan.productTier === ProductTierType.Families
    ) {
      return;
    }

    onPlanSelected(plan);
  }

  getSelectablePlans(
    passwordManagerPlans: PlanResponse[],
    selectedPlan: PlanResponse,
    planIsEnabled: (plan: PlanResponse) => boolean,
  ): PlanResponse[] {
    const result =
      passwordManagerPlans?.filter(
        (plan) => plan.productTier === selectedPlan.productTier && planIsEnabled(plan),
      ) || [];

    result.sort((planA, planB) => planA.displaySortOrder - planB.displaySortOrder).reverse();
    return result;
  }

  handleKeydown(
    event: KeyboardEvent,
    index: number,
    isCardDisabled: (index: number) => boolean,
  ): void {
    const cardElements = Array.from(document.querySelectorAll(".product-card")) as HTMLElement[];
    let newIndex = index;
    const direction = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1;

    if (["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"].includes(event.key)) {
      do {
        newIndex = (newIndex + direction + cardElements.length) % cardElements.length;
      } while (isCardDisabled(newIndex) && newIndex !== index);

      event.preventDefault();

      setTimeout(() => {
        const card = cardElements[newIndex];
        if (
          !(
            card.classList.contains("tw-bg-secondary-100") &&
            card.classList.contains("tw-text-muted")
          )
        ) {
          card?.focus();
        }
      }, 0);
    }
  }
}
