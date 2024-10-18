import { Injectable } from "@angular/core";

import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { BillingSourceResponse } from "@bitwarden/common/billing/models/response/billing.response";
import { OrganizationSubscriptionResponse } from "@bitwarden/common/billing/models/response/organization-subscription.response";
import { PaymentSourceResponse } from "@bitwarden/common/billing/models/response/payment-source.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { FreeTrial } from "./../core/types/free-trial";

@Injectable({ providedIn: "root" })
export class TrialFlowService {
  constructor(private i18nService: I18nService) {}
  checkForOrgsWithUpcomingPaymentIssues(
    organization: Organization,
    organizationSubscription: OrganizationSubscriptionResponse,
    paymentSource: BillingSourceResponse | PaymentSourceResponse,
  ): FreeTrial {
    const trialEndDate = organizationSubscription?.subscription?.trialEndDate;
    const displayBanner =
      !paymentSource &&
      organization?.isOwner &&
      organizationSubscription?.subscription?.status === "trialing";
    const trialRemainingDays = trialEndDate ? this.calculateTrialRemainingDays(trialEndDate) : 0;
    const freeTrialMessage = this.getFreeTrialMessage(trialRemainingDays);

    return {
      remainingDays: trialRemainingDays,
      message: freeTrialMessage,
      shownBanner: displayBanner,
      organizationId: organization.id,
      organizationName: organization.name,
    };
  }

  calculateTrialRemainingDays(trialEndDate: string): number | undefined {
    const today = new Date();
    const trialEnd = new Date(trialEndDate);
    const timeDifference = trialEnd.getTime() - today.getTime();

    return Math.ceil(timeDifference / (1000 * 60 * 60 * 24));
  }

  getFreeTrialMessage(trialRemainingDays: number): string {
    if (trialRemainingDays >= 2) {
      return this.i18nService.t("freeTrialEndPrompt", trialRemainingDays);
    } else if (trialRemainingDays === 1) {
      return this.i18nService.t("freeTrialEndPromptForOneDayNoOrgName");
    } else {
      return this.i18nService.t("freeTrialEndingSoonWithoutOrgName");
    }
  }
}
