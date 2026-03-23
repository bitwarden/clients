import { mock, mockReset } from "jest-mock-extended";

import { ApiService } from "@bitwarden/common/abstractions/api.service";

import { BillingAddress } from "../payment/types";

import { OrganizationSubscriptionPurchase, PreviewInvoiceClient } from "./preview-invoice.client";

describe("PreviewInvoiceClient", () => {
  const mockApiService = mock<ApiService>();

  let sut: PreviewInvoiceClient;

  const mockBillingAddress: BillingAddress = {
    line1: "123 Test St",
    line2: null,
    city: "Test City",
    state: "TS",
    country: "US",
    postalCode: "12345",
    taxId: null,
  };

  const mockTaxResponse = { Tax: 2.5, Total: 12.5 };

  beforeEach(() => {
    mockReset(mockApiService);
    mockApiService.send.mockResolvedValue(mockTaxResponse);
    sut = new PreviewInvoiceClient(mockApiService);
  });

  describe("previewTaxForPremiumSubscriptionPurchase", () => {
    it("includes coupons in request body when provided", async () => {
      await sut.previewTaxForPremiumSubscriptionPurchase(0, mockBillingAddress, ["coupon-abc"]);

      expect(mockApiService.send).toHaveBeenCalledWith(
        "POST",
        "/billing/preview-invoice/premium/subscriptions/purchase",
        {
          additionalStorage: 0,
          billingAddress: mockBillingAddress,
          coupons: ["coupon-abc"],
        },
        true,
        true,
      );
    });

    it("includes multiple coupons in request body when provided", async () => {
      await sut.previewTaxForPremiumSubscriptionPurchase(0, mockBillingAddress, [
        "coupon-abc",
        "coupon-xyz",
      ]);

      expect(mockApiService.send).toHaveBeenCalledWith(
        "POST",
        "/billing/preview-invoice/premium/subscriptions/purchase",
        {
          additionalStorage: 0,
          billingAddress: mockBillingAddress,
          coupons: ["coupon-abc", "coupon-xyz"],
        },
        true,
        true,
      );
    });

    it("omits coupons from request body when not provided", async () => {
      await sut.previewTaxForPremiumSubscriptionPurchase(0, mockBillingAddress);

      expect(mockApiService.send).toHaveBeenCalledWith(
        "POST",
        "/billing/preview-invoice/premium/subscriptions/purchase",
        {
          additionalStorage: 0,
          billingAddress: mockBillingAddress,
        },
        true,
        true,
      );
    });

    it("omits coupons from request body when empty array is provided", async () => {
      await sut.previewTaxForPremiumSubscriptionPurchase(0, mockBillingAddress, []);

      const sentBody = mockApiService.send.mock.calls[0][2] as Record<string, unknown>;
      expect(sentBody).not.toHaveProperty("coupons");
    });
  });

  describe("previewTaxForOrganizationSubscriptionPurchase", () => {
    const mockPurchase: OrganizationSubscriptionPurchase = {
      tier: "families",
      cadence: "annually",
      passwordManager: { seats: 1, additionalStorage: 0, sponsored: false },
    };

    it("includes coupons in request body when provided", async () => {
      await sut.previewTaxForOrganizationSubscriptionPurchase(mockPurchase, mockBillingAddress, [
        "coupon-xyz",
      ]);

      expect(mockApiService.send).toHaveBeenCalledWith(
        "POST",
        "/billing/preview-invoice/organizations/subscriptions/purchase",
        {
          purchase: { ...mockPurchase, coupons: ["coupon-xyz"] },
          billingAddress: mockBillingAddress,
        },
        true,
        true,
      );
    });

    it("includes multiple coupons in request body when provided", async () => {
      await sut.previewTaxForOrganizationSubscriptionPurchase(mockPurchase, mockBillingAddress, [
        "coupon-xyz",
        "coupon-abc",
      ]);

      expect(mockApiService.send).toHaveBeenCalledWith(
        "POST",
        "/billing/preview-invoice/organizations/subscriptions/purchase",
        {
          purchase: { ...mockPurchase, coupons: ["coupon-xyz", "coupon-abc"] },
          billingAddress: mockBillingAddress,
        },
        true,
        true,
      );
    });

    it("omits coupons from request body when not provided", async () => {
      await sut.previewTaxForOrganizationSubscriptionPurchase(mockPurchase, mockBillingAddress);

      expect(mockApiService.send).toHaveBeenCalledWith(
        "POST",
        "/billing/preview-invoice/organizations/subscriptions/purchase",
        {
          purchase: mockPurchase,
          billingAddress: mockBillingAddress,
        },
        true,
        true,
      );
    });

    it("omits coupons from request body when empty array is provided", async () => {
      await sut.previewTaxForOrganizationSubscriptionPurchase(mockPurchase, mockBillingAddress, []);

      const sentBody = mockApiService.send.mock.calls[0][2] as Record<string, unknown>;
      expect(sentBody.purchase).not.toHaveProperty("coupons");
    });
  });
});
