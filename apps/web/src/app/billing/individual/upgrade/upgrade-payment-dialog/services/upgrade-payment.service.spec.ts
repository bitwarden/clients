import { TestBed } from "@angular/core/testing";
import { mock, mockReset } from "jest-mock-extended";

import { OrganizationResponse } from "@bitwarden/common/admin-console/models/response/organization.response";
import { Account } from "@bitwarden/common/auth/abstractions/account.service";
import { OrganizationBillingServiceAbstraction } from "@bitwarden/common/billing/abstractions";
import { TaxServiceAbstraction } from "@bitwarden/common/billing/abstractions/tax.service.abstraction";
import { PaymentMethodType, PlanType } from "@bitwarden/common/billing/enums";
import { PreviewInvoiceResponse } from "@bitwarden/common/billing/models/response/preview-invoice.response";
import { UserId } from "@bitwarden/common/types/guid";
import { LogService } from "@bitwarden/logging";

import { SubscriberBillingClient } from "../../../../clients";
import { TokenizedPaymentMethod } from "../../../../payment/types";
import { BitwardenSubscriber } from "../../../../types";
import { PersonalSubscriptionPricingTierIds } from "../../../../types/subscription-pricing-tier";

import { UpgradePaymentService, PlanDetails } from "./upgrade-payment.service";

