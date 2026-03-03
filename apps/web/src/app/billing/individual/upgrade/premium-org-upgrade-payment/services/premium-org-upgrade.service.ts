import { Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Account } from "@bitwarden/common/auth/abstractions/account.service";
import { ProductTierType } from "@bitwarden/common/billing/enums";
import {
  BusinessSubscriptionPricingTier,
  BusinessSubscriptionPricingTierId,
  PersonalSubscriptionPricingTier,
  PersonalSubscriptionPricingTierId,
  SubscriptionCadenceIds,
} from "@bitwarden/common/billing/types/subscription-pricing-tier";
import { OrgKey } from "@bitwarden/common/types/key";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { KeyService } from "@bitwarden/key-management";

import { AccountBillingClient, PreviewInvoiceClient } from "../../../../clients";
import { BillingAddress } from "../../../../payment/types";

export type PremiumOrgUpgradePlanDetails = {
  tier: PersonalSubscriptionPricingTierId | BusinessSubscriptionPricingTierId;
  details: PersonalSubscriptionPricingTier | BusinessSubscriptionPricingTier;
  cost: number;
  proratedAmount?: number;
};

export type PaymentFormValues = {
  organizationName?: string | null;
  billingAddress: {
    country: string;
    postalCode: string;
  };
};

export interface InvoicePreview {
  tax: number;
  total: number;
  credit: number;
  newPlanProratedMonths: number;
  newPlanProratedAmount?: number;
}

@Injectable()
export class PremiumOrgUpgradeService {
  constructor(
    private accountBillingClient: AccountBillingClient,
    private previewInvoiceClient: PreviewInvoiceClient,
    private syncService: SyncService,
    private keyService: KeyService,
    private organizationService: OrganizationService,
  ) {}

  async previewProratedInvoice(
    planDetails: PremiumOrgUpgradePlanDetails,
    billingAddress: BillingAddress,
  ): Promise<InvoicePreview> {
    const tier: ProductTierType = this.ProductTierTypeFromSubscriptionTierId(planDetails.tier);

    const invoicePreviewResponse =
      await this.previewInvoiceClient.previewProrationForPremiumUpgrade(tier, billingAddress);

    return {
      tax: invoicePreviewResponse.tax,
      total: invoicePreviewResponse.total,
      credit: invoicePreviewResponse.credit,
      newPlanProratedMonths: invoicePreviewResponse.newPlanProratedMonths,
      newPlanProratedAmount: invoicePreviewResponse.newPlanProratedAmount,
    };
  }

  async upgradeToOrganization(
    account: Account,
    organizationName: string,
    planDetails: PremiumOrgUpgradePlanDetails,
    billingAddress: BillingAddress,
  ): Promise<string> {
    if (!organizationName) {
      throw new Error("Organization name is required for organization upgrade");
    }

    if (!billingAddress?.country || !billingAddress?.postalCode) {
      throw new Error("Billing address information is incomplete");
    }

    const tier: ProductTierType = this.ProductTierTypeFromSubscriptionTierId(planDetails.tier);
    const [encryptedKey] = await this.keyService.makeOrgKey<OrgKey>(account.id);

    if (!encryptedKey.encryptedString) {
      throw new Error("Failed to generate encrypted organization key");
    }

    await this.accountBillingClient.upgradePremiumToOrganization(
      organizationName,
      encryptedKey.encryptedString,
      tier,
      SubscriptionCadenceIds.Annually,
      billingAddress,
    );

    await this.syncService.fullSync(true);

    // Get the newly created organization
    const organizations = await firstValueFrom(this.organizationService.organizations$(account.id));

    const newOrg = organizations?.find((org) => org.name === organizationName && org.isOwner);

    if (!newOrg) {
      throw new Error("Failed to find newly created organization");
    }

    return newOrg.id;
  }

  private ProductTierTypeFromSubscriptionTierId(
    tierId: PersonalSubscriptionPricingTierId | BusinessSubscriptionPricingTierId,
  ): ProductTierType {
    switch (tierId) {
      case "families":
        return ProductTierType.Families;
      case "teams":
        return ProductTierType.Teams;
      case "enterprise":
        return ProductTierType.Enterprise;
      default:
        throw new Error("Invalid plan tier for organization upgrade");
    }
  }
}
