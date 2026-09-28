import { TestBed } from "@angular/core/testing";
import { mock, mockReset } from "jest-mock-extended";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { ProductTierType } from "@bitwarden/common/billing/enums";

import {
  InvoicePreviewClient,
  OrganizationPlanChangePreviewRequest,
  OrganizationPurchasePreviewRequest,
  PremiumOrgUpgradePreviewRequest,
  PremiumPurchasePreviewRequest,
} from "./invoice-preview.client";

describe("InvoicePreviewClient", () => {
  const mockApiService = mock<ApiService>();

  let sut: InvoicePreviewClient;

  const premiumPurchaseRequest: PremiumPurchasePreviewRequest = {
    additionalStorage: 0,
    billingAddress: { country: "US", postalCode: "12345" },
  };

  const invoicePreviewJson = {
    PasswordManager: { Seats: { Reference: "pm-seat", Quantity: 1, Cost: 10 } },
    Cadence: "annually",
    PlanTier: "premium",
    EstimatedTax: 0,
    Total: 10,
    AmountDue: 10,
  };

  beforeEach(() => {
    mockReset(mockApiService);
    mockApiService.send.mockResolvedValue(invoicePreviewJson);

    TestBed.configureTestingModule({
      providers: [{ provide: ApiService, useValue: mockApiService }],
    });

    sut = TestBed.inject(InvoicePreviewClient);
  });

  describe("route constants", () => {
    it("should GET premium purchase previews from the purchase preview route with query params", async () => {
      await sut.previewPremiumPurchase(premiumPurchaseRequest);

      expect(mockApiService.send).toHaveBeenCalledWith(
        "GET",
        "/account/billing/subscription/purchase/preview?additionalStorage=0&country=US&postalCode=12345",
        null,
        true,
        true,
      );
    });

    it("should send each premium purchase coupon as a repeated query key in order", async () => {
      await sut.previewPremiumPurchase({
        additionalStorage: 0,
        coupons: ["A", "B"],
        billingAddress: { country: "US", postalCode: "12345" },
      });

      const [, path] = mockApiService.send.mock.calls[0];
      expect(path).toBe(
        "/account/billing/subscription/purchase/preview?additionalStorage=0&country=US&postalCode=12345&coupons=A&coupons=B",
      );
    });

    it.each([
      ["empty", []],
      ["undefined", undefined],
    ])("should omit the coupons key when premium purchase coupons are %s", async (_, coupons) => {
      await sut.previewPremiumPurchase({
        additionalStorage: 0,
        coupons,
        billingAddress: { country: "US", postalCode: "12345" },
      });

      const [, path] = mockApiService.send.mock.calls[0];
      expect(path).not.toContain("coupons");
    });

    it("should GET premium org upgrade previews from the upgrade preview route with query params", async () => {
      const request: PremiumOrgUpgradePreviewRequest = {
        targetProductTierType: ProductTierType.Teams,
        billingAddress: { country: "US", postalCode: "12345" },
      };

      await sut.previewPremiumOrgUpgrade(request);

      expect(mockApiService.send).toHaveBeenCalledWith(
        "GET",
        `/account/billing/subscription/upgrade/preview?targetProductTierType=${ProductTierType.Teams}&country=US&postalCode=12345`,
        null,
        true,
        true,
      );
    });

    it("should POST organization purchase previews to the shared organizations route", async () => {
      const organizationPurchase: OrganizationPurchasePreviewRequest = {
        purchase: {
          tier: "teams",
          cadence: "monthly",
          passwordManager: { seats: 5, additionalStorage: 0, sponsored: false },
        },
        billingAddress: {
          country: "US",
          postalCode: "12345",
          line1: null,
          line2: null,
          city: null,
          state: null,
          taxId: null,
        },
      };

      await sut.previewOrganizationPurchase(organizationPurchase);

      expect(mockApiService.send).toHaveBeenCalledWith(
        "POST",
        "/organizations/billing/subscription/purchase/preview",
        organizationPurchase,
        true,
        true,
      );
    });

    it("should POST plan change previews to the organization-scoped plan-change route", async () => {
      const request: OrganizationPlanChangePreviewRequest = {
        planTier: "enterprise",
        cadence: "annually",
      };

      await sut.previewOrganizationPlanChange("org-id-123", request);

      expect(mockApiService.send).toHaveBeenCalledWith(
        "POST",
        "/organizations/org-id-123/billing/subscription/plan-change/invoice/preview",
        request,
        true,
        true,
      );
    });
  });

  describe("response parsing", () => {
    it("should wrap the response in InvoicePreviewResponse", async () => {
      const result = await sut.previewPremiumPurchase(premiumPurchaseRequest);

      expect(result.planTier).toBe("premium");
      expect(result.cadence).toBe("annually");
      expect(result.passwordManager.seats.reference).toBe("pm-seat");
    });
  });

  describe("error propagation", () => {
    it("should let a 404 propagate rather than returning null", async () => {
      mockApiService.send.mockRejectedValue(new Error("404 Not Found"));

      await expect(sut.previewPremiumPurchase(premiumPurchaseRequest)).rejects.toThrow(
        "404 Not Found",
      );
    });
  });
});
