import { Injectable } from "@angular/core";
import { catchError, firstValueFrom, from, map, Observable, of, shareReplay } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationResponse } from "@bitwarden/common/admin-console/models/response/organization.response";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import {
  OrganizationBillingServiceAbstraction,
  SubscriptionInformation,
} from "@bitwarden/common/billing/abstractions";
import { InitiationPath, PaymentMethodType, PlanType } from "@bitwarden/common/billing/enums";
import { DiscountTierType } from "@bitwarden/common/billing/enums/discount-tier-type.enum";
import { SubscriptionDiscount } from "@bitwarden/common/billing/models/response/subscription-discount.response";
import { Cart } from "@bitwarden/pricing";
import { PreviewInvoiceClient } from "@bitwarden/web-vault/app/billing/clients";
import {
  BillingAddressControls,
  getBillingAddressFromControls,
} from "@bitwarden/web-vault/app/billing/payment/components";
import {
  tokenizablePaymentMethodToLegacyEnum,
  TokenizedPaymentMethod,
} from "@bitwarden/web-vault/app/billing/payment/types";
import { InvoicePreviewService } from "@bitwarden/web-vault/app/billing/services/invoice-preview.service";
import { SubscriptionDiscountService } from "@bitwarden/web-vault/app/billing/services/subscription-discount.service";
import { OrganizationSubscriptionPurchase } from "@bitwarden/web-vault/app/billing/types";
import { PrivilegedControlsSelection } from "@bitwarden/web-vault/app/billing/types/organization-subscription";

export const Tiers = {
  Families: "families",
  Teams: "teams",
  Enterprise: "enterprise",
} as const;

export const Cadences = {
  Annually: "annually",
  Monthly: "monthly",
} as const;

export const Products = {
  PasswordManager: "passwordManager",
  SecretsManager: "secretsManager",
} as const;

export type Tier = (typeof Tiers)[keyof typeof Tiers];
export type Cadence = (typeof Cadences)[keyof typeof Cadences];
export type Product = (typeof Products)[keyof typeof Products];

export type Prices = {
  [Cadences.Annually]: number;
  [Cadences.Monthly]?: number;
};

export interface Trial {
  organization: {
    name: string;
    email: string;
  };
  product: Product;
  tier: Tier;
  length: number;
  privilegedControls?: PrivilegedControlsSelection;
}

@Injectable({ providedIn: "root" })
export class TrialBillingStepService {
  constructor(
    private accountService: AccountService,
    private apiService: ApiService,
    private organizationBillingService: OrganizationBillingServiceAbstraction,
    private previewInvoiceClient: PreviewInvoiceClient,
    private invoicePreviewService: InvoicePreviewService,
    private subscriptionDiscountService: SubscriptionDiscountService,
  ) {}

