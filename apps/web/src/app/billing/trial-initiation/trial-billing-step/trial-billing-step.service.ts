import { Injectable } from "@angular/core";
import { combineLatestWith, firstValueFrom, from, map, shareReplay } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationResponse } from "@bitwarden/common/admin-console/models/response/organization.response";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import {
  OrganizationBillingServiceAbstraction,
  SubscriptionInformation,
} from "@bitwarden/common/billing/abstractions";
import { PaymentMethodType, PlanType } from "@bitwarden/common/billing/enums";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { TaxClient } from "@bitwarden/web-vault/app/billing/clients";
import {
  BillingAddressControls,
  getBillingAddressFromControls,
} from "@bitwarden/web-vault/app/billing/payment/components";
import {
  tokenizablePaymentMethodToLegacyEnum,
  TokenizedPaymentMethod,
} from "@bitwarden/web-vault/app/billing/payment/types";

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
}

@Injectable()
export class TrialBillingStepService {
  constructor(
    private accountService: AccountService,
    private apiService: ApiService,
    private organizationBillingService: OrganizationBillingServiceAbstraction,
    private taxClient: TaxClient,
    private configService: ConfigService,
  ) {}

  private plans$ = from(this.apiService.getPlans()).pipe(
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  getPrices$ = (product: Product, tier: Tier) =>
    this.plans$.pipe(
      combineLatestWith(this.configService.getFeatureFlag$(FeatureFlag.PM26462_Milestone_3)),
      map(([plans, milestone3FeatureEnabled]) => {
        switch (tier) {
          case "families": {
            const annually = plans.data.find(
              (plan) =>
                plan.type ===
                (milestone3FeatureEnabled
                  ? PlanType.FamiliesAnnually
                  : PlanType.FamiliesAnnually2025),
            );
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
                return {
                  annually: annually!.PasswordManager.seatPrice,
                  monthly: monthly!.PasswordManager.seatPrice,
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
  ): Promise<{
    tax: number;
    total: number;
  }> => {
    const billingAddress = getBillingAddressFromControls(billingAddressControls);
    return await this.taxClient.previewTaxForOrganizationSubscriptionPurchase(
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
      },
      billingAddress,
    );
  };

  startTrial = async (
    trial: Trial,
    cadence: Cadence,
    billingAddress: BillingAddressControls,
    paymentMethod: TokenizedPaymentMethod,
  ): Promise<OrganizationResponse> => {
    const getPlanType = async (tier: Tier, cadence: Cadence) => {
      const plans = await firstValueFrom(this.plans$);
      const milestone3FeatureEnabled = await this.configService.getFeatureFlag(
        FeatureFlag.PM26462_Milestone_3,
      );
      const familyPlan = milestone3FeatureEnabled
        ? PlanType.FamiliesAnnually
        : PlanType.FamiliesAnnually2025;
      switch (tier) {
        case "families":
          return plans.data.find((plan) => plan.type === familyPlan)!.type;
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

    const request: SubscriptionInformation = {
      organization: {
        name: trial.organization.name,
        billingEmail: trial.organization.email,
        initiationPath:
          trial.product === "passwordManager"
            ? "Password Manager trial from marketing website"
            : "Secrets Manager trial from marketing website",
      },
      plan:
        trial.product === "passwordManager"
          ? { type: planType, passwordManagerSeats: 1 }
          : {
              type: planType,
              passwordManagerSeats: 1,
              subscribeToSecretsManager: true,
              isFromSecretsManagerTrial: true,
              secretsManagerSeats: 1,
            },
      payment: {
        paymentMethod: legacyPaymentMethod,
        billing: {
          country: billingAddress.country,
          postalCode: billingAddress.postalCode,
          taxId: billingAddress.taxId ?? undefined,
        },
        skipTrial: trial.length === 0,
      },
    };

    const activeUserId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    return await this.organizationBillingService.purchaseSubscription(request, activeUserId);
  };
}
