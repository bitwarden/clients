import { Component, Input } from "@angular/core";

import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { PlanInterval } from "@bitwarden/common/billing/enums";
import {
  BillingCustomerDiscount,
  OrganizationSubscriptionResponse,
} from "@bitwarden/common/billing/models/response/organization-subscription.response";
import { PlanResponse } from "@bitwarden/common/billing/models/response/plan.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { Discount, getLabel } from "@bitwarden/pricing";

export interface PricingSummaryData {
  selectedPlanInterval: string;
  passwordManagerSeats: number;
  passwordManagerSeatTotal: number;
  secretsManagerSeatTotal: number;
  additionalStorageTotal: number;
  additionalStoragePriceMonthly: number;
  additionalServiceAccountTotal: number;
  totalAppliedDiscount: number;
  secretsManagerSubtotal: number;
  passwordManagerSubtotal: number;
  total: number;
  organization?: Organization;
  sub?: OrganizationSubscriptionResponse;
  selectedPlan?: PlanResponse;
  selectedInterval?: PlanInterval;
  discountPercentageFromSub?: number;
  discountPercentage?: number;
  acceptingSponsorship?: boolean;
  additionalServiceAccount?: number;
  totalOpened?: boolean;
  storageGb?: number;
  isSecretsManagerTrial?: boolean;
  estimatedTax?: number;
  displayableDiscounts?: Discount[];
  activeDiscounts?: BillingCustomerDiscount[];
}

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-pricing-summary",
  templateUrl: "./pricing-summary.component.html",
  standalone: false,
})
export class PricingSummaryComponent {
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() summaryData!: PricingSummaryData;
  planIntervals = PlanInterval;

  constructor(private i18nService: I18nService) {}

  toggleTotalOpened(): void {
    if (this.summaryData) {
      this.summaryData.totalOpened = !this.summaryData.totalOpened;
    }
  }

  getDiscountLabel(discount: Discount): string {
    return getLabel(this.i18nService, discount);
  }

  calculateIndividualDiscountAmounts(baseAmount: number): number[] {
    const amounts: number[] = [];
    let running = baseAmount;
    for (const d of this.summaryData.activeDiscounts ?? []) {
      if (!d.active) {
        continue;
      }
      if (d.percentOff) {
        const saved = running * (d.percentOff / 100);
        amounts.push(Math.round(saved * 100) / 100);
        running -= saved;
      } else if (d.amountOff) {
        const saved = Math.min(d.amountOff, running);
        amounts.push(Math.round(saved * 100) / 100);
        running -= saved;
      }
    }
    return amounts;
  }
}
