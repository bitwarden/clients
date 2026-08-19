import { TestBed } from "@angular/core/testing";
import { mock, mockReset } from "jest-mock-extended";

import { SubscriptionPreviewResponse } from "@bitwarden/common/billing/models/response/subscription-preview.response";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import { SubscriptionPreviewClient } from "../clients/subscription-preview.client";

import { SubscriptionPreviewService } from "./subscription-preview.service";

describe("SubscriptionPreviewService", () => {
  const mockClient = mock<SubscriptionPreviewClient>();
  const mockLogService = mock<LogService>();

  let sut: SubscriptionPreviewService;

  const responseJson = (planTier: string) => ({
    Status: "active",
    InvoicePreview: {
      PasswordManager: { Seats: { Reference: "pm-seat", Quantity: 1, Cost: 10 } },
      Cadence: "annually",
      PlanTier: planTier,
      EstimatedTax: 0,
      Total: 10,
      AmountDue: 10,
      NextPaymentAttempt: "2026-06-01T00:00:00.000Z",
    },
    Storage: { Used: 1, Total: 5, Remaining: 4 },
  });

  beforeEach(() => {
    mockReset(mockClient);
    mockReset(mockLogService);

    TestBed.configureTestingModule({
      providers: [
        { provide: SubscriptionPreviewClient, useValue: mockClient },
        { provide: LogService, useValue: mockLogService },
      ],
    });

    sut = TestBed.inject(SubscriptionPreviewService);
  });

  describe("getAccountSubscriptionPreview", () => {
    it("should bake the premium-subscription-page flow context", async () => {
      mockClient.getAccountSubscriptionPreview.mockResolvedValue(
        new SubscriptionPreviewResponse(responseJson("premium")),
      );

      const result = await sut.getAccountSubscriptionPreview();

      expect(result.cart.passwordManager.seats.translationKey).toBe("premiumMembership");
      expect(mockLogService.error).not.toHaveBeenCalled();
    });

    it("should return a subscription preview whose cart is already adapted", async () => {
      mockClient.getAccountSubscriptionPreview.mockResolvedValue(
        new SubscriptionPreviewResponse(responseJson("premium")),
      );

      const result = await sut.getAccountSubscriptionPreview();

      expect(result.status).toBe("active");
      expect(result.cart.total).toBe(10);
      // The adapted cart is the view model, so it carries no raw preview fields.
      expect(Object.keys(result.cart)).not.toContain("planTier");
    });

    it("should populate nextCharge from the invoice preview's next payment attempt", async () => {
      mockClient.getAccountSubscriptionPreview.mockResolvedValue(
        new SubscriptionPreviewResponse(responseJson("premium")),
      );

      const result = await sut.getAccountSubscriptionPreview();

      expect(result).toMatchObject({ nextCharge: new Date("2026-06-01T00:00:00.000Z") });
    });
  });

  describe("getOrganizationSubscriptionPreview", () => {
    it("should bake the organization-subscription-page flow context", async () => {
      mockClient.getOrganizationSubscriptionPreview.mockResolvedValue(
        new SubscriptionPreviewResponse(responseJson("teams")),
      );

      const result = await sut.getOrganizationSubscriptionPreview("org-id-123");

      expect(result.cart.passwordManager.seats.translationKey).toBe("passwordManagerPlanPrice");
    });

    it("should pass the organization id through to the client", async () => {
      mockClient.getOrganizationSubscriptionPreview.mockResolvedValue(
        new SubscriptionPreviewResponse(responseJson("teams")),
      );

      await sut.getOrganizationSubscriptionPreview("org-id-123");

      expect(mockClient.getOrganizationSubscriptionPreview).toHaveBeenCalledWith("org-id-123");
    });
  });

  describe("error propagation", () => {
    it("should let client errors propagate", async () => {
      mockClient.getAccountSubscriptionPreview.mockRejectedValue(new Error("404 Not Found"));

      await expect(sut.getAccountSubscriptionPreview()).rejects.toThrow("404 Not Found");
    });
  });
});
