import { TestBed } from "@angular/core/testing";
import { mock, mockReset } from "jest-mock-extended";
import { of } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { OrganizationUserType } from "@bitwarden/common/admin-console/enums";
import { OrganizationData } from "@bitwarden/common/admin-console/models/data/organization.data";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { OrganizationResponse } from "@bitwarden/common/admin-console/models/response/organization.response";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { OrganizationBillingServiceAbstraction } from "@bitwarden/common/billing/abstractions";
import { PaymentMethodType, PlanType } from "@bitwarden/common/billing/enums";
import { PersonalSubscriptionPricingTierIds } from "@bitwarden/common/billing/types/subscription-pricing-tier";
import { SyncService } from "@bitwarden/common/platform/sync";
import { UserId } from "@bitwarden/common/types/guid";
import { LogService } from "@bitwarden/logging";

import {
  AccountBillingClient,
  SubscriberBillingClient,
  TaxAmounts,
  TaxClient,
} from "../../../../clients";
import {
  BillingAddress,
  NonTokenizablePaymentMethods,
  NonTokenizedPaymentMethod,
  TokenizedPaymentMethod,
} from "../../../../payment/types";

import { UpgradePaymentService, PlanDetails } from "./upgrade-payment.service";

describe("UpgradePaymentService", () => {
  const mockOrganizationBillingService = mock<OrganizationBillingServiceAbstraction>();
  const mockAccountBillingClient = mock<AccountBillingClient>();
  const mockTaxClient = mock<TaxClient>();
  const mockLogService = mock<LogService>();
  const mockApiService = mock<ApiService>();
  const mockSyncService = mock<SyncService>();
  const mockOrganizationService = mock<OrganizationService>();
  const mockAccountService = mock<AccountService>();
  const mockSubscriberBillingClient = mock<SubscriberBillingClient>();

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
    mockReset(mockOrganizationService);
    mockReset(mockAccountService);
    mockReset(mockSubscriberBillingClient);

    mockAccountService.activeAccount$ = of(null);
    mockOrganizationService.organizations$.mockReturnValue(of([]));

    TestBed.configureTestingModule({
      providers: [
        UpgradePaymentService,
        {
          provide: SubscriberBillingClient,
          useValue: mockSubscriberBillingClient,
        },
        {
          provide: OrganizationBillingServiceAbstraction,
          useValue: mockOrganizationBillingService,
        },
        { provide: AccountBillingClient, useValue: mockAccountBillingClient },
        { provide: TaxClient, useValue: mockTaxClient },
        { provide: LogService, useValue: mockLogService },
        { provide: ApiService, useValue: mockApiService },
        { provide: SyncService, useValue: mockSyncService },
        { provide: OrganizationService, useValue: mockOrganizationService },
        { provide: AccountService, useValue: mockAccountService },
      ],
    });

    sut = TestBed.inject(UpgradePaymentService);
  });

  describe("userIsOwnerOfFreeOrg$", () => {
    it("should return true when user is owner of a free organization", (done) => {
      // Arrange
      mockReset(mockAccountService);
      mockReset(mockOrganizationService);

      const mockAccount: Account = {
        id: "user-id" as UserId,
        email: "test@example.com",
        name: "Test User",
        emailVerified: true,
      };

      const paidOrgData = {
        id: "org-1",
        name: "Paid Org",
        useTotp: true, // useTotp = true means NOT free
        type: OrganizationUserType.Owner,
      } as OrganizationData;

      const freeOrgData = {
        id: "org-2",
        name: "Free Org",
        useTotp: false, // useTotp = false means IS free
        type: OrganizationUserType.Owner,
      } as OrganizationData;

      const paidOrg = new Organization(paidOrgData);
      const freeOrg = new Organization(freeOrgData);
      const mockOrganizations = [paidOrg, freeOrg];

      mockAccountService.activeAccount$ = of(mockAccount);
      mockOrganizationService.organizations$.mockReturnValue(of(mockOrganizations));

      const service = new UpgradePaymentService(
        mockOrganizationBillingService,
        mockAccountBillingClient,
        mockTaxClient,
        mockLogService,
        mockApiService,
        mockSyncService,
        mockOrganizationService,
        mockAccountService,
        mockSubscriberBillingClient,
      );

      // Act & Assert
      service.userIsOwnerOfFreeOrg$.subscribe((result) => {
        expect(result).toBe(true);
        done();
      });
    });

    it("should return false when user is not owner of any free organization", (done) => {
      // Arrange
      mockReset(mockAccountService);
      mockReset(mockOrganizationService);

      const mockAccount: Account = {
        id: "user-id" as UserId,
        email: "test@example.com",
        name: "Test User",
        emailVerified: true,
      };

      const paidOrgData = {
        id: "org-1",
        name: "Paid Org",
        useTotp: true, // useTotp = true means NOT free
        type: OrganizationUserType.Owner,
      } as OrganizationData;

      const freeOrgData = {
        id: "org-2",
        name: "Free Org",
        useTotp: false, // useTotp = false means IS free
        type: OrganizationUserType.User, // Not owner
      } as OrganizationData;

      const paidOrg = new Organization(paidOrgData);
      const freeOrg = new Organization(freeOrgData);
      const mockOrganizations = [paidOrg, freeOrg];

      mockAccountService.activeAccount$ = of(mockAccount);
      mockOrganizationService.organizations$.mockReturnValue(of(mockOrganizations));

      const service = new UpgradePaymentService(
        mockOrganizationBillingService,
        mockAccountBillingClient,
        mockTaxClient,
        mockLogService,
        mockApiService,
        mockSyncService,
        mockOrganizationService,
        mockAccountService,
        mockSubscriberBillingClient,
      );

      // Act & Assert
      service.userIsOwnerOfFreeOrg$.subscribe((result) => {
        expect(result).toBe(false);
        done();
      });
    });

    it("should return false when user has no organizations", (done) => {
      // Arrange
      mockReset(mockAccountService);
      mockReset(mockOrganizationService);

      const mockAccount: Account = {
        id: "user-id" as UserId,
        email: "test@example.com",
        name: "Test User",
        emailVerified: true,
      };

      mockAccountService.activeAccount$ = of(mockAccount);
      mockOrganizationService.organizations$.mockReturnValue(of([]));

      const service = new UpgradePaymentService(
        mockOrganizationBillingService,
        mockAccountBillingClient,
        mockTaxClient,
        mockLogService,
        mockApiService,
        mockSyncService,
        mockOrganizationService,
        mockAccountService,
        mockSubscriberBillingClient,
      );

      // Act & Assert
      service.userIsOwnerOfFreeOrg$.subscribe((result) => {
        expect(result).toBe(false);
        done();
      });
    });
  });

  describe("accountCredit$", () => {
    it("should correctly fetch account credit for subscriber", (done) => {
      // Arrange

      const mockAccount: Account = {
        id: "user-id" as UserId,
        email: "test@example.com",
        name: "Test User",
        emailVerified: true,
      };
      const expectedCredit = 25.5;

      mockAccountService.activeAccount$ = of(mockAccount);
      mockSubscriberBillingClient.getCredit.mockResolvedValue(expectedCredit);

      const service = new UpgradePaymentService(
        mockOrganizationBillingService,
        mockAccountBillingClient,
        mockTaxClient,
        mockLogService,
        mockApiService,
        mockSyncService,
        mockOrganizationService,
        mockAccountService,
        mockSubscriberBillingClient,
      );

      // Act & Assert
      service.accountCredit$.subscribe((credit) => {
        expect(credit).toBe(expectedCredit);
        expect(mockSubscriberBillingClient.getCredit).toHaveBeenCalledWith({
          data: mockAccount,
          type: "account",
        });
        done();
      });
    });

    it("should handle empty account", (done) => {
      // Arrange
      mockAccountService.activeAccount$ = of(null);
      const service = new UpgradePaymentService(
        mockOrganizationBillingService,
        mockAccountBillingClient,
        mockTaxClient,
        mockLogService,
        mockApiService,
        mockSyncService,
        mockOrganizationService,
        mockAccountService,
        mockSubscriberBillingClient,
      );
      // Act & Assert
      service?.accountCredit$.subscribe({
        error: () => {
          expect(mockSubscriberBillingClient.getCredit).not.toHaveBeenCalled();
          done();
        },
      });
    });
  });

  describe("adminConsoleRouteForOwnedOrganization$", () => {
    it("should return the admin console route for the first free organization the user owns", (done) => {
      // Arrange
      mockReset(mockAccountService);
      mockReset(mockOrganizationService);

      const mockAccount: Account = {
        id: "user-id" as UserId,
        email: "test@example.com",
        name: "Test User",
        emailVerified: true,
      };

      const paidOrgData = {
        id: "org-1",
        name: "Paid Org",
        useTotp: true, // useTotp = true means NOT free
        type: OrganizationUserType.Owner,
      } as OrganizationData;

      const freeOrgData = {
        id: "org-2",
        name: "Free Org",
        useTotp: false, // useTotp = false means IS free
        type: OrganizationUserType.Owner,
      } as OrganizationData;

      const paidOrg = new Organization(paidOrgData);
      const freeOrg = new Organization(freeOrgData);
      const mockOrganizations = [paidOrg, freeOrg];

      mockAccountService.activeAccount$ = of(mockAccount);
      mockOrganizationService.organizations$.mockReturnValue(of(mockOrganizations));

      const service = new UpgradePaymentService(
        mockOrganizationBillingService,
        mockAccountBillingClient,
        mockTaxClient,
        mockLogService,
        mockApiService,
        mockSyncService,
        mockOrganizationService,
        mockAccountService,
        mockSubscriberBillingClient,
      );

      // Act & Assert
      service.adminConsoleRouteForOwnedOrganization$.subscribe((result) => {
        expect(result).toBe("/organizations/org-2/billing/subscription");
        done();
      });
    });
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

    it("should handle upgrade with account credit payment method and refresh data", async () => {
      // Arrange
      const accountCreditPaymentMethod: NonTokenizedPaymentMethod = {
        type: NonTokenizablePaymentMethods.accountCredit,
      };
      mockAccountBillingClient.purchasePremiumSubscription.mockResolvedValue();

      // Act
      await sut.upgradeToPremium(accountCreditPaymentMethod, mockBillingAddress);

      // Assert
      expect(mockAccountBillingClient.purchasePremiumSubscription).toHaveBeenCalledWith(
        accountCreditPaymentMethod,
        mockBillingAddress,
      );
      expect(mockApiService.refreshIdentityToken).toHaveBeenCalled();
      expect(mockSyncService.fullSync).toHaveBeenCalledWith(true);
    });

    it("should validate payment method type and token", async () => {
      // Arrange
      const noTypePaymentMethod = { token: "test-token" } as any;
      const noTokenPaymentMethod = { type: "card" } as TokenizedPaymentMethod;

      // Act & Assert
      await expect(sut.upgradeToPremium(noTypePaymentMethod, mockBillingAddress)).rejects.toThrow(
        "Payment method type is missing",
      );

      await expect(sut.upgradeToPremium(noTokenPaymentMethod, mockBillingAddress)).rejects.toThrow(
        "Payment method token is missing",
      );
    });

    it("should validate billing address fields", async () => {
      // Arrange
      const missingCountry = { postalCode: "12345" } as any;
      const missingPostal = { country: "US" } as any;
      const nullFields = { country: "US", postalCode: null } as any;

      // Act & Assert
      await expect(
        sut.upgradeToPremium(mockTokenizedPaymentMethod, missingCountry),
      ).rejects.toThrow("Billing address information is incomplete");

      await expect(sut.upgradeToPremium(mockTokenizedPaymentMethod, missingPostal)).rejects.toThrow(
        "Billing address information is incomplete",
      );

      await expect(sut.upgradeToPremium(mockTokenizedPaymentMethod, nullFields)).rejects.toThrow(
        "Billing address information is incomplete",
      );
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

    it("should throw error if payment token is missing with card type", async () => {
      const incompletePaymentMethod = { type: "card" } as TokenizedPaymentMethod;

      await expect(
        sut.upgradeToFamilies(mockAccount, mockFamiliesPlanDetails, incompletePaymentMethod, {
          organizationName: "Test Organization",
          billingAddress: mockBillingAddress,
        }),
      ).rejects.toThrow("Payment method token is missing");
    });
    it("should throw error if organization name is missing", async () => {
      await expect(
        sut.upgradeToFamilies(mockAccount, mockFamiliesPlanDetails, mockTokenizedPaymentMethod, {
          organizationName: "",
          billingAddress: mockBillingAddress,
        }),
      ).rejects.toThrow("Organization name is required for families upgrade");
    });
  });
});