  private plans$ = from(this.apiService.getPlans()).pipe(
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  getPrices$ = (product: Product, tier: Tier, includePrivilegedControls = false) =>
    this.plans$.pipe(
      map((plans) => {
        switch (tier) {
          case "families": {
            const annually = plans.data.find((plan) => plan.type === PlanType.FamiliesAnnually);
            return {
              annually: annually!.PasswordManager.basePrice,
            };
          }
          case "teams":
          case "enterprise": {
            const annually = plans.data.find(
              (plan) =>
                plan.type ===
                (tier === "teams" ? PlanType.TeamsAnnually : PlanType.EnterpriseAnnually),
            );
            const monthly = plans.data.find(
              (plan) =>
                plan.type ===
                (tier === "teams" ? PlanType.TeamsMonthly : PlanType.EnterpriseMonthly),
            );
            switch (product) {
              case "passwordManager": {
                const enterprisePrivilegedControls =
                  includePrivilegedControls && tier === "enterprise";
                return {
                  annually:
                    annually!.PasswordManager.seatPrice +
                    (enterprisePrivilegedControls
                      ? (annually!.PrivilegedControls?.seatPrice ?? 0)
                      : 0),
                  monthly:
                    monthly!.PasswordManager.seatPrice +
                    (enterprisePrivilegedControls
                      ? (monthly!.PrivilegedControls?.seatPrice ?? 0)
                      : 0),
                };
              }
              case "secretsManager": {
                return {
                  annually: annually!.SecretsManager.seatPrice,
                  monthly: monthly!.SecretsManager.seatPrice,
                };
              }
            }
          }
        }
      }),
    );

  getCosts = async (
    product: Product,
    tier: Tier,
    cadence: Cadence,
    billingAddressControls: BillingAddressControls,
    privilegedControls?: PrivilegedControlsSelection,
    coupons?: string[],
  ): Promise<{
    tax: number;
    total: number;
  }> => {
    const billingAddress = getBillingAddressFromControls(billingAddressControls);
    return await this.previewInvoiceClient.previewTaxForOrganizationSubscriptionPurchase(
      {
        tier,
        cadence,
        passwordManager: {
          seats: 1,
          additionalStorage: 0,
          sponsored: false,
        },
        secretsManager:
          product === "secretsManager"
            ? {
                seats: 1,
                additionalServiceAccounts: 0,
                standalone: true,
              }
            : undefined,
        privilegedControls,
      },
      billingAddress,
      coupons,
    );
  };

  /**
   * Previews the trial's direct purchase at the given cadence as a cart
   */
  previewPurchase = (
    trial: Trial,
    cadence: Cadence,
    billingAddressControls: BillingAddressControls,
    coupons?: string[],
  ): Promise<Cart> => {
    const purchase: OrganizationSubscriptionPurchase = {
      tier: trial.tier,
      cadence,
      passwordManager: { seats: 1, additionalStorage: 0, sponsored: false },
      secretsManager:
        trial.product === Products.SecretsManager
          ? { seats: 1, additionalServiceAccounts: 0, standalone: true }
          : undefined,
      // PAM seats at a minimum of 1, matching PM, so PM seats are never fewer than PAM seats.
      privilegedControls: trial.privilegedControls ? { seatMinimum: 1 } : undefined,
    };
    return this.invoicePreviewService.previewOrganizationCheckoutCart({
      purchase: coupons?.length ? { ...purchase, coupons } : purchase,
      billingAddress: getBillingAddressFromControls(billingAddressControls),
    });
  };

  /**
   * Eligible subscription discounts for the trial. Discounts are a families-tier feature only;
   * fetch failures degrade to no discounts.
   */
  getEligibleDiscounts$ = (tier: Tier): Observable<SubscriptionDiscount[]> =>
    tier === Tiers.Families
      ? this.subscriptionDiscountService
          .getEligibleDiscountsForTier$(DiscountTierType.Families)
          .pipe(catchError(() => of<SubscriptionDiscount[]>([])))
      : of([]);

  startTrial = async (
    trial: Trial,
    cadence: Cadence,
    billingAddress: BillingAddressControls,
    paymentMethod: TokenizedPaymentMethod,
    coupons?: string[],
  ): Promise<OrganizationResponse> => {
    const getPlanType = async (tier: Tier, cadence: Cadence) => {
      const plans = await firstValueFrom(this.plans$);
      switch (tier) {
        case "families":
          return plans.data.find((plan) => plan.type === PlanType.FamiliesAnnually)!.type;
        case "teams":
          return plans.data.find(
            (plan) =>
              plan.type ===
              (cadence === "annually" ? PlanType.TeamsAnnually : PlanType.TeamsMonthly),
          )!.type;
        case "enterprise":
          return plans.data.find(
            (plan) =>
              plan.type ===
              (cadence === "annually" ? PlanType.EnterpriseAnnually : PlanType.EnterpriseMonthly),
          )!.type;
      }
    };

    const legacyPaymentMethod: [string, PaymentMethodType] = [
      paymentMethod.token,
      tokenizablePaymentMethodToLegacyEnum(paymentMethod.type),
    ];
    const planType = await getPlanType(trial.tier, cadence);

    const basePlan =
      trial.product === Products.PasswordManager
        ? { type: planType, passwordManagerSeats: 1 }
        : {
            type: planType,
            passwordManagerSeats: 1,
            subscribeToSecretsManager: true,
            isFromSecretsManagerTrial: true,
            secretsManagerSeats: 1,
          };

    const request: SubscriptionInformation = {
      organization: {
        name: trial.organization.name,
        billingEmail: trial.organization.email,
        initiationPath:
          trial.product === Products.PasswordManager
            ? InitiationPath.PasswordManagerTrialFromMarketingWebsite
            : InitiationPath.SecretsManagerTrialFromMarketingWebsite,
      },
      plan: trial.privilegedControls
        ? {
            ...basePlan,
            subscribeToPrivilegedControls: true,
            pamSeats: 1,
          }
        : basePlan,
      payment: {
        paymentMethod: legacyPaymentMethod,
        billing: {
          country: billingAddress.country,
          postalCode: billingAddress.postalCode,
          taxId: billingAddress.taxId ?? undefined,
        },
        skipTrial: trial.length === 0,
        trialLength: trial.length,
      },
      ...(coupons?.length ? { coupons } : {}),
    };

    const activeUserId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    return await this.organizationBillingService.purchaseSubscription(request, activeUserId);
  };
}
