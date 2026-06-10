import { mock, mockReset } from "jest-mock-extended";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";

import {
  ChurnMitigationOfferResponseModel,
  OrganizationBillingClient,
} from "./organization-billing.client";

describe("OrganizationBillingClient", () => {
  const mockApiService = mock<ApiService>();

  let sut: OrganizationBillingClient;

  const orgId = "org-123" as any;

  beforeEach(() => {
    mockReset(mockApiService);
    sut = new OrganizationBillingClient(mockApiService);
  });

  describe("getChurnOffer", () => {
    it("calls the correct route and deserializes the response", async () => {
      const raw = {
        CouponId: "CHURN25",
        PercentOff: 25,
        Duration: "repeating",
        DurationInMonths: 12,
        Name: "Loyalty Discount",
      };
      mockApiService.send.mockResolvedValue(raw);

      const result = await sut.getChurnOffer(orgId);

      expect(mockApiService.send).toHaveBeenCalledWith(
        "GET",
        `/organizations/${orgId}/billing/vnext/churn-mitigation-offer`,
        null,
        true,
        true,
      );
      expect(result).toBeInstanceOf(ChurnMitigationOfferResponseModel);
      expect(result!.couponId).toBe("CHURN25");
      expect(result!.percentOff).toBe(25);
      expect(result!.duration).toBe("repeating");
      expect(result!.durationInMonths).toBe(12);
      expect(result!.name).toBe("Loyalty Discount");
    });

    it("returns null when the API returns an empty body (ineligible org)", async () => {
      mockApiService.send.mockResolvedValue(null);

      const result = await sut.getChurnOffer(orgId);

      expect(result).toBeNull();
    });

    it("propagates non-404 errors", async () => {
      const serverError = new ErrorResponse(null, 500);
      mockApiService.send.mockRejectedValue(serverError);

      await expect(sut.getChurnOffer(orgId)).rejects.toBeInstanceOf(ErrorResponse);
    });

    it("returns null when the API returns a falsy body", async () => {
      mockApiService.send.mockResolvedValue(null);

      const result = await sut.getChurnOffer(orgId);

      expect(result).toBeNull();
    });
  });

  describe("redeemChurnOffer", () => {
    it("calls the correct route", async () => {
      mockApiService.send.mockResolvedValue(undefined);

      await sut.redeemChurnOffer(orgId);

      expect(mockApiService.send).toHaveBeenCalledWith(
        "POST",
        `/organizations/${orgId}/billing/vnext/churn-mitigation-offer/redeem`,
        null,
        true,
        false,
      );
    });

    it("propagates errors from the API", async () => {
      const serverError = new ErrorResponse(null, 422);
      mockApiService.send.mockRejectedValue(serverError);

      await expect(sut.redeemChurnOffer(orgId)).rejects.toBeInstanceOf(ErrorResponse);
    });
  });
});
