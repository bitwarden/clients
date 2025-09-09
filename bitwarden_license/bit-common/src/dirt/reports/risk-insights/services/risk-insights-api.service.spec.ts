import { mock } from "jest-mock-extended";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { makeEncString } from "@bitwarden/common/spec";
import { OrganizationId } from "@bitwarden/common/types/guid";

import { EncryptedDataModel, SaveRiskInsightsReportRequest } from "../models/password-health";

import { RiskInsightsApiService } from "./risk-insights-api.service";

describe("RiskInsightsApiService", () => {
  let service: RiskInsightsApiService;
  const mockApiService = mock<ApiService>();

  const orgId = "org1" as OrganizationId;

  const getRiskInsightsReportResponse = {
    organizationId: orgId,
    date: new Date().toISOString(),
    reportData: "test",
    reportKey: "test-key",
  };

  const reportData = makeEncString("test").encryptedString?.toString() ?? "";
  const reportKey = makeEncString("test-key").encryptedString?.toString() ?? "";

  const saveRiskInsightsReportRequest: SaveRiskInsightsReportRequest = {
    data: {
      organizationId: orgId,
      date: new Date().toISOString(),
      reportData: reportData,
      reportKey: reportKey,
    },
  };
  const saveRiskInsightsReportResponse = {
    ...saveRiskInsightsReportRequest.data,
  };

  beforeEach(() => {
    service = new RiskInsightsApiService(mockApiService);
  });

  it("should be created", () => {
    expect(service).toBeTruthy();
  });

  it("should call apiService.send with correct parameters for saveRiskInsightsReport", (done) => {
    mockApiService.send.mockReturnValue(Promise.resolve(saveRiskInsightsReportResponse));

    service.saveRiskInsightsReport(saveRiskInsightsReportRequest).subscribe((result) => {
      expect(result).toEqual(saveRiskInsightsReportResponse);
      expect(mockApiService.send).toHaveBeenCalledWith(
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
    mockApiService.send.mockReturnValue(Promise.resolve(saveRiskInsightsReportResponse));

    service.saveRiskInsightsReport(saveRiskInsightsReportRequest).subscribe((result) => {
      expect(result).toEqual(saveRiskInsightsReportResponse);
      expect(mockApiService.send).toHaveBeenCalledWith(
        "POST",
        `/reports/organization-reports`,
        saveRiskInsightsReportRequest.data,
        true,
        true,
      );
      done();
    });
  });

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

  it("should propagate errors from apiService.send for saveRiskInsightsReport - 1", (done) => {
    const error = { statusCode: 500, message: "Internal Server Error" };
    mockApiService.send.mockReturnValue(Promise.reject(error));

    service.saveRiskInsightsReport(saveRiskInsightsReportRequest).subscribe({
      next: () => {
        fail("Expected error to be thrown");
      },
      error: () => {
        expect(mockApiService.send).toHaveBeenCalledWith(
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
    mockApiService.send.mockReturnValue(Promise.reject(error));

    service.saveRiskInsightsReport(saveRiskInsightsReportRequest).subscribe({
      next: () => {
        fail("Expected error to be thrown");
      },
      error: () => {
        expect(mockApiService.send).toHaveBeenCalledWith(
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
    mockApiService.send.mockReturnValue(Promise.resolve(getRiskInsightsReportResponse));

    service.getRiskInsightsReport(orgId).subscribe((result) => {
      expect(result).toEqual(getRiskInsightsReportResponse);
      expect(mockApiService.send).toHaveBeenCalledWith(
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
    mockApiService.send.mockReturnValue(Promise.reject(error));

    service.getRiskInsightsReport(orgId).subscribe((result) => {
      expect(result).toBeNull();
      done();
    });
  });

  it("should throw error if apiService.send rejects with non-404 error for getRiskInsightsReport", (done) => {
    const error = { statusCode: 500, message: "Server error" };
    mockApiService.send.mockReturnValue(Promise.reject(error));

    service.getRiskInsightsReport(orgId).subscribe({
      next: () => {
        // Should not reach here
        fail("Expected error to be thrown");
      },
      error: () => {
        expect(mockApiService.send).toHaveBeenCalledWith(
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
