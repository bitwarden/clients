import { mock } from "jest-mock-extended";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { EncryptedString } from "@bitwarden/common/platform/models/domain/enc-string";
import { OrganizationId } from "@bitwarden/common/types/guid";

import { SaveRiskInsightsReportRequest } from "../models/password-health";

import { RiskInsightsApiService } from "./risk-insights-api.service";

describe("RiskInsightsApiService", () => {
  let service: RiskInsightsApiService;
  const apiService = mock<ApiService>();

  const orgId = "org1" as OrganizationId;

  const getRiskInsightsReportResponse = {
    organizationId: orgId,
    date: new Date().toISOString(),
    reportData: "test",
    reportKey: "test-key",
  };

  const saveRiskInsightsReportRequest: SaveRiskInsightsReportRequest = {
    data: {
      organizationId: orgId,
      date: new Date().toISOString(),
      reportData: "test" as EncryptedString,
      reportKey: "test-key" as EncryptedString,
    },
  };
  const saveRiskInsightsReportResponse = {
    ...saveRiskInsightsReportRequest.data,
  };

  beforeEach(() => {
    service = new RiskInsightsApiService(apiService);
  });

  it("should be created", () => {
    expect(service).toBeTruthy();
  });

  it("should call apiService.send with correct parameters for saveRiskInsightsReport", (done) => {
    apiService.send.mockReturnValue(Promise.resolve(saveRiskInsightsReportResponse));

    service.saveRiskInsightsReport(saveRiskInsightsReportRequest).subscribe((result) => {
      expect(result).toEqual(saveRiskInsightsReportResponse);
      expect(apiService.send).toHaveBeenCalledWith(
        "POST",
        `/reports/organization-reports`,
        saveRiskInsightsReportRequest.data,
        true,
        true,
      );
      done();
    });
  });

  it("should call apiService.send with correct parameters and return the response for saveRiskInsightsReport ", (done) => {
    apiService.send.mockReturnValue(Promise.resolve(saveRiskInsightsReportResponse));

    service.saveRiskInsightsReport(saveRiskInsightsReportRequest).subscribe((result) => {
      expect(result).toEqual(saveRiskInsightsReportResponse);
      expect(apiService.send).toHaveBeenCalledWith(
        "POST",
        `/reports/organization-reports`,
        saveRiskInsightsReportRequest.data,
        true,
        true,
      );
      done();
    });
  });

  it("should propagate errors from apiService.send for saveRiskInsightsReport - 1", (done) => {
    const error = { statusCode: 500, message: "Internal Server Error" };
    apiService.send.mockReturnValue(Promise.reject(error));

    service.saveRiskInsightsReport(saveRiskInsightsReportRequest).subscribe({
      next: () => {
        fail("Expected error to be thrown");
      },
      error: () => {
        expect(apiService.send).toHaveBeenCalledWith(
          "POST",
          `/reports/organization-reports`,
          saveRiskInsightsReportRequest.data,
          true,
          true,
        );
        done();
      },
      complete: () => {
        done();
      },
    });
  });

  it("should propagate network errors from apiService.send for saveRiskInsightsReport - 2", (done) => {
    const error = new Error("Network error");
    apiService.send.mockReturnValue(Promise.reject(error));

    service.saveRiskInsightsReport(saveRiskInsightsReportRequest).subscribe({
      next: () => {
        fail("Expected error to be thrown");
      },
      error: () => {
        expect(apiService.send).toHaveBeenCalledWith(
          "POST",
          `/reports/organization-reports`,
          saveRiskInsightsReportRequest.data,
          true,
          true,
        );
        done();
      },
      complete: () => {
        done();
      },
    });
  });

  it("should call apiService.send with correct parameters and return the response for getRiskInsightsReport ", (done) => {
    apiService.send.mockReturnValue(Promise.resolve(getRiskInsightsReportResponse));

    service.getRiskInsightsReport(orgId).subscribe((result) => {
      expect(result).toEqual(getRiskInsightsReportResponse);
      expect(apiService.send).toHaveBeenCalledWith(
        "GET",
        `/reports/organization-reports/latest/${orgId.toString()}`,
        null,
        true,
        true,
      );
      done();
    });
  });

  it("should return null if apiService.send rejects with 404 error for getRiskInsightsReport", (done) => {
    const error = { statusCode: 404 };
    apiService.send.mockReturnValue(Promise.reject(error));

    service.getRiskInsightsReport(orgId).subscribe((result) => {
      expect(result).toBeNull();
      done();
    });
  });

  it("should throw error if apiService.send rejects with non-404 error for getRiskInsightsReport", (done) => {
    const error = { statusCode: 500, message: "Server error" };
    apiService.send.mockReturnValue(Promise.reject(error));

    service.getRiskInsightsReport(orgId).subscribe({
      next: () => {
        // Should not reach here
        fail("Expected error to be thrown");
      },
      error: () => {
        expect(apiService.send).toHaveBeenCalledWith(
          "GET",
          `/reports/organization-reports/latest/${orgId.toString()}`,
          null,
          true,
          true,
        );
        done();
      },
      complete: () => {
        done();
      },
    });
  });
});
