import { TestBed } from "@angular/core/testing";
import { of } from "rxjs";

import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ProductTierType } from "@bitwarden/common/billing/enums";
import {
  BusinessSubscriptionPricingTierIds,
  PersonalSubscriptionPricingTierIds,
} from "@bitwarden/common/billing/types/subscription-pricing-tier";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { KeyService } from "@bitwarden/key-management";

import { AccountBillingClient } from "../../../../clients/account-billing.client";
import { PreviewInvoiceClient } from "../../../../clients/preview-invoice.client";
import { SubscriberBillingClient } from "../../../../clients/subscriber-billing.client";
import { BillingAddress } from "../../../../payment/types";

import {
  UNVERIFIED_BANK_ACCOUNT_MESSAGE,
  PremiumOrgUpgradePlanDetails,
  PremiumOrgUpgradeService,
} from "./premium-org-upgrade.service";

describe("PremiumOrgUpgradeService", () => {
  let service: PremiumOrgUpgradeService;
  let accountBillingClient: jest.Mocked<AccountBillingClient>;
  let previewInvoiceClient: jest.Mocked<PreviewInvoiceClient>;
  let subscriberBillingClient: jest.Mocked<SubscriberBillingClient>;
  let syncService: jest.Mocked<SyncService>;
  let keyService: jest.Mocked<KeyService>;
  let encryptService: jest.Mocked<EncryptService>;
  let i18nService: jest.Mocked<I18nService>;

  const mockAccount = { id: "user-id", email: "test@bitwarden.com" } as Account;
  const mockPlanDetails: PremiumOrgUpgradePlanDetails = {
    tier: BusinessSubscriptionPricingTierIds.Teams,
    details: {
      id: BusinessSubscriptionPricingTierIds.Teams,
      name: "Teams",
      passwordManager: {
        annualPrice: 48,
        users: 1,
      },
    },
  } as any;
  const mockBillingAddress: BillingAddress = {
    country: "US",
    postalCode: "12345",
    line1: null,
    line2: null,
    city: null,
    state: null,
    taxId: null,
  };

  beforeEach(() => {
    accountBillingClient = {
      upgradePremiumToOrganization: jest.fn().mockResolvedValue("new-org-id"),
    } as any;
    previewInvoiceClient = {
      previewProrationForPremiumUpgrade: jest
        .fn()
        .mockResolvedValue({ tax: 5, total: 55, credit: 0 }),
    } as any;
    subscriberBillingClient = {
      getPaymentMethod: jest.fn().mockResolvedValue({
        type: "card",
        brand: "visa",
        last4: "4242",
        expiration: "12/2025",
      }),
    } as any;
    syncService = {
      fullSync: jest.fn().mockResolvedValue(undefined),
    } as any;
    keyService = {
      makeOrgKey: jest
        .fn()
        .mockResolvedValue([{ encryptedString: "org-key-encrypted" }, "org-key-decrypted"]),
      makeKeyPair: jest
        .fn()
        .mockResolvedValue(["public-key", new EncString("private-key-encrypted")]),
    } as any;
    encryptService = {
      encryptString: jest.fn().mockResolvedValue(new EncString("collection-encrypted")),
    } as any;
    i18nService = {
      t: jest.fn().mockReturnValue("Default Collection"),
    } as any;

    TestBed.configureTestingModule({
      providers: [
        PremiumOrgUpgradeService,
        { provide: AccountBillingClient, useValue: accountBillingClient },
        { provide: PreviewInvoiceClient, useValue: previewInvoiceClient },
        { provide: SubscriberBillingClient, useValue: subscriberBillingClient },
        { provide: SyncService, useValue: syncService },
        { provide: AccountService, useValue: { activeAccount$: of(mockAccount) } },
        { provide: KeyService, useValue: keyService },
        { provide: EncryptService, useValue: encryptService },
        { provide: I18nService, useValue: i18nService },
      ],
    });

    service = TestBed.inject(PremiumOrgUpgradeService);
  });

  describe("upgradeToOrganization", () => {
    it("should successfully upgrade premium account to organization and return organization ID", async () => {
      const result = await service.upgradeToOrganization(
        mockAccount,
        "Test Organization",
        mockPlanDetails.tier,
        mockBillingAddress,
      );

      expect(accountBillingClient.upgradePremiumToOrganization).toHaveBeenCalledWith({
        organizationName: "Test Organization",
        organizationKey: "org-key-encrypted",
        collectionName: "collection-encrypted",
        publicKey: "public-key",
        encryptedPrivateKey: "private-key-encrypted",
        planTier: ProductTierType.Teams,
        cadence: "annually",
        billingAddress: mockBillingAddress,
      });
      expect(keyService.makeOrgKey).toHaveBeenCalledWith("user-id");
      expect(keyService.makeKeyPair).toHaveBeenCalledWith("org-key-decrypted");
      expect(encryptService.encryptString).toHaveBeenCalledWith(
        "Default Collection",
        "org-key-decrypted",
      );
      expect(syncService.fullSync).toHaveBeenCalledWith(true);
      expect(result).toBe("new-org-id");
    });

    it("should throw an error when payment method is an unverified bank account", async () => {
      subscriberBillingClient.getPaymentMethod.mockResolvedValue({
        type: "bankAccount",
        bankName: "Chase",
        last4: "1234",
        hostedVerificationUrl: "https://stripe.com/verify",
      } as any);

      await expect(
        service.upgradeToOrganization(
          mockAccount,
          "Test Organization",
          mockPlanDetails.tier,
          mockBillingAddress,
        ),
      ).rejects.toThrow(UNVERIFIED_BANK_ACCOUNT_MESSAGE);

      expect(accountBillingClient.upgradePremiumToOrganization).not.toHaveBeenCalled();
    });

    it("should proceed when payment method is a verified bank account", async () => {
      subscriberBillingClient.getPaymentMethod.mockResolvedValue({
        type: "bankAccount",
        bankName: "Chase",
        last4: "1234",
      } as any);

      const result = await service.upgradeToOrganization(
        mockAccount,
        "Test Organization",
        mockPlanDetails.tier,
        mockBillingAddress,
      );

      expect(result).toBe("new-org-id");
      expect(accountBillingClient.upgradePremiumToOrganization).toHaveBeenCalled();
    });

    it("should proceed when payment method is null", async () => {
      subscriberBillingClient.getPaymentMethod.mockResolvedValue(null);

      const result = await service.upgradeToOrganization(
        mockAccount,
        "Test Organization",
        mockPlanDetails.tier,
        mockBillingAddress,
      );

      expect(result).toBe("new-org-id");
      expect(accountBillingClient.upgradePremiumToOrganization).toHaveBeenCalled();
    });

    it("should throw an error if organization name is missing", async () => {
      await expect(
        service.upgradeToOrganization(mockAccount, "", mockPlanDetails.tier, mockBillingAddress),
      ).rejects.toThrow("Organization name is required for organization upgrade");
    });

    it("should throw an error if billing address is incomplete", async () => {
      const incompleteBillingAddress: BillingAddress = {
        country: "",
        postalCode: "",
        line1: null,
        line2: null,
        city: null,
        state: null,
        taxId: null,
      };
      await expect(
        service.upgradeToOrganization(
          mockAccount,
          "Test Organization",
          mockPlanDetails.tier,
          incompleteBillingAddress,
        ),
      ).rejects.toThrow("Billing address information is incomplete");
    });

    it("should throw an error for invalid plan tier", async () => {
      const invalidPlanDetails = {
        tier: "invalid-tier" as any,
        details: mockPlanDetails.details,
        cost: 0,
      };
      await expect(
        service.upgradeToOrganization(
          mockAccount,
          "Test Organization",
          invalidPlanDetails.tier,
          mockBillingAddress,
        ),
      ).rejects.toThrow("Invalid plan tier for organization upgrade");
    });

    it("should propagate error if key generation fails", async () => {
      keyService.makeOrgKey.mockRejectedValue(new Error("Key generation failed"));
      await expect(
        service.upgradeToOrganization(
          mockAccount,
          "Test Organization",
          mockPlanDetails.tier,
          mockBillingAddress,
        ),
      ).rejects.toThrow("Key generation failed");
    });

    it("should propagate error if upgrade API call fails", async () => {
      accountBillingClient.upgradePremiumToOrganization.mockRejectedValue(
        new Error("API call failed"),
      );
      await expect(
        service.upgradeToOrganization(
          mockAccount,
          "Test Organization",
          mockPlanDetails.tier,
          mockBillingAddress,
        ),
      ).rejects.toThrow("API call failed");
    });

    it("should propagate error if sync fails", async () => {
      syncService.fullSync.mockRejectedValue(new Error("Sync failed"));
      await expect(
        service.upgradeToOrganization(
          mockAccount,
          "Test Organization",
          mockPlanDetails.tier,
          mockBillingAddress,
        ),
      ).rejects.toThrow("Sync failed");
    });

    it("should successfully upgrade with non-US billing address without tax ID", async () => {
      const nonUSBillingAddress: BillingAddress = {
        country: "CA",
        postalCode: "12345",
        line1: null,
        line2: null,
        city: null,
        state: null,
        taxId: null,
      };

      const result = await service.upgradeToOrganization(
        mockAccount,
        "Test Organization",
        BusinessSubscriptionPricingTierIds.Teams,
        nonUSBillingAddress,
      );

      expect(result).toBe("new-org-id");
      expect(accountBillingClient.upgradePremiumToOrganization).toHaveBeenCalledWith({
        organizationName: "Test Organization",
        organizationKey: "org-key-encrypted",
        collectionName: "collection-encrypted",
        publicKey: "public-key",
        encryptedPrivateKey: "private-key-encrypted",
        planTier: ProductTierType.Teams,
        cadence: "annually",
        billingAddress: nonUSBillingAddress,
      });
    });

    it("should successfully upgrade with non-US billing address when tax ID is provided", async () => {
      const nonUSBillingAddressWithTaxId: BillingAddress = {
        country: "CA",
        postalCode: "12345",
        line1: null,
        line2: null,
        city: null,
        state: null,
        taxId: {
          code: "ca_bn",
          value: "123456789",
        },
      };

      const result = await service.upgradeToOrganization(
        mockAccount,
        "Test Organization",
        BusinessSubscriptionPricingTierIds.Teams,
        nonUSBillingAddressWithTaxId,
      );

      expect(result).toBe("new-org-id");
      expect(accountBillingClient.upgradePremiumToOrganization).toHaveBeenCalledWith({
        organizationName: "Test Organization",
        organizationKey: "org-key-encrypted",
        collectionName: "collection-encrypted",
        publicKey: "public-key",
        encryptedPrivateKey: "private-key-encrypted",
        planTier: ProductTierType.Teams,
        cadence: "annually",
        billingAddress: nonUSBillingAddressWithTaxId,
      });
    });

    it("should successfully upgrade Families tier with non-US billing address", async () => {
      const nonUSBillingAddress: BillingAddress = {
        country: "CA",
        postalCode: "12345",
        line1: null,
        line2: null,
        city: null,
        state: null,
        taxId: null,
      };

      const result = await service.upgradeToOrganization(
        mockAccount,
        "Test Organization",
        PersonalSubscriptionPricingTierIds.Families,
        nonUSBillingAddress,
      );

      expect(result).toBe("new-org-id");
      expect(accountBillingClient.upgradePremiumToOrganization).toHaveBeenCalledWith({
        organizationName: "Test Organization",
        organizationKey: "org-key-encrypted",
        collectionName: "collection-encrypted",
        publicKey: "public-key",
        encryptedPrivateKey: "private-key-encrypted",
        planTier: ProductTierType.Families,
        cadence: "annually",
        billingAddress: nonUSBillingAddress,
      });
    });

    it("should allow US billing address without tax ID", async () => {
      const usBillingAddress: BillingAddress = {
        country: "US",
        postalCode: "12345",
        line1: null,
        line2: null,
        city: null,
        state: null,
        taxId: null,
      };

      const result = await service.upgradeToOrganization(
        mockAccount,
        "Test Organization",
        BusinessSubscriptionPricingTierIds.Teams,
        usBillingAddress,
      );

      expect(result).toBe("new-org-id");
      expect(syncService.fullSync).toHaveBeenCalledWith(true);
    });
  });

  describe("previewProratedInvoice", () => {
    it("should call previewProrationForPremiumUpgrade and return invoice preview", async () => {
      const result = await service.previewProratedInvoice(mockPlanDetails, mockBillingAddress);

      expect(result).toEqual({ tax: 5, total: 55, credit: 0 });
      expect(previewInvoiceClient.previewProrationForPremiumUpgrade).toHaveBeenCalledWith(
        2, // ProductTierType.Teams
        mockBillingAddress,
      );
    });

    it("should throw an error if invoice preview fails", async () => {
      previewInvoiceClient.previewProrationForPremiumUpgrade.mockRejectedValue(
        new Error("Invoice API error"),
      );
      await expect(
        service.previewProratedInvoice(mockPlanDetails, mockBillingAddress),
      ).rejects.toThrow("Invoice API error");
    });
  });

  describe("isBankAccountNotSupportedError", () => {
    it("should return true when error is an unverified bank account not supported error", () => {
      const error = new Error(UNVERIFIED_BANK_ACCOUNT_MESSAGE);

      expect(service.isBankAccountNotSupportedError(error)).toBe(true);
    });

    it("should return false when error is an Error but with different message", () => {
      const error = new Error("Some other error message");

      expect(service.isBankAccountNotSupportedError(error)).toBe(false);
    });

    it("should return false when error is not an Error instance", () => {
      const error = "string error";

      expect(service.isBankAccountNotSupportedError(error)).toBe(false);
    });

    it("should return false when error is null", () => {
      expect(service.isBankAccountNotSupportedError(null)).toBe(false);
    });
  });

  describe("isUnverifiedBankAccount", () => {
    it("should return true when payment method is a bank account with hostedVerificationUrl", () => {
      const paymentMethod = {
        type: "bankAccount",
        bankName: "Chase",
        last4: "1234",
        hostedVerificationUrl: "https://stripe.com/verify",
      } as any;

      expect(service.isUnverifiedBankAccount(paymentMethod)).toBe(true);
    });

    it("should return false when payment method is a bank account without hostedVerificationUrl", () => {
      const paymentMethod = {
        type: "bankAccount",
        bankName: "Chase",
        last4: "1234",
      } as any;

      expect(service.isUnverifiedBankAccount(paymentMethod)).toBe(false);
    });

    it("should return false when payment method is a bank account with empty hostedVerificationUrl", () => {
      const paymentMethod = {
        type: "bankAccount",
        bankName: "Chase",
        last4: "1234",
        hostedVerificationUrl: "",
      } as any;

      expect(service.isUnverifiedBankAccount(paymentMethod)).toBe(false);
    });

    it("should return false when payment method is not a bank account", () => {
      const paymentMethod = {
        type: "card",
        brand: "visa",
        last4: "4242",
        expiration: "12/2025",
      } as any;

      expect(service.isUnverifiedBankAccount(paymentMethod)).toBe(false);
    });

    it("should return false when payment method is null", () => {
      expect(service.isUnverifiedBankAccount(null)).toBe(false);
    });
  });
});
