import { Injectable } from "@angular/core";
import { defaultIfEmpty, find, map, mergeMap, Observable, switchMap } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { OrganizationResponse } from "@bitwarden/common/admin-console/models/response/organization.response";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import {
  OrganizationBillingServiceAbstraction,
  SubscriptionInformation,
} from "@bitwarden/common/billing/abstractions";
import { TaxServiceAbstraction } from "@bitwarden/common/billing/abstractions/tax.service.abstraction";
import { PaymentMethodType, PlanType } from "@bitwarden/common/billing/enums";
import { PreviewIndividualInvoiceRequest } from "@bitwarden/common/billing/models/request/preview-individual-invoice.request";
import { PreviewOrganizationInvoiceRequest } from "@bitwarden/common/billing/models/request/preview-organization-invoice.request";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
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
  organizationName?: string | null;
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
    private apiService: ApiService,
    private syncService: SyncService,
    private organizationService: OrganizationService,
    private accountService: AccountService,
  ) {}

  userIsOwnerOfFreeOrg$: Observable<boolean> = this.accountService.activeAccount$.pipe(
    getUserId,
    switchMap((id) => this.organizationService.organizations$(id)),
    mergeMap((userOrganizations) => userOrganizations),
    find((org) => org.isFreeOrg && org.isOwner),
    defaultIfEmpty(false),
    map((value) => value instanceof Organization),
  );

  adminConsoleRouteForOwnedOrganization$: Observable<string> =
    this.accountService.activeAccount$.pipe(
      getUserId,
      switchMap((id) => this.organizationService.organizations$(id)),
      mergeMap((userOrganizations) => userOrganizations),
      find((org) => org.isFreeOrg && org.isOwner),
      map((org) => `/organizations/${org!.id}/billing/subscription`),
    );

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

    await this.refreshAndSync();
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
      throw new Error("Subscriber must be an account for families upgrade");
    }
    const user = subscriber.data as Account;
    const billingAddress = formValues.billingAddress;

    if (!formValues.organizationName) {
      throw new Error("Organization name is required for families upgrade");
    }

    this.validatePaymentAndBillingInfo(paymentMethod, billingAddress);

    const passwordManagerSeats = this.getPasswordManagerSeats(planDetails);

    const subscriptionInformation: SubscriptionInformation = {
      organization: {
        name: formValues.organizationName,
        billingEmail: user.email, // Use account email as billing email
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

    const result = await this.organizationBillingService.purchaseSubscription(
      subscriptionInformation,
      user.id,
    );
    await this.refreshAndSync();
    return result;
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

  private async refreshAndSync(): Promise<void> {
    await this.apiService.refreshIdentityToken();
    await this.syncService.fullSync(true);
  }
}
