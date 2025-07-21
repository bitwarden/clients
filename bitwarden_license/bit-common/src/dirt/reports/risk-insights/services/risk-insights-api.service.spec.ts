import { mock } from "jest-mock-extended";

import { ApiService } from "@bitwarden/common/abstractions/api.service";

import { EncryptedDataModel } from "../models/password-health";

import { RiskInsightsApiService } from "./risk-insights-api.service";

describe("RiskInsightsApiService", () => {
  let service: RiskInsightsApiService;
  const mockApiService = mock<ApiService>();

  beforeEach(() => {
    service = new RiskInsightsApiService(mockApiService);
  });

  it("should be created", () => {
    expect(service).toBeTruthy();
  });

  describe("getRiskInsightsSummary", () => {
    it("should call apiService.send with correct parameters and return an Observable", (done) => {
      const orgId = "org123";
      const minDate = new Date("2024-01-01");
      const maxDate = new Date("2024-01-31");
      const mockResponse: EncryptedDataModel[] = [{ encryptedData: "abc" } as EncryptedDataModel];

      mockApiService.send.mockResolvedValueOnce(mockResponse);

      service.getRiskInsightsSummary(orgId, minDate, maxDate).subscribe((result) => {
        expect(mockApiService.send).toHaveBeenCalledWith(
          "GET",
          `organization-report-summary/org123?from=2024-01-01&to=2024-01-31`,
          null,
          true,
          true,
        );
        expect(result).toEqual(mockResponse);
        done();
      });
    });
  });

  describe("saveRiskInsightsSummary", () => {
    it("should call apiService.send with correct parameters and return an Observable", (done) => {
      const data: EncryptedDataModel = { encryptedData: "xyz" } as EncryptedDataModel;

      mockApiService.send.mockResolvedValueOnce(undefined);

      service.saveRiskInsightsSummary(data).subscribe((result) => {
        expect(mockApiService.send).toHaveBeenCalledWith(
          "POST",
          "organization-report-summary",
          data,
          true,
          true,
        );
        expect(result).toBeUndefined();
        done();
      });
    });
  });

  describe("updateRiskInsightsSummary", () => {
    it("should call apiService.send with correct parameters and return an Observable", (done) => {
      const data: EncryptedDataModel = { encryptedData: "xyz" } as EncryptedDataModel;

      mockApiService.send.mockResolvedValueOnce(undefined);

      service.updateRiskInsightsSummary(data).subscribe((result) => {
        expect(mockApiService.send).toHaveBeenCalledWith(
          "PUT",
          "organization-report-summary",
          data,
          true,
          true,
        );
        expect(result).toBeUndefined();
        done();
      });
    });
  });
});
