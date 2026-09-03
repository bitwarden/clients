import { TestBed } from "@angular/core/testing";
import { mock, mockReset } from "jest-mock-extended";

import { ApiService } from "@bitwarden/common/abstractions/api.service";

import { SubscriptionPreviewClient } from "./subscription-preview.client";

describe("SubscriptionPreviewClient", () => {
  const mockApiService = mock<ApiService>();

  let sut: SubscriptionPreviewClient;

  const subscriptionPreviewJson = {
    Status: "active",
    InvoicePreview: {
      PasswordManager: { Seats: { Reference: "pm-seat", Quantity: 1, Cost: 10 } },
      Cadence: "annually",
      PlanTier: "premium",
      EstimatedTax: 0,
      Total: 10,
      AmountDue: 10,
      NextPaymentAttempt: "2026-06-01T00:00:00.000Z",
    },
    Storage: { Available: 5, Used: 1, ReadableUsed: "1 GB" },
  };

  beforeEach(() => {
    mockReset(mockApiService);
    mockApiService.send.mockResolvedValue(subscriptionPreviewJson);

    TestBed.configureTestingModule({
      providers: [{ provide: ApiService, useValue: mockApiService }],
    });

    sut = TestBed.inject(SubscriptionPreviewClient);
  });

  describe("route constants", () => {
    it("should GET the account subscription preview route", async () => {
      await sut.getAccountSubscriptionPreview();

      expect(mockApiService.send).toHaveBeenCalledWith(
        "GET",
        "/account/billing/subscription/preview",
        null,
        true,
        true,
      );
    });

    it("should GET the organization-scoped subscription preview route", async () => {
      await sut.getOrganizationSubscriptionPreview("org-id-123");

      expect(mockApiService.send).toHaveBeenCalledWith(
        "GET",
        "/organizations/org-id-123/billing/subscription/preview",
        null,
        true,
        true,
      );
    });
  });

  describe("response parsing", () => {
    it("should wrap the response in SubscriptionPreviewResponse", async () => {
      const result = await sut.getAccountSubscriptionPreview();

      expect(result.status).toBe("active");
      expect(result.invoicePreview.planTier).toBe("premium");
      expect(result.storage).toMatchObject({ available: 5, used: 1, readableUsed: "1 GB" });
    });
  });

  describe("error propagation", () => {
    it("should let a 404 propagate rather than returning null", async () => {
      mockApiService.send.mockRejectedValue(new Error("404 Not Found"));

      await expect(sut.getAccountSubscriptionPreview()).rejects.toThrow("404 Not Found");
    });
  });
});
