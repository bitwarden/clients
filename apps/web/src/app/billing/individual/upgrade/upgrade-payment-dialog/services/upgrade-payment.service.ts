import { Injectable } from "@angular/core";

import { OrganizationResponse } from "@bitwarden/common/admin-console/models/response/organization.response";
import { Account } from "@bitwarden/common/auth/abstractions/account.service";
import {
  OrganizationBillingServiceAbstraction,
  SubscriptionInformation,
} from "@bitwarden/common/billing/abstractions";
import { TaxServiceAbstraction } from "@bitwarden/common/billing/abstractions/tax.service.abstraction";
import { PaymentMethodType, PlanType } from "@bitwarden/common/billing/enums";
import { PreviewIndividualInvoiceRequest } from "@bitwarden/common/billing/models/request/preview-individual-invoice.request";
import { PreviewOrganizationInvoiceRequest } from "@bitwarden/common/billing/models/request/preview-organization-invoice.request";
import { LogService } from "@bitwarden/logging";

import { SubscriberBillingClient } from "../../../../clients";
import {
  BillingAddress,
  TokenizablePaymentMethod,
  TokenizedPaymentMethod,
} from "../../../../payment/types";
import { BitwardenSubscriber } from "../../../../types";
import {
  PersonalSubscriptionPricingTier,
  PersonalSubscriptionPricingTierId,
  PersonalSubscriptionPricingTierIds,
} from "../../../../types/subscription-pricing-tier";

type TaxInformation = {
  postalCode: string;
  country: string;
  taxId: string | null;
};

export type PlanDetails = {
  tier: PersonalSubscriptionPricingTierId;
  details: PersonalSubscriptionPricingTier;
};

export type PaymentFormValues = {
  organizationName: string;
  billingAddress: {
    country: string;
    postalCode: string;
  };
};

/**
 * Service for handling payment submission and sales tax calculation for upgrade payment component
 */
@Injectable()
export class UpgradePaymentService {
  constructor(
    private organizationBillingService: OrganizationBillingServiceAbstraction,
    private subscriberBillingClient: SubscriberBillingClient,
    private taxService: TaxServiceAbstraction,
    private logService: LogService,
  ) {}

  /**
   * Calculate estimated tax for the selected plan
   */
  async calculateEstimatedTax(
    planDetails: PlanDetails,
    billingAddress: Pick<BillingAddress, "country" | "postalCode">,
  ): Promise<number> {
    try {
      const taxInformation: TaxInformation = {
        postalCode: billingAddress.postalCode,
        country: billingAddress.country,
        // This is null for now since we only process Families and Premium plans
        taxId: null,
      };

      const isOrganizationPlan = planDetails.tier === PersonalSubscriptionPricingTierIds.Families;
      const isPremiumPlan = planDetails.tier === PersonalSubscriptionPricingTierIds.Premium;

      let taxServiceCall: Promise<{ taxAmount: number }> | null = null;

      if (isOrganizationPlan) {
        const seats = this.getPasswordManagerSeats(planDetails);
        if (seats === 0) {
          throw new Error("Seats must be greater than 0 for organization plan");
        }
        // Currently, only Families plan is supported for organization plans
        const request: PreviewOrganizationInvoiceRequest = {
          passwordManager: {
            additionalStorage: 0,
            plan: PlanType.FamiliesAnnually,
            seats: seats,
          },
          taxInformation,
        };

        taxServiceCall = this.taxService.previewOrganizationInvoice(request);
      }

      if (isPremiumPlan) {
        const request: PreviewIndividualInvoiceRequest = {
          passwordManager: { additionalStorage: 0 },
          taxInformation: {
            postalCode: billingAddress.postalCode,
            country: billingAddress.country,
          },
        };

        taxServiceCall = this.taxService.previewIndividualInvoice(request);
      }

      if (taxServiceCall === null) {
        throw new Error("Tax service call is not defined");
      }

      const invoice = await taxServiceCall;
      return invoice.taxAmount;
    } catch (error: unknown) {
      this.logService.error("Tax calculation failed:", error);
      throw error;
    }
  }

  /**
   * Process premium upgrade
   */
  async upgradeToPremium(
    subscriber: BitwardenSubscriber,
    paymentMethod: TokenizedPaymentMethod,
    billingAddress: Pick<BillingAddress, "country" | "postalCode">,
  ): Promise<void> {
    this.validatePaymentAndBillingInfo(paymentMethod, billingAddress);

    await this.subscriberBillingClient.purchasePremiumSubscription(
      subscriber,
      paymentMethod,
      billingAddress,
    );
  }

  /**
   * Process families upgrade
   */
  async upgradeToFamilies(
    subscriber: BitwardenSubscriber,
    planDetails: PlanDetails,
    paymentMethod: TokenizedPaymentMethod,
    formValues: PaymentFormValues,
  ): Promise<OrganizationResponse> {
    if (subscriber.type !== "account") {
      throw new Error("Subscriber must be an account for organization upgrade");
    }
    const user = subscriber.data as Account;
    const billingAddress = formValues.billingAddress;

    this.validatePaymentAndBillingInfo(paymentMethod, billingAddress);

    const passwordManagerSeats = this.getPasswordManagerSeats(planDetails);

    const subscriptionInformation: SubscriptionInformation = {
      organization: {
        name: formValues.organizationName,
        billingEmail: user.email,
      },
      plan: {
        type: PlanType.FamiliesAnnually,
        passwordManagerSeats: passwordManagerSeats,
      },
      payment: {
        paymentMethod: [
          paymentMethod.token,
          this.tokenizablePaymentMethodToLegacyEnum(paymentMethod.type),
        ],
        billing: {
          country: billingAddress.country,
          postalCode: billingAddress.postalCode,
        },
      },
    };

    return this.organizationBillingService.purchaseSubscription(subscriptionInformation, user.id);
  }

  /**
   * Convert tokenizable payment method to legacy enum
   * note: this will be removed once another PR is merged
   */
  tokenizablePaymentMethodToLegacyEnum(paymentMethod: TokenizablePaymentMethod): PaymentMethodType {
    switch (paymentMethod) {
      case "bankAccount":
        return PaymentMethodType.BankAccount;
      case "card":
        return PaymentMethodType.Card;
      case "payPal":
        return PaymentMethodType.PayPal;
    }
  }

  /**
   * Get annual plan type for a pricing tier
   * note: this will be removed once another PR is merged
   */
  getAnnualPlanType(tier: PersonalSubscriptionPricingTierId): PlanType {
    switch (tier) {
      case PersonalSubscriptionPricingTierIds.Families:
        return PlanType.FamiliesAnnually;
      default:
        throw new Error(`Unsupported tier for annual plan type: ${tier}`);
    }
  }

  private getPasswordManagerSeats(planDetails: PlanDetails): number {
    return "users" in planDetails.details.passwordManager
      ? planDetails.details.passwordManager.users
      : 0;
  }

  private validatePaymentAndBillingInfo(
    paymentMethod: TokenizedPaymentMethod,
    billingAddress: { country: string; postalCode: string },
  ): void {
    if (!paymentMethod?.token || !paymentMethod?.type) {
      throw new Error("Payment method type or token is missing");
    }

    if (!billingAddress?.country || !billingAddress?.postalCode) {
      throw new Error("Billing address information is incomplete");
    }
  }
}
