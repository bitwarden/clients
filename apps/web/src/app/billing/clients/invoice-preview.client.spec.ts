import { TestBed } from "@angular/core/testing";
import { mock, mockReset } from "jest-mock-extended";

import { ApiService } from "@bitwarden/common/abstractions/api.service";

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
    it("should POST premium purchase previews to the premium invoice preview route", async () => {
      const request: PremiumPurchasePreviewRequest = { additionalStorage: 2 };

      await sut.previewPremiumPurchase(request);

      expect(mockApiService.send).toHaveBeenCalledWith(
        "POST",
        "/account/billing/subscriptions/premium/invoice/preview",
        request,
        true,
        true,
      );
    });

    it("should POST premium org upgrade previews to the premium upgrade route", async () => {
      const request: PremiumOrgUpgradePreviewRequest = { planTier: "teams", cadence: "annually" };

      await sut.previewPremiumOrgUpgrade(request);

      expect(mockApiService.send).toHaveBeenCalledWith(
        "POST",
        "/account/billing/subscriptions/premium/upgrade/invoice/preview",
        request,
        true,
        true,
      );
    });

    it("should POST organization purchase previews to the shared organizations route", async () => {
      const organizationPurchase: OrganizationPurchasePreviewRequest = {
        planTier: "teams",
        cadence: "monthly",
        passwordManager: { seats: 5, additionalStorage: 0, sponsored: false },
      };

      await sut.previewOrganizationPurchase(organizationPurchase);

      expect(mockApiService.send).toHaveBeenCalledWith(
        "POST",
        "/account/billing/subscriptions/organizations/invoice/preview",
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
      const result = await sut.previewPremiumPurchase({ additionalStorage: 0 });

      expect(result.planTier).toBe("premium");
      expect(result.cadence).toBe("annually");
      expect(result.passwordManager.seats.reference).toBe("pm-seat");
    });
  });

  describe("error propagation", () => {
    it("should let a 404 propagate rather than returning null", async () => {
      // The routes 404 until each server ticket lands; "route missing" must stay
      // distinguishable from "no subscription".
      mockApiService.send.mockRejectedValue(new Error("404 Not Found"));

      await expect(sut.previewPremiumPurchase({ additionalStorage: 0 })).rejects.toThrow(
        "404 Not Found",
      );
    });
  });
});
