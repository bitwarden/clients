import { TestBed } from "@angular/core/testing";
import { mock, mockReset } from "jest-mock-extended";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationResponse } from "@bitwarden/common/admin-console/models/response/organization.response";
import { OrganizationBillingServiceAbstraction } from "@bitwarden/common/billing/abstractions";
import { PaymentMethodType, PlanType } from "@bitwarden/common/billing/enums";
import { SyncService } from "@bitwarden/common/platform/sync";
import { UserId } from "@bitwarden/common/types/guid";
import { LogService } from "@bitwarden/logging";

import { AccountBillingClient, TaxAmounts, TaxClient } from "../../../../clients";
import { BillingAddress, TokenizedPaymentMethod } from "../../../../payment/types";
import { PersonalSubscriptionPricingTierIds } from "../../../../types/subscription-pricing-tier";

import { UpgradePaymentService, PlanDetails } from "./upgrade-payment.service";

describe("UpgradePaymentService", () => {
  const mockOrganizationBillingService = mock<OrganizationBillingServiceAbstraction>();
  const mockAccountBillingClient = mock<AccountBillingClient>();
  const mockTaxClient = mock<TaxClient>();
  const mockLogService = mock<LogService>();
  const mockApiService = mock<ApiService>();
  const mockSyncService = mock<SyncService>();

  mockApiService.refreshIdentityToken.mockResolvedValue({});
  mockSyncService.fullSync.mockResolvedValue(true);

  let sut: UpgradePaymentService;

  const mockAccount = {
    id: "user-id" as UserId,
    email: "test@example.com",
    emailVerified: true,
    name: "Test User",
  };

  const mockTokenizedPaymentMethod: TokenizedPaymentMethod = {
    token: "test-token",
    type: "card",
  };

  const mockBillingAddress: BillingAddress = {
    line1: "123 Test St",
    line2: null,
    city: "Test City",
    state: "TS",
    country: "US",
    postalCode: "12345",
    taxId: null,
  };

  const mockPremiumPlanDetails: PlanDetails = {
    tier: PersonalSubscriptionPricingTierIds.Premium,
    details: {
      id: PersonalSubscriptionPricingTierIds.Premium,
      name: "Premium",
      description: "Premium plan",
      availableCadences: ["annually"],
      passwordManager: {
        type: "standalone",
        annualPrice: 10,
        annualPricePerAdditionalStorageGB: 4,
        features: [
          { key: "feature1", value: "Feature 1" },
          { key: "feature2", value: "Feature 2" },
        ],
      },
    },
  };

  const mockFamiliesPlanDetails: PlanDetails = {
    tier: PersonalSubscriptionPricingTierIds.Families,
    details: {
      id: PersonalSubscriptionPricingTierIds.Families,
      name: "Families",
      description: "Families plan",
      availableCadences: ["annually"],
      passwordManager: {
        type: "packaged",
        annualPrice: 40,
        annualPricePerAdditionalStorageGB: 4,
        features: [
          { key: "feature1", value: "Feature 1" },
          { key: "feature2", value: "Feature 2" },
        ],
        users: 6,
      },
    },
  };

  beforeEach(() => {
    mockReset(mockOrganizationBillingService);
    mockReset(mockAccountBillingClient);
    mockReset(mockTaxClient);
    mockReset(mockLogService);

    TestBed.configureTestingModule({
      providers: [
        UpgradePaymentService,

        {
          provide: OrganizationBillingServiceAbstraction,
          useValue: mockOrganizationBillingService,
        },
        { provide: AccountBillingClient, useValue: mockAccountBillingClient },
        { provide: TaxClient, useValue: mockTaxClient },
        { provide: LogService, useValue: mockLogService },
        { provide: ApiService, useValue: mockApiService },
        { provide: SyncService, useValue: mockSyncService },
      ],
    });

    sut = TestBed.inject(UpgradePaymentService);
  });

  describe("calculateEstimatedTax", () => {
    it("should calculate tax for premium plan", async () => {
      // Arrange
      const mockResponse = mock<TaxAmounts>();
      mockResponse.tax = 2.5;

      mockTaxClient.previewTaxForPremiumSubscriptionPurchase.mockResolvedValue(mockResponse);

      // Act
      const result = await sut.calculateEstimatedTax(mockPremiumPlanDetails, mockBillingAddress);

      // Assert
      expect(result).toEqual(2.5);
      expect(mockTaxClient.previewTaxForPremiumSubscriptionPurchase).toHaveBeenCalledWith(
        0,
        mockBillingAddress,
      );
    });

    it("should calculate tax for families plan", async () => {
      // Arrange
      const mockResponse = mock<TaxAmounts>();
      mockResponse.tax = 5.0;

      mockTaxClient.previewTaxForOrganizationSubscriptionPurchase.mockResolvedValue(mockResponse);

      // Act
      const result = await sut.calculateEstimatedTax(mockFamiliesPlanDetails, mockBillingAddress);

      // Assert
      expect(result).toEqual(5.0);
      expect(mockTaxClient.previewTaxForOrganizationSubscriptionPurchase).toHaveBeenCalledWith(
        {
          cadence: "annually",
          tier: "families",
          passwordManager: {
            additionalStorage: 0,
            seats: 6,
            sponsored: false,
          },
        },
        mockBillingAddress,
      );
    });

    it("should throw and log error if personal tax calculation fails", async () => {
      // Arrange
      const error = new Error("Tax service error");
      mockTaxClient.previewTaxForPremiumSubscriptionPurchase.mockRejectedValue(error);

      // Act & Assert
      await expect(
        sut.calculateEstimatedTax(mockPremiumPlanDetails, mockBillingAddress),
      ).rejects.toThrow();
      expect(mockLogService.error).toHaveBeenCalledWith("Tax calculation failed:", error);
    });

    it("should throw and log error if organization tax calculation fails", async () => {
      // Arrange
      const error = new Error("Tax service error");
      mockTaxClient.previewTaxForOrganizationSubscriptionPurchase.mockRejectedValue(error);
      // Act & Assert
      await expect(
        sut.calculateEstimatedTax(mockFamiliesPlanDetails, mockBillingAddress),
      ).rejects.toThrow();
      expect(mockLogService.error).toHaveBeenCalledWith("Tax calculation failed:", error);
    });
  });

  describe("upgradeToPremium", () => {
    it("should call accountBillingClient to purchase premium subscription and refresh data", async () => {
      // Arrange
      mockAccountBillingClient.purchasePremiumSubscription.mockResolvedValue();

      // Act
      await sut.upgradeToPremium(mockTokenizedPaymentMethod, mockBillingAddress);

      // Assert
      expect(mockAccountBillingClient.purchasePremiumSubscription).toHaveBeenCalledWith(
        mockTokenizedPaymentMethod,
        mockBillingAddress,
      );
      expect(mockApiService.refreshIdentityToken).toHaveBeenCalled();
      expect(mockSyncService.fullSync).toHaveBeenCalledWith(true);
    });

    it("should throw error if payment method is incomplete", async () => {
      // Arrange
      const incompletePaymentMethod = { type: "card" } as TokenizedPaymentMethod;

      // Act & Assert
      await expect(
        sut.upgradeToPremium(incompletePaymentMethod, mockBillingAddress),
      ).rejects.toThrow("Payment method type or token is missing");
    });

    it("should throw error if billing address is incomplete", async () => {
      // Arrange
      const incompleteBillingAddress = { country: "US", postalCode: null } as any;

      // Act & Assert
      await expect(
        sut.upgradeToPremium(mockTokenizedPaymentMethod, incompleteBillingAddress),
      ).rejects.toThrow("Billing address information is incomplete");
    });
  });

  describe("upgradeToFamilies", () => {
    it("should call organizationBillingService to purchase subscription and refresh data", async () => {
      // Arrange
      mockOrganizationBillingService.purchaseSubscription.mockResolvedValue({
        id: "org-id",
        name: "Test Organization",
        billingEmail: "test@example.com",
      } as OrganizationResponse);

      // Act
      await sut.upgradeToFamilies(
        mockAccount,
        mockFamiliesPlanDetails,
        mockTokenizedPaymentMethod,
        {
          organizationName: "Test Organization",
          billingAddress: mockBillingAddress,
        },
      );

      // Assert
      expect(mockOrganizationBillingService.purchaseSubscription).toHaveBeenCalledWith(
        expect.objectContaining({
          organization: {
            name: "Test Organization",
            billingEmail: "test@example.com",
          },
          plan: {
            type: PlanType.FamiliesAnnually,
            passwordManagerSeats: 6,
          },
          payment: {
            paymentMethod: ["test-token", PaymentMethodType.Card],
            billing: {
              country: "US",
              postalCode: "12345",
            },
          },
        }),
        "user-id",
      );
      expect(mockApiService.refreshIdentityToken).toHaveBeenCalled();
      expect(mockSyncService.fullSync).toHaveBeenCalledWith(true);
    });

    it("should throw error if password manager seats are 0", async () => {
      // Arrange
      const invalidPlanDetails: PlanDetails = {
        tier: PersonalSubscriptionPricingTierIds.Families,
        details: {
          passwordManager: {
            type: "packaged",
            users: 0,
            annualPrice: 0,
            features: [],
            annualPricePerAdditionalStorageGB: 0,
          },
          id: "families",
          name: "",
          description: "",
          availableCadences: ["annually"],
        },
      };

      mockOrganizationBillingService.purchaseSubscription.mockRejectedValue(
        new Error("Seats must be greater than 0 for families plan"),
      );

      // Act & Assert
      await expect(
        sut.upgradeToFamilies(mockAccount, invalidPlanDetails, mockTokenizedPaymentMethod, {
          organizationName: "Test Organization",
          billingAddress: mockBillingAddress,
        }),
      ).rejects.toThrow("Seats must be greater than 0 for families plan");
      expect(mockOrganizationBillingService.purchaseSubscription).toHaveBeenCalledTimes(1);
    });

    it("should throw error if payment method is incomplete", async () => {
      const incompletePaymentMethod = { type: "card" } as TokenizedPaymentMethod;

      await expect(
        sut.upgradeToFamilies(mockAccount, mockFamiliesPlanDetails, incompletePaymentMethod, {
          organizationName: "Test Organization",
          billingAddress: mockBillingAddress,
        }),
      ).rejects.toThrow("Payment method type or token is missing");
    });
  });
});
