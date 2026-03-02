import { Injectable } from "@angular/core";

import { Account } from "@bitwarden/common/auth/abstractions/account.service";
import { ProductTierType } from "@bitwarden/common/billing/enums";
import {
  BusinessSubscriptionPricingTier,
  BusinessSubscriptionPricingTierId,
  BusinessSubscriptionPricingTierIds,
  PersonalSubscriptionPricingTier,
  PersonalSubscriptionPricingTierId,
  PersonalSubscriptionPricingTierIds,
  SubscriptionCadenceIds,
} from "@bitwarden/common/billing/types/subscription-pricing-tier";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { OrgKey } from "@bitwarden/common/types/key";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { KeyService } from "@bitwarden/key-management";
import { UserId } from "@bitwarden/user-core";

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
    private keyService: KeyService,
    private i18nService: I18nService,
    private encryptService: EncryptService,
    private syncService: SyncService,
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
    tier: PersonalSubscriptionPricingTierId | BusinessSubscriptionPricingTierId,
    billingAddress: BillingAddress,
  ): Promise<string> {
    if (!organizationName) {
      throw new Error("Organization name is required for organization upgrade");
    }

    if (!billingAddress?.country || !billingAddress?.postalCode) {
      throw new Error("Billing address information is incomplete");
    }

    const productTier: ProductTierType = this.ProductTierTypeFromSubscriptionTierId(tier);
    const encryptionData = await this.generateOrganizationEncryptionData(account.id);

    const orgId = await this.accountBillingClient.upgradePremiumToOrganization({
      organizationName,
      organizationKey: encryptionData.key,
      collectionName: encryptionData.collectionCt,
      publicKey: encryptionData.orgKeys[0],
      encryptedPrivateKey: encryptionData.orgKeys[1].encryptedString as string,
      planTier: productTier,
      cadence: SubscriptionCadenceIds.Annually,
      billingAddress,
    });

    await this.syncService.fullSync(true);

    return orgId;
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

  SubscriptionTierIdFromProductTier(
    productTier: ProductTierType,
  ): BusinessSubscriptionPricingTierId | PersonalSubscriptionPricingTierId {
    switch (productTier) {
      case ProductTierType.Families:
        return PersonalSubscriptionPricingTierIds.Families;
      case ProductTierType.Teams:
        return BusinessSubscriptionPricingTierIds.Teams;
      case ProductTierType.Enterprise:
        return BusinessSubscriptionPricingTierIds.Enterprise;
      default:
        throw new Error(`Unsupported product tier: ${productTier}`);
    }
  }

  /**
   * Generates encryption data needed for creating a new organization.
   * Uses the active user account signal to get the user ID.
   * @returns Organization encryption data including keys and encrypted collection name
   */
  async generateOrganizationEncryptionData(activeUserId: UserId): Promise<{
    key: string;
    collectionCt: string;
    orgKeys: [string, EncString];
    orgKey: SymmetricCryptoKey;
    activeUserId: UserId;
  }> {
    const orgKey = await this.keyService.makeOrgKey<OrgKey>(activeUserId);
    const key = orgKey[0].encryptedString as string;
    const collection = await this.encryptService.encryptString(
      this.i18nService.t("defaultCollection"),
      orgKey[1],
    );
    const collectionCt = collection.encryptedString as string;
    const orgKeys = await this.keyService.makeKeyPair(orgKey[1]);

    return {
      key,
      collectionCt,
      orgKeys,
      orgKey: orgKey[1],
      activeUserId,
    };
  }
}