describe("UpgradePaymentService", () => {
  const mockOrganizationBillingService = mock<OrganizationBillingServiceAbstraction>();
  const mockSubscriberBillingClient = mock<SubscriberBillingClient>();
  const mockTaxService = mock<TaxServiceAbstraction>();
  const mockLogService = mock<LogService>();

  let sut: UpgradePaymentService;

  const mockSubscriber: BitwardenSubscriber = {
    type: "account",
    data: {
      id: "user-id" as UserId,
      email: "test@example.com",
    } as Account,
  };

  const mockTokenizedPaymentMethod: TokenizedPaymentMethod = {
    token: "test-token",
    type: "card",
  };

  const mockBillingAddress = {
    country: "US",
    postalCode: "12345",
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
    mockReset(mockSubscriberBillingClient);
    mockReset(mockTaxService);
    mockReset(mockLogService);

    TestBed.configureTestingModule({
      providers: [
        UpgradePaymentService,
        {
          provide: OrganizationBillingServiceAbstraction,
          useValue: mockOrganizationBillingService,
        },
        { provide: SubscriberBillingClient, useValue: mockSubscriberBillingClient },
        { provide: TaxServiceAbstraction, useValue: mockTaxService },
        { provide: LogService, useValue: mockLogService },
      ],
    });

    sut = TestBed.inject(UpgradePaymentService);
  });

  describe("calculateEstimatedTax", () => {
    it("should calculate tax for premium plan", async () => {
      // Arrange
      const mockResponse = mock<PreviewInvoiceResponse>();
      mockResponse.taxAmount = 2.5;

      mockTaxService.previewIndividualInvoice.mockResolvedValue(mockResponse);

      // Act
      const result = await sut.calculateEstimatedTax(mockPremiumPlanDetails, mockBillingAddress);

      // Assert
      expect(result).toEqual(2.5);
      expect(mockTaxService.previewIndividualInvoice).toHaveBeenCalledWith({
        passwordManager: { additionalStorage: 0 },
        taxInformation: {
          postalCode: "12345",
          country: "US",
        },
      });
    });

    it("should calculate tax for families plan", async () => {
      // Arrange
      const mockResponse = mock<PreviewInvoiceResponse>();
      mockResponse.taxAmount = 5.0;

      mockTaxService.previewOrganizationInvoice.mockResolvedValue(mockResponse);

      // Act
      const result = await sut.calculateEstimatedTax(mockFamiliesPlanDetails, mockBillingAddress);

      // Assert
      expect(result).toEqual(5.0);
      expect(mockTaxService.previewOrganizationInvoice).toHaveBeenCalledWith({
        passwordManager: {
          additionalStorage: 0,
          plan: PlanType.FamiliesAnnually,
          seats: 6,
        },
        taxInformation: {
          postalCode: "12345",
          country: "US",
          taxId: null,
        },
      });
    });

    it("should throw and log error if personal tax calculation fails", async () => {
      const error = new Error("Tax service error");
      mockTaxService.previewIndividualInvoice.mockRejectedValue(error);

      await expect(
        sut.calculateEstimatedTax(mockPremiumPlanDetails, mockBillingAddress),
      ).rejects.toThrow();
      expect(mockLogService.error).toHaveBeenCalledWith("Tax calculation failed:", error);
    });

    it("should throw and log error if organization tax calculation fails", async () => {
      const error = new Error("Tax service error");
      mockTaxService.previewOrganizationInvoice.mockRejectedValue(error);

      await expect(
        sut.calculateEstimatedTax(mockFamiliesPlanDetails, mockBillingAddress),
      ).rejects.toThrow();
      expect(mockLogService.error).toHaveBeenCalledWith("Tax calculation failed:", error);
    });
  });

  describe("upgradeToPremium", () => {
    it("should call subscriberBillingClient to purchase premium subscription", async () => {
      mockSubscriberBillingClient.purchasePremiumSubscription.mockResolvedValue();

      await sut.upgradeToPremium(mockSubscriber, mockTokenizedPaymentMethod, mockBillingAddress);

      expect(mockSubscriberBillingClient.purchasePremiumSubscription).toHaveBeenCalledWith(
        mockSubscriber,
        mockTokenizedPaymentMethod,
        mockBillingAddress,
      );
    });

    it("should throw error if payment method is incomplete", async () => {
      const incompletePaymentMethod = { type: "card" } as TokenizedPaymentMethod;

      await expect(
        sut.upgradeToPremium(mockSubscriber, incompletePaymentMethod, mockBillingAddress),
      ).rejects.toThrow("Payment method type or token is missing");
    });

    it("should throw error if billing address is incomplete", async () => {
      const incompleteBillingAddress = { country: "US", postalCode: undefined } as any;

      await expect(
        sut.upgradeToPremium(mockSubscriber, mockTokenizedPaymentMethod, incompleteBillingAddress),
      ).rejects.toThrow("Billing address information is incomplete");
    });
  });

  describe("upgradeToFamilies", () => {
    it("should call organizationBillingService to purchase subscription", async () => {
      mockOrganizationBillingService.purchaseSubscription.mockResolvedValue({
        id: "org-id",
        name: "Test Organization",
        billingEmail: "test@example.com",
      } as OrganizationResponse);

      await sut.upgradeToFamilies(
        mockSubscriber,
        mockFamiliesPlanDetails,
        mockTokenizedPaymentMethod,
        {
          organizationName: "Test Organization",
          billingAddress: mockBillingAddress,
        },
      );

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
    });
    it("should throw error if password manager seats are 0", async () => {
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

      await expect(
        sut.upgradeToFamilies(mockSubscriber, invalidPlanDetails, mockTokenizedPaymentMethod, {
          organizationName: "Test Organization",
          billingAddress: mockBillingAddress,
        }),
      ).rejects.toThrow("Seats must be greater than 0 for families plan");
    });

    it("should throw error if subscriber is not an account", async () => {
      const invalidSubscriber = { type: "organization" } as BitwardenSubscriber;

      await expect(
        sut.upgradeToFamilies(
          invalidSubscriber,
          mockFamiliesPlanDetails,
          mockTokenizedPaymentMethod,
          {
            organizationName: "Test Organization",
            billingAddress: mockBillingAddress,
          },
        ),
      ).rejects.toThrow("Subscriber must be an account for families upgrade");
    });

    it("should throw error if payment method is incomplete", async () => {
      const incompletePaymentMethod = { type: "card" } as TokenizedPaymentMethod;

      await expect(
        sut.upgradeToFamilies(mockSubscriber, mockFamiliesPlanDetails, incompletePaymentMethod, {
          organizationName: "Test Organization",
          billingAddress: mockBillingAddress,
        }),
      ).rejects.toThrow("Payment method type or token is missing");
    });

    describe("tokenizablePaymentMethodToLegacyEnum", () => {
      it("should convert 'card' to PaymentMethodType.Card", () => {
        const result = sut.tokenizablePaymentMethodToLegacyEnum("card");
        expect(result).toBe(PaymentMethodType.Card);
      });

      it("should convert 'bankAccount' to PaymentMethodType.BankAccount", () => {
        const result = sut.tokenizablePaymentMethodToLegacyEnum("bankAccount");
        expect(result).toBe(PaymentMethodType.BankAccount);
      });

      it("should convert 'payPal' to PaymentMethodType.PayPal", () => {
        const result = sut.tokenizablePaymentMethodToLegacyEnum("payPal");
        expect(result).toBe(PaymentMethodType.PayPal);
      });
    });
  });
});
