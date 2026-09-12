import { TestBed } from "@angular/core/testing";
import { mock, mockReset } from "jest-mock-extended";

import { ProductTierType } from "@bitwarden/common/billing/enums";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { InvoicePreview } from "@bitwarden/pricing";

import {
  InvoicePreviewClient,
  OrganizationPlanChangePreviewRequest,
  OrganizationPurchasePreviewRequest,
  PremiumOrgUpgradePreviewRequest,
} from "../clients/invoice-preview.client";

import { InvoicePreviewService } from "./invoice-preview.service";

describe("InvoicePreviewService", () => {
  const mockClient = mock<InvoicePreviewClient>();
  const mockLogService = mock<LogService>();

  let sut: InvoicePreviewService;

  const premiumOrgUpgradeRequest: PremiumOrgUpgradePreviewRequest = {
    targetProductTierType: ProductTierType.Enterprise,
    billingAddress: { country: "US", postalCode: "12345" },
  };

  // The real adapter is used throughout, so each method's baked flow context is observable
  // through the translation keys it produces.
  const preview = (planTier: InvoicePreview["planTier"]): InvoicePreview => ({
    passwordManager: { seats: { reference: "pm-seat", quantity: 5, cost: 50 } },
    cadence: "monthly",
    planTier,
    estimatedTax: 9.6,
    total: 259.6,
    amountDue: 259.6,
  });

  const organizationPurchase: OrganizationPurchasePreviewRequest = {
    planTier: "families",
    cadence: "monthly",
    passwordManager: { seats: 5, additionalStorage: 0, sponsored: false },
  };

  beforeEach(() => {
    mockReset(mockClient);
    mockReset(mockLogService);

    TestBed.configureTestingModule({
      providers: [
        { provide: InvoicePreviewClient, useValue: mockClient },
        { provide: LogService, useValue: mockLogService },
      ],
    });

    sut = TestBed.inject(InvoicePreviewService);
  });

  describe("previewPremiumPurchaseCart", () => {
    it("should bake the personal-checkout flow context", async () => {
      mockClient.previewPremiumPurchase.mockResolvedValue(preview("premium") as never);

      const cart = await sut.previewPremiumPurchaseCart({ additionalStorage: 0 });

      expect(cart.passwordManager.seats.translationKey).toBe("premiumMembership");
      expect(mockLogService.error).not.toHaveBeenCalled();
    });

    it("should return an adapted cart carrying the authoritative total", async () => {
      mockClient.previewPremiumPurchase.mockResolvedValue(preview("premium") as never);

      const cart = await sut.previewPremiumPurchaseCart({ additionalStorage: 0 });

      expect(cart.total).toBe(259.6);
      expect(cart.estimatedTax).toBe(9.6);
    });
  });

  describe("previewFamiliesPurchaseCart", () => {
    it("should bake the personal-checkout flow context on the shared route", async () => {
      mockClient.previewOrganizationPurchase.mockResolvedValue(preview("families") as never);

      const cart = await sut.previewFamiliesPurchaseCart(organizationPurchase);

      expect(cart.passwordManager.seats.translationKey).toBe("familiesMembership");
      expect(mockClient.previewOrganizationPurchase).toHaveBeenCalledWith(organizationPurchase);
    });
  });

  describe("previewOrganizationCheckoutCart", () => {
    it("should bake the organization-checkout flow context on the same shared route", async () => {
      mockClient.previewOrganizationPurchase.mockResolvedValue(preview("families") as never);

      const cart = await sut.previewOrganizationCheckoutCart(organizationPurchase);

      // Same route and same tier as previewFamiliesPurchaseCart, but a different flow context,
      // which is exactly what distinguishes the two methods.
      expect(cart.passwordManager.seats.translationKey).toBe("passwordManagerPlanPrice");
    });
  });

  describe("previewPremiumOrgUpgradeCart", () => {
    it("should bake the premium-org-upgrade flow context", async () => {
      mockClient.previewPremiumOrgUpgrade.mockResolvedValue(preview("enterprise") as never);

      const { cart } = await sut.previewPremiumOrgUpgradeCart(premiumOrgUpgradeRequest);

      expect(cart.passwordManager.seats.translationKey).toBe("enterpriseMembership");
    });

    it("should emit the premium subscription credit row for prorated upgrades", async () => {
      mockClient.previewPremiumOrgUpgrade.mockResolvedValue({
        ...preview("enterprise"),
        passwordManager: {
          seats: { reference: "pm-seat", quantity: 5, cost: 50 },
          prorations: [{ credit: 20, charge: 0, tax: 0, total: 0, months: 6 }],
        },
      } as never);

      const { cart } = await sut.previewPremiumOrgUpgradeCart(premiumOrgUpgradeRequest);

      expect(cart.credit).toEqual({ translationKey: "premiumSubscriptionCredit", value: 20 });
    });

    it("should return the prorated month count alongside the adapted cart", async () => {
      const response = {
        ...preview("enterprise"),
        passwordManager: {
          seats: { reference: "pm-seat", quantity: 1, cost: 26.67 },
          prorations: [{ credit: 6.67, charge: 26.67, tax: 2, total: 20, months: 8 }],
        },
      };
      mockClient.previewPremiumOrgUpgrade.mockResolvedValue(response as never);

      const { cart, proratedMonths } =
        await sut.previewPremiumOrgUpgradeCart(premiumOrgUpgradeRequest);

      // The cart carries no month count, which is why the caller needs it alongside.
      expect(cart.passwordManager.seats.cost).toBe(26.67);
      expect(proratedMonths).toBe(8);
    });

    it("should report zero prorated months when the preview carries no prorations", async () => {
      mockClient.previewPremiumOrgUpgrade.mockResolvedValue(preview("enterprise") as never);

      const { proratedMonths } = await sut.previewPremiumOrgUpgradeCart(premiumOrgUpgradeRequest);

      expect(proratedMonths).toBe(0);
    });
  });

  describe("previewPlanChangeCart", () => {
    it("should bake the organization-plan-change flow context", async () => {
      mockClient.previewOrganizationPlanChange.mockResolvedValue({
        ...preview("teams"),
        passwordManager: {
          seats: { reference: "pm-seat", quantity: 5, cost: 50 },
          prorations: [{ credit: 12.5, charge: 0, tax: 0, total: 0, months: 6 }],
        },
      } as never);

      const cart = await sut.previewPlanChangeCart("org-id-123", {
        planTier: "teams",
        cadence: "annually",
      });

      expect(cart.credit).toEqual({ translationKey: "appliedSubscriptionCredits", value: 12.5 });
      expect(cart.passwordManager.seats.translationKey).toBe("passwordManagerPlanPrice");
      expect(mockLogService.error).not.toHaveBeenCalled();
    });

    it("should pass the organization id through to the client", async () => {
      mockClient.previewOrganizationPlanChange.mockResolvedValue(preview("teams") as never);
      const request: OrganizationPlanChangePreviewRequest = {
        planTier: "teams",
        cadence: "annually",
      };

      await sut.previewPlanChangeCart("org-id-123", request);

      expect(mockClient.previewOrganizationPlanChange).toHaveBeenCalledWith("org-id-123", request);
    });
  });

  describe("error propagation", () => {
    it("should let client errors propagate", async () => {
      mockClient.previewPremiumPurchase.mockRejectedValue(new Error("404 Not Found"));

      await expect(sut.previewPremiumPurchaseCart({ additionalStorage: 0 })).rejects.toThrow(
        "404 Not Found",
      );
    });
  });
});
