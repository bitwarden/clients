import { mock } from "jest-mock-extended";
import { firstValueFrom } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { makeEncString } from "@bitwarden/common/spec";
import { OrganizationId, OrganizationReportId } from "@bitwarden/common/types/guid";

import {
  GetRiskInsightsApplicationDataResponse,
  GetRiskInsightsReportResponse,
  GetRiskInsightsSummaryResponse,
  SaveRiskInsightsReportRequest,
  SaveRiskInsightsReportResponse,
} from "../models/api-models.types";
import { EncryptedDataWithKey } from "../models/password-health";

import { RiskInsightsApiService } from "./risk-insights-api.service";

describe("RiskInsightsApiService", () => {
  let service: RiskInsightsApiService;
  const mockApiService = mock<ApiService>();

  const mockId = "id";
  const orgId = "org1" as OrganizationId;
  const mockReportId = "report-1";
  const mockKey = "encryption-key-1";
  const mockData = "encrypted-data";

  const reportData = makeEncString("test").encryptedString?.toString() ?? "";
  const reportKey = makeEncString("test-key").encryptedString?.toString() ?? "";

  const saveRiskInsightsReportRequest: SaveRiskInsightsReportRequest = {
    data: {
      organizationId: orgId,
      date: new Date().toISOString(),
      reportData: reportData,
      contentEncryptionKey: reportKey,
    },
  };

  beforeEach(() => {
    service = new RiskInsightsApiService(mockApiService);
  });

  it("should be created", () => {
    expect(service).toBeTruthy();
  });

  it("getRiskInsightsReport$ should call apiService.send with correct parameters and return the response", () => {
    const getRiskInsightsReportResponse = {
      id: mockId,
      organizationId: orgId,
      date: new Date().toISOString(),
      reportData: mockData,
      contentEncryptionKey: mockKey,
    };

    mockApiService.send.mockReturnValue(Promise.resolve(getRiskInsightsReportResponse));

    service.getRiskInsightsReport$(orgId).subscribe((result) => {
      expect(result).toEqual(new GetRiskInsightsReportResponse(getRiskInsightsReportResponse));
      expect(mockApiService.send).toHaveBeenCalledWith(
        "GET",
        `/reports/organizations/${orgId.toString()}/latest`,
        null,
        true,
        true,
      );
    });
  });

  it("getRiskInsightsReport$ should return null if apiService.send rejects with 404 error", async () => {
    const mockError = new ErrorResponse(null, 404);
    mockApiService.send.mockReturnValue(Promise.reject(mockError));

    const result = await firstValueFrom(service.getRiskInsightsReport$(orgId));

    expect(result).toBeNull();
  });

  it("getRiskInsightsReport$ should propagate errors if apiService.send rejects 500 server error", async () => {
    const error = { statusCode: 500, message: "Server error" };
    mockApiService.send.mockReturnValue(Promise.reject(error));

    await expect(firstValueFrom(service.getRiskInsightsReport$(orgId))).rejects.toEqual(error);

    expect(mockApiService.send).toHaveBeenCalledWith(
      "GET",
      `/reports/organizations/${orgId.toString()}/latest`,
      null,
      true,
      true,
    );
  });

  it("saveRiskInsightsReport$ should call apiService.send with correct parameters", async () => {
    mockApiService.send.mockReturnValue(Promise.resolve(saveRiskInsightsReportRequest));

    const result = await firstValueFrom(
      service.saveRiskInsightsReport$(saveRiskInsightsReportRequest, orgId),
    );

    expect(result).toEqual(new SaveRiskInsightsReportResponse(saveRiskInsightsReportRequest));
    expect(mockApiService.send).toHaveBeenCalledWith(
      "POST",
      `/reports/organizations/${orgId.toString()}`,
      saveRiskInsightsReportRequest.data,
      true,
      true,
    );
  });

  it("saveRiskInsightsReport$ should propagate errors from apiService.send for saveRiskInsightsReport - 1", async () => {
    const error = { statusCode: 500, message: "Internal Server Error" };
    mockApiService.send.mockReturnValue(Promise.reject(error));

    await expect(
      firstValueFrom(service.saveRiskInsightsReport$(saveRiskInsightsReportRequest, orgId)),
    ).rejects.toEqual(error);

    expect(mockApiService.send).toHaveBeenCalledWith(
      "POST",
      `/reports/organizations/${orgId.toString()}`,
      saveRiskInsightsReportRequest.data,
      true,
      true,
    );
  });

  it("saveRiskInsightsReport$ should propagate network errors from apiService.send - 2", async () => {
    const error = new Error("Network error");
    mockApiService.send.mockReturnValue(Promise.reject(error));

    await expect(
      firstValueFrom(service.saveRiskInsightsReport$(saveRiskInsightsReportRequest, orgId)),
    ).rejects.toEqual(error);

    expect(mockApiService.send).toHaveBeenCalledWith(
      "POST",
      `/reports/organizations/${orgId.toString()}`,
      saveRiskInsightsReportRequest.data,
      true,
      true,
    );
  });

  it("getRiskInsightsSummary$ should call apiService.send with correct parameters and return an Observable", async () => {
    const minDate = new Date("2024-01-01");
    const maxDate = new Date("2024-01-31");
    const mockResponse = [
      {
        reportId: mockReportId,
        organizationId: orgId,
        encryptedData: mockData,
        contentEncryptionKey: mockKey,
      },
    ];

    mockApiService.send.mockResolvedValueOnce(mockResponse);

    const result = await firstValueFrom(service.getRiskInsightsSummary$(orgId, minDate, maxDate));

    expect(mockApiService.send).toHaveBeenCalledWith(
      "GET",
      `/reports/organizations/${orgId.toString()}/data/summary?startDate=${minDate.toISOString().split("T")[0]}&endDate=${maxDate.toISOString().split("T")[0]}`,
      null,
      true,
      true,
    );
    expect(result).toEqual(new GetRiskInsightsSummaryResponse(mockResponse));
  });

  it("updateRiskInsightsSummary$ should call apiService.send with correct parameters and return an Observable", async () => {
    const data: EncryptedDataWithKey = {
      organizationId: orgId,
      encryptedData: new EncString(mockData),
      contentEncryptionKey: new EncString(mockKey),
    };

    const reportId = "report123" as OrganizationReportId;

    mockApiService.send.mockResolvedValueOnce(undefined);

    const result = await firstValueFrom(service.updateRiskInsightsSummary$(data, orgId, reportId));

    expect(mockApiService.send).toHaveBeenCalledWith(
      "PATCH",
      `/reports/organizations/${orgId.toString()}/data/summary/${reportId.toString()}`,
      data,
      true,
      true,
    );
    expect(result).toBeUndefined();
  });

  it("getRiskInsightsApplicationData$ should call apiService.send with correct parameters and return an Observable", async () => {
    const reportId = "report123" as OrganizationReportId;
    const mockResponse: EncryptedDataWithKey | null = {
      organizationId: orgId,
      encryptedData: new EncString(mockData),
      contentEncryptionKey: new EncString(mockKey),
    };

    mockApiService.send.mockResolvedValueOnce(mockResponse);

    const result = await firstValueFrom(service.getRiskInsightsApplicationData$(orgId, reportId));
    expect(mockApiService.send).toHaveBeenCalledWith(
      "GET",
      `/reports/organizations/${orgId.toString()}/data/application/${reportId.toString()}`,
      null,
      true,
      true,
    );
    expect(result).toEqual(new GetRiskInsightsApplicationDataResponse(mockResponse));
  });

  it("updateRiskInsightsApplicationData$ should call apiService.send with correct parameters and return an Observable", async () => {
    const applicationData: EncryptedDataWithKey = {
      organizationId: orgId,
      encryptedData: new EncString(mockData),
      contentEncryptionKey: new EncString(mockKey),
    };
    const reportId = "report123" as OrganizationReportId;

    mockApiService.send.mockResolvedValueOnce(undefined);
    const result = await firstValueFrom(
      service.updateRiskInsightsApplicationData$(applicationData, orgId, reportId),
    );
    expect(mockApiService.send).toHaveBeenCalledWith(
      "PATCH",
      `/reports/organizations/${orgId.toString()}/data/application/${reportId.toString()}`,
      applicationData,
      true,
      true,
    );
    expect(result).toBeUndefined();
  });
});
