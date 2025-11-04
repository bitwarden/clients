import { Component, input, output } from "@angular/core";

import { ProductTierType } from "@bitwarden/common/billing/enums";

export interface PlanCard {
  title: string;
  costPerMember: number;
  isDisabled: boolean;
  isAnnual: boolean;
  isSelected: boolean;
  productTier: ProductTierType;
}

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-plan-card",
  templateUrl: "./plan-card.component.html",
  standalone: false,
})
export class PlanCardComponent {
  readonly plan = input.required<PlanCard>();
  productTiers = ProductTierType;

  cardClicked = output();

  getPlanCardContainerClasses(): string[] {
    const isSelected = this.plan().isSelected;
    const isDisabled = this.plan().isDisabled;
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
          "tw-border-2",
          "tw-rounded-lg",
          "hover:tw-border-primary-700",
          "focus:tw-border-3",
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
}
