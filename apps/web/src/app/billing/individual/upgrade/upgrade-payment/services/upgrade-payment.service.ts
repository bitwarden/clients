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
import { PaymentMethodType, PlanType } from "@bitwarden/common/billing/enums";
import {
  PersonalSubscriptionPricingTier,
  PersonalSubscriptionPricingTierId,
  PersonalSubscriptionPricingTierIds,
} from "@bitwarden/common/billing/types/subscription-pricing-tier";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { LogService } from "@bitwarden/logging";

import {
  AccountBillingClient,
  OrganizationSubscriptionPurchase,
  SubscriberBillingClient,
  TaxAmounts,
  TaxClient,
} from "../../../../clients";
import {
  BillingAddress,
  NonTokenizablePaymentMethods,
  NonTokenizedPaymentMethod,
  tokenizablePaymentMethodToLegacyEnum,
  TokenizedPaymentMethod,
} from "../../../../payment/types";
import { mapAccountToSubscriber } from "../../../../types";

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
    private accountBillingClient: AccountBillingClient,
    private taxClient: TaxClient,
    private logService: LogService,
    private apiService: ApiService,
    private syncService: SyncService,
    private organizationService: OrganizationService,
    private accountService: AccountService,
    private subscriberBillingClient: SubscriberBillingClient,
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

  // Fetch account credit
  accountCredit$: Observable<number | null> = this.accountService.activeAccount$.pipe(
    mapAccountToSubscriber,
    switchMap((account) => this.subscriberBillingClient.getCredit(account)),
  );

  /**
   * Calculate estimated tax for the selected plan
   */
  async calculateEstimatedTax(
    planDetails: PlanDetails,
    billingAddress: BillingAddress,
  ): Promise<number> {
    try {
      const isOrganizationPlan = planDetails.tier === PersonalSubscriptionPricingTierIds.Families;
      const isPremiumPlan = planDetails.tier === PersonalSubscriptionPricingTierIds.Premium;

      let taxClientCall: Promise<TaxAmounts> | null = null;

      if (isOrganizationPlan) {
        const seats = this.getPasswordManagerSeats(planDetails);
        if (seats === 0) {
          throw new Error("Seats must be greater than 0 for organization plan");
        }
        // Currently, only Families plan is supported for organization plans
        const request: OrganizationSubscriptionPurchase = {
          tier: "families",
          cadence: "annually",
          passwordManager: { seats, additionalStorage: 0, sponsored: false },
        };

        taxClientCall = this.taxClient.previewTaxForOrganizationSubscriptionPurchase(
          request,
          billingAddress,
        );
      }

      if (isPremiumPlan) {
        taxClientCall = this.taxClient.previewTaxForPremiumSubscriptionPurchase(0, billingAddress);
      }

      if (taxClientCall === null) {
        throw new Error("Tax client call is not defined");
      }

      const preview = await taxClientCall;
      return preview.tax;
    } catch (error: unknown) {
      this.logService.error("Tax calculation failed:", error);
      throw error;
    }
  }

  /**
   * Process premium upgrade
   */
  async upgradeToPremium(
    paymentMethod: TokenizedPaymentMethod | NonTokenizedPaymentMethod,
    billingAddress: Pick<BillingAddress, "country" | "postalCode">,
  ): Promise<void> {
    this.validatePaymentAndBillingInfo(paymentMethod, billingAddress);

    await this.accountBillingClient.purchasePremiumSubscription(paymentMethod, billingAddress);

    await this.refreshAndSync();
  }

  /**
   * Process families upgrade
   */
  async upgradeToFamilies(
    account: Account,
    planDetails: PlanDetails,
    paymentMethod: TokenizedPaymentMethod,
    formValues: PaymentFormValues,
  ): Promise<OrganizationResponse> {
    const billingAddress = formValues.billingAddress;

    if (!formValues.organizationName) {
      throw new Error("Organization name is required for families upgrade");
    }

    this.validatePaymentAndBillingInfo(paymentMethod, billingAddress);

    const passwordManagerSeats = this.getPasswordManagerSeats(planDetails);

    const subscriptionInformation: SubscriptionInformation = {
      organization: {
        name: formValues.organizationName,
        billingEmail: account.email, // Use account email as billing email
      },
      plan: {
        type: PlanType.FamiliesAnnually,
        passwordManagerSeats: passwordManagerSeats,
      },
      payment: {
        paymentMethod: [paymentMethod.token, this.getPaymentMethodType(paymentMethod)],
        billing: {
          country: billingAddress.country,
          postalCode: billingAddress.postalCode,
        },
      },
    };

    const result = await this.organizationBillingService.purchaseSubscription(
      subscriptionInformation,
      account.id,
    );
    await this.refreshAndSync();
    return result;
  }

  private getPasswordManagerSeats(planDetails: PlanDetails): number {
    return "users" in planDetails.details.passwordManager
      ? planDetails.details.passwordManager.users
      : 0;
  }

  private validatePaymentAndBillingInfo(
    paymentMethod: TokenizedPaymentMethod | NonTokenizedPaymentMethod,
    billingAddress: { country: string; postalCode: string },
  ): void {
    if (!paymentMethod?.type) {
      throw new Error("Payment method type is missing");
    }

    // Account credit does not require a token
    if (
      paymentMethod.type !== NonTokenizablePaymentMethods.accountCredit &&
      !paymentMethod?.token
    ) {
      throw new Error("Payment method token is missing");
    }

    if (!billingAddress?.country || !billingAddress?.postalCode) {
      throw new Error("Billing address information is incomplete");
    }
  }

  private async refreshAndSync(): Promise<void> {
    await this.apiService.refreshIdentityToken();
    await this.syncService.fullSync(true);
  }

  private getPaymentMethodType(
    paymentMethod: TokenizedPaymentMethod | NonTokenizedPaymentMethod,
  ): PaymentMethodType {
    return paymentMethod.type === NonTokenizablePaymentMethods.accountCredit
      ? PaymentMethodType.Credit
      : tokenizablePaymentMethodToLegacyEnum(paymentMethod.type);
  }
}
