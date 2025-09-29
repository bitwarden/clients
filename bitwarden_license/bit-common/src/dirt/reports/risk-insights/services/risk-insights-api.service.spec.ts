import { mock } from "jest-mock-extended";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { makeEncString } from "@bitwarden/common/spec";
import { OrganizationId, OrganizationReportId } from "@bitwarden/common/types/guid";

import { SaveRiskInsightsReportRequest } from "../models/api-models.types";
import { EncryptedDataModel } from "../models/password-health";

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

  it("Get Report: should call apiService.send with correct parameters and return the response for getRiskInsightsReport ", (done) => {
    mockApiService.send.mockReturnValue(Promise.resolve(getRiskInsightsReportResponse));

    service.getRiskInsightsReport$(orgId).subscribe((result) => {
      expect(result).toEqual(getRiskInsightsReportResponse);
      expect(mockApiService.send).toHaveBeenCalledWith(
        "GET",
        `/reports/organizations/${orgId.toString()}/latest`,
        null,
        true,
        true,
      );
      done();
    });
  });

  it("Get Report: should return null if apiService.send rejects with 404 error for getRiskInsightsReport", (done) => {
    const error = { statusCode: 404 };
    mockApiService.send.mockReturnValue(Promise.reject(error));

    service.getRiskInsightsReport$(orgId).subscribe((result) => {
      expect(result).toBeNull();
      done();
    });
  });

  it("Get Report: should throw error if apiService.send rejects with non-404 error for getRiskInsightsReport", (done) => {
    const error = { statusCode: 500, message: "Server error" };
    mockApiService.send.mockReturnValue(Promise.reject(error));

    service.getRiskInsightsReport$(orgId).subscribe({
      next: () => {
        // Should not reach here
        fail("Expected error to be thrown");
      },
      error: () => {
        expect(mockApiService.send).toHaveBeenCalledWith(
          "GET",
          `/reports/organizations/${orgId.toString()}/latest`,
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

  it("Save Report: should call apiService.send with correct parameters for saveRiskInsightsReport", (done) => {
    mockApiService.send.mockReturnValue(Promise.resolve(saveRiskInsightsReportResponse));

    service.saveRiskInsightsReport$(saveRiskInsightsReportRequest, orgId).subscribe((result) => {
      expect(result).toEqual(saveRiskInsightsReportResponse);
      expect(mockApiService.send).toHaveBeenCalledWith(
        "POST",
        `/reports/organizations/${orgId.toString()}`,
        saveRiskInsightsReportRequest.data,
        true,
        true,
      );
      done();
    });
  });

  it("Save Report: should propagate errors from apiService.send for saveRiskInsightsReport - 1", (done) => {
    const error = { statusCode: 500, message: "Internal Server Error" };
    mockApiService.send.mockReturnValue(Promise.reject(error));

    service.saveRiskInsightsReport$(saveRiskInsightsReportRequest, orgId).subscribe({
      next: () => {
        fail("Expected error to be thrown");
      },
      error: () => {
        expect(mockApiService.send).toHaveBeenCalledWith(
          "POST",
          `/reports/organizations/${orgId.toString()}`,
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

  it("Save Report: should propagate network errors from apiService.send for saveRiskInsightsReport - 2", (done) => {
    const error = new Error("Network error");
    mockApiService.send.mockReturnValue(Promise.reject(error));

    service.saveRiskInsightsReport$(saveRiskInsightsReportRequest, orgId).subscribe({
      next: () => {
        fail("Expected error to be thrown");
      },
      error: () => {
        expect(mockApiService.send).toHaveBeenCalledWith(
          "POST",
          `/reports/organizations/${orgId.toString()}`,
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

  it("Get Summary: should call apiService.send with correct parameters and return an Observable", (done) => {
    const minDate = new Date("2024-01-01");
    const maxDate = new Date("2024-01-31");
    const mockResponse: EncryptedDataModel[] = [{ encryptedData: "abc" } as EncryptedDataModel];

    mockApiService.send.mockResolvedValueOnce(mockResponse);

    service.getRiskInsightsSummary$(orgId, minDate, maxDate).subscribe((result) => {
      expect(mockApiService.send).toHaveBeenCalledWith(
        "GET",
        `/reports/organizations/${orgId.toString()}/data/summary?startDate=${minDate.toISOString().split("T")[0]}&endDate=${maxDate.toISOString().split("T")[0]}`,
        null,
        true,
        true,
      );
      expect(result).toEqual(mockResponse);
      done();
    });
  });

  it("Update Summary: should call apiService.send with correct parameters and return an Observable", (done) => {
    const data: EncryptedDataModel = { encryptedData: "xyz" } as EncryptedDataModel;
    const reportId = "report123" as OrganizationReportId;

    mockApiService.send.mockResolvedValueOnce(undefined);

    service.updateRiskInsightsSummary$(data, orgId, reportId).subscribe((result) => {
      expect(mockApiService.send).toHaveBeenCalledWith(
        "PATCH",
        `/reports/organizations/${orgId.toString()}/data/summary/${reportId.toString()}`,
        data,
        true,
        true,
      );
      expect(result).toBeUndefined();
      done();
    });
  });

  it("Get Applications: should call apiService.send with correct parameters and return an Observable", (done) => {
    const reportId = "report123" as OrganizationReportId;
    const mockResponse: EncryptedDataModel | null = {
      encryptedData: "abc",
    } as EncryptedDataModel;

    mockApiService.send.mockResolvedValueOnce(mockResponse);

    service.getRiskInsightsApplicationData$(orgId, reportId).subscribe((result) => {
      expect(mockApiService.send).toHaveBeenCalledWith(
        "GET",
        `/reports/organizations/${orgId.toString()}/data/application/${reportId.toString()}`,
        null,
        true,
        true,
      );
      expect(result).toEqual(mockResponse);
      done();
    });
  });

  it("Update Applications: should call apiService.send with correct parameters and return an Observable", (done) => {
    const applicationData: EncryptedDataModel = { encryptedData: "xyz" } as EncryptedDataModel;
    const reportId = "report123" as OrganizationReportId;

    mockApiService.send.mockResolvedValueOnce(undefined);

    service
      .updateRiskInsightsApplicationData$(applicationData, orgId, reportId)
      .subscribe((result) => {
        expect(mockApiService.send).toHaveBeenCalledWith(
          "PATCH",
          `/reports/organizations/${orgId.toString()}/data/application/${reportId.toString()}`,
          applicationData,
          true,
          true,
        );
        expect(result).toBeUndefined();
        done();
      });
  });
});
