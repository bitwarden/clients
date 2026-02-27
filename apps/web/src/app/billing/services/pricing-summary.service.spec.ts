import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { PlanInterval, ProductTierType } from "@bitwarden/common/billing/enums";
import {
  BillingCustomerDiscount,
  OrganizationSubscriptionResponse,
} from "@bitwarden/common/billing/models/response/organization-subscription.response";
import {
  PasswordManagerPlanFeaturesResponse,
  PlanResponse,
  SecretsManagerPlanFeaturesResponse,
} from "@bitwarden/common/billing/models/response/plan.response";

import { PricingSummaryData } from "../shared/pricing-summary/pricing-summary.component";

import { PricingSummaryService } from "./pricing-summary.service";

describe("PricingSummaryService", () => {
  let service: PricingSummaryService;

  beforeEach(() => {
    service = new PricingSummaryService();
  });

  describe("getPricingSummaryData", () => {
    let mockPlan: PlanResponse;
    let mockSub: OrganizationSubscriptionResponse;
    let mockOrganization: Organization;

    beforeEach(() => {
      // Create mock plan with password manager features
      mockPlan = {
        productTier: ProductTierType.Teams,
        PasswordManager: {
          basePrice: 0,
          seatPrice: 48,
          baseSeats: 0,
          hasAdditionalSeatsOption: true,
          hasPremiumAccessOption: false,
          premiumAccessOptionPrice: 0,
          hasAdditionalStorageOption: true,
          additionalStoragePricePerGb: 6,
          baseStorageGb: 1,
        } as PasswordManagerPlanFeaturesResponse,
        SecretsManager: {
          basePrice: 0,
          seatPrice: 72,
          baseSeats: 3,
          hasAdditionalSeatsOption: true,
          hasAdditionalServiceAccountOption: true,
          additionalPricePerServiceAccount: 6,
          baseServiceAccount: 50,
        } as SecretsManagerPlanFeaturesResponse,
      } as PlanResponse;

      // Create mock subscription
      mockSub = {
        seats: 5,
        smSeats: 5,
        smServiceAccounts: 5,
        maxStorageGb: 2,
        customerDiscount: null,
      } as OrganizationSubscriptionResponse;

      // Create mock organization
      mockOrganization = {
        useSecretsManager: false,
      } as Organization;
    });

    it("should calculate pricing data correctly for password manager only", async () => {
      const result = await service.getPricingSummaryData(
        mockPlan,
        mockSub,
        mockOrganization,
        PlanInterval.Monthly,
        false,
        50, // estimatedTax
      );

      expect(result).toEqual<PricingSummaryData>({
        selectedPlanInterval: "month",
        passwordManagerSeats: 5,
        passwordManagerSeatTotal: 240, // 48 * 5
        secretsManagerSeatTotal: 360, // 72 * 5
        additionalStorageTotal: 6, // 6 * (2 - 1)
        additionalStoragePriceMonthly: 6,
        additionalServiceAccountTotal: 0, // No additional service accounts (50 base vs 5 used)
        totalAppliedDiscount: 0,
        secretsManagerSubtotal: 360, // 0 + 360 + 0
        passwordManagerSubtotal: 246, // 0 + 240 + 6
        total: 296, // 246 + 50 (tax) - organization doesn't use secrets manager
        organization: mockOrganization,
        sub: mockSub,
        selectedPlan: mockPlan,
        selectedInterval: PlanInterval.Monthly,
        discountPercentageFromSub: 0,
        discountPercentage: 20,
        acceptingSponsorship: false,
        additionalServiceAccount: 0, // 50 - 5 = 45, which is > 0, so return 0
        storageGb: 1,
        isSecretsManagerTrial: false,
        estimatedTax: 50,
      });
    });

    it("should calculate pricing data correctly with secrets manager enabled", async () => {
      mockOrganization.useSecretsManager = true;

      const result = await service.getPricingSummaryData(
        mockPlan,
        mockSub,
        mockOrganization,
        PlanInterval.Monthly,
        false,
        50,
      );

      expect(result.total).toBe(656); // passwordManagerSubtotal (246) + secretsManagerSubtotal (360) + tax (50)
    });

    it("should handle secrets manager trial", async () => {
      const result = await service.getPricingSummaryData(
        mockPlan,
        mockSub,
        mockOrganization,
        PlanInterval.Monthly,
        true, // isSecretsManagerTrial
        50,
      );

      expect(result.passwordManagerSeatTotal).toBe(0); // Should be 0 during trial
      expect(result.discountPercentageFromSub).toBe(0); // Should be 0 during trial
    });

    it("should handle premium access option", async () => {
      mockPlan.PasswordManager.hasPremiumAccessOption = true;
      mockPlan.PasswordManager.premiumAccessOptionPrice = 25;

      const result = await service.getPricingSummaryData(
        mockPlan,
        mockSub,
        mockOrganization,
        PlanInterval.Monthly,
        false,
        50,
      );

      expect(result.passwordManagerSubtotal).toBe(271); // 0 + 240 + 6 + 25
    });

    it("should handle customer discount", async () => {
      mockSub.customerDiscount = {
        id: "discount1",
        active: true,
        percentOff: 10,
        appliesTo: ["subscription"],
      } as BillingCustomerDiscount;

      const result = await service.getPricingSummaryData(
        mockPlan,
        mockSub,
        mockOrganization,
        PlanInterval.Monthly,
        false,
        50,
      );

      expect(result.discountPercentageFromSub).toBe(10);
    });

    it("should handle zero storage calculation", async () => {
      mockSub.maxStorageGb = 1; // Same as base storage

      const result = await service.getPricingSummaryData(
        mockPlan,
        mockSub,
        mockOrganization,
        PlanInterval.Monthly,
        false,
        50,
      );

      expect(result.additionalStorageTotal).toBe(0);
      expect(result.storageGb).toBe(0);
    });
  });

  describe("getAdditionalServiceAccount", () => {
    let mockPlan: PlanResponse;
    let mockSub: OrganizationSubscriptionResponse;

    beforeEach(() => {
      mockPlan = {
        SecretsManager: {
          baseServiceAccount: 50,
        } as SecretsManagerPlanFeaturesResponse,
      } as PlanResponse;

      mockSub = {
        smServiceAccounts: 55,
      } as OrganizationSubscriptionResponse;
    });

    it("should return additional service accounts when used exceeds base", () => {
      const result = service.getAdditionalServiceAccount(mockPlan, mockSub);
      expect(result).toBe(5); // Math.abs(50 - 55) = 5
    });

    it("should return 0 when used is less than or equal to base", () => {
      mockSub.smServiceAccounts = 40;
      const result = service.getAdditionalServiceAccount(mockPlan, mockSub);
      expect(result).toBe(0);
    });

    it("should return 0 when used equals base", () => {
      mockSub.smServiceAccounts = 50;
      const result = service.getAdditionalServiceAccount(mockPlan, mockSub);
      expect(result).toBe(0);
    });

    it("should return 0 when plan is null", () => {
      const result = service.getAdditionalServiceAccount(null, mockSub);
      expect(result).toBe(0);
    });

    it("should return 0 when plan has no SecretsManager", () => {
      mockPlan.SecretsManager = null;
      const result = service.getAdditionalServiceAccount(mockPlan, mockSub);
      expect(result).toBe(0);
    });
  });
});
