import { mock } from "jest-mock-extended";
import { firstValueFrom } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { makeEncString } from "@bitwarden/common/spec";
import { OrganizationId, OrganizationReportId } from "@bitwarden/common/types/guid";

import { EncryptedDataWithKey } from "../../models";
import {
  GetRiskInsightsApplicationDataResponse,
  GetRiskInsightsReportResponse,
  GetRiskInsightsSummaryResponse,
  SaveRiskInsightsReportRequest,
  SaveRiskInsightsReportResponse,
} from "../../models/api-models.types";
import { RiskInsightsMetrics } from "../../models/domain/risk-insights-metrics";
import { mockApplicationData, mockReportData, mockSummaryData } from "../../models/mocks/mock-data";
import { RiskInsightsApiService } from "../api/risk-insights-api.service";

describe("RiskInsightsApiService", () => {
  let service: RiskInsightsApiService;
  const mockApiService = mock<ApiService>();

  const mockId = "id";
  const orgId = "org1" as OrganizationId;
  const mockReportId = "report-1";
  const mockKey = "encryption-key-1";

  const mockReportKey = makeEncString("test-key");

  const mockReportEnc = makeEncString(JSON.stringify(mockReportData));
  const mockSummaryEnc = makeEncString(JSON.stringify(mockSummaryData));
  const mockApplicationsEnc = makeEncString(JSON.stringify(mockApplicationData));

  const mockMetrics: RiskInsightsMetrics = new RiskInsightsMetrics();
  mockMetrics.totalApplicationCount = 3;
  mockMetrics.totalAtRiskApplicationCount = 1;
  mockMetrics.totalAtRiskMemberCount = 2;
  mockMetrics.totalAtRiskPasswordCount = 1;
  mockMetrics.totalCriticalApplicationCount = 1;
  mockMetrics.totalCriticalAtRiskApplicationCount = 1;
  mockMetrics.totalCriticalMemberCount = 1;
  mockMetrics.totalCriticalAtRiskMemberCount = 1;
  mockMetrics.totalCriticalPasswordCount = 0;
  mockMetrics.totalCriticalAtRiskPasswordCount = 0;
  mockMetrics.totalMemberCount = 5;
  mockMetrics.totalPasswordCount = 2;

  const mockSaveRiskInsightsReportRequest: SaveRiskInsightsReportRequest = {
    data: {
      organizationId: orgId,
      creationDate: new Date().toISOString(),
      reportData: mockReportEnc.decryptedValue ?? "",
      summaryData: mockReportEnc.decryptedValue ?? "",
      applicationData: mockReportEnc.decryptedValue ?? "",
      contentEncryptionKey: mockReportKey.decryptedValue ?? "",
      metrics: mockMetrics.toRiskInsightsMetricsData(),
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
      reportData: mockReportEnc,
      summaryData: mockSummaryEnc,
      applicationData: mockApplicationsEnc,
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

  it("downloadRiskInsightsReport$ should call apiService.send with correct parameters and return the response", () => {
    const downloadResponse = {
      id: mockId,
      organizationId: orgId,
      date: new Date().toISOString(),
      reportData: mockReportEnc,
      summaryData: mockSummaryEnc,
      applicationData: mockApplicationsEnc,
      contentEncryptionKey: mockKey,
    };

    mockApiService.send.mockReturnValue(Promise.resolve(downloadResponse));

    service.downloadRiskInsightsReport$(orgId).subscribe((result) => {
      expect(result).toEqual(new GetRiskInsightsReportResponse(downloadResponse));
      expect(mockApiService.send).toHaveBeenCalledWith(
        "GET",
        `/reports/organizations/${orgId.toString()}/latest/download`,
        null,
        true,
        true,
      );
    });
  });

  it("downloadRiskInsightsReport$ should return null if apiService.send rejects with 404 error", async () => {
    const mockError = new ErrorResponse(null, 404);
    mockApiService.send.mockReturnValue(Promise.reject(mockError));

    const result = await firstValueFrom(service.downloadRiskInsightsReport$(orgId));

    expect(result).toBeNull();
  });

  it("downloadRiskInsightsReport$ should propagate errors if apiService.send rejects with 500 server error", async () => {
    const error = { statusCode: 500, message: "Server error" };
    mockApiService.send.mockReturnValue(Promise.reject(error));

    await expect(firstValueFrom(service.downloadRiskInsightsReport$(orgId))).rejects.toEqual(error);

    expect(mockApiService.send).toHaveBeenCalledWith(
      "GET",
      `/reports/organizations/${orgId.toString()}/latest/download`,
      null,
      true,
      true,
    );
  });

  it("saveRiskInsightsReport$ should call apiService.send with correct parameters", async () => {
    mockApiService.send.mockReturnValue(Promise.resolve(mockSaveRiskInsightsReportRequest));

    const result = await firstValueFrom(
      service.saveRiskInsightsReport$(mockSaveRiskInsightsReportRequest, orgId),
    );

    expect(result).toEqual(new SaveRiskInsightsReportResponse(mockSaveRiskInsightsReportRequest));
    expect(mockApiService.send).toHaveBeenCalledWith(
      "POST",
      `/reports/organizations/${orgId.toString()}`,
      mockSaveRiskInsightsReportRequest.data,
      true,
      true,
    );
  });

  it("saveRiskInsightsReport$ should propagate errors from apiService.send for saveRiskInsightsReport - 1", async () => {
    const error = new ErrorResponse({ message: "Internal Server Error" }, 500);
    mockApiService.send.mockReturnValue(Promise.reject(error));

    await expect(
      firstValueFrom(service.saveRiskInsightsReport$(mockSaveRiskInsightsReportRequest, orgId)),
    ).rejects.toThrow("Failed to save risk insights report: Internal Server Error (Status: 500)");

    expect(mockApiService.send).toHaveBeenCalledWith(
      "POST",
      `/reports/organizations/${orgId.toString()}`,
      mockSaveRiskInsightsReportRequest.data,
      true,
      true,
    );
  });

  it("saveRiskInsightsReport$ should propagate network errors from apiService.send - 2", async () => {
    const error = new Error("Network error");
    mockApiService.send.mockReturnValue(Promise.reject(error));

    await expect(
      firstValueFrom(service.saveRiskInsightsReport$(mockSaveRiskInsightsReportRequest, orgId)),
    ).rejects.toThrow("Failed to save risk insights report: Network error");

    expect(mockApiService.send).toHaveBeenCalledWith(
      "POST",
      `/reports/organizations/${orgId.toString()}`,
      mockSaveRiskInsightsReportRequest.data,
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
        encryptedData: mockReportData,
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

  it("getRiskInsightsSummary$ should enrich errors from apiService.send", async () => {
    const minDate = new Date("2024-01-01");
    const maxDate = new Date("2024-01-31");
    const error = new ErrorResponse({ message: "Bad Request" }, 400);
    mockApiService.send.mockReturnValue(Promise.reject(error));

    await expect(
      firstValueFrom(service.getRiskInsightsSummary$(orgId, minDate, maxDate)),
    ).rejects.toThrow("Failed to get risk insights summary: Bad Request (Status: 400)");
  });

  it("updateRiskInsightsSummary$ should call apiService.send with correct parameters and return an Observable", async () => {
    const data: EncryptedDataWithKey = {
      organizationId: orgId,
      contentEncryptionKey: new EncString(mockKey),
      encryptedReportData: new EncString(JSON.stringify(mockReportData)),
      encryptedSummaryData: new EncString(JSON.stringify(mockSummaryData)),
      encryptedApplicationData: new EncString(JSON.stringify(mockApplicationData)),
    };

    const reportId = "report123" as OrganizationReportId;

    mockApiService.send.mockResolvedValueOnce(undefined);

    const result = await firstValueFrom(
      service.updateRiskInsightsSummary$(reportId, orgId, {
        data: {
          summaryData: data.encryptedSummaryData.encryptedString!,
          metrics: mockMetrics.toRiskInsightsMetricsData(),
        },
      }),
    );

    expect(mockApiService.send).toHaveBeenCalledWith(
      "PATCH",
      `/reports/organizations/${orgId.toString()}/data/summary/${reportId.toString()}`,
      {
        summaryData: data.encryptedSummaryData.encryptedString!,
        metrics: mockMetrics.toRiskInsightsMetricsData(),
        reportId,
        organizationId: orgId,
      },
      true,
      true,
    );
    expect(result).toBeUndefined();
  });

  it("updateRiskInsightsSummary$ should enrich errors from apiService.send", async () => {
    const reportId = "report123" as OrganizationReportId;
    const error = new ErrorResponse({ message: "Forbidden" }, 403);
    mockApiService.send.mockReturnValue(Promise.reject(error));

    await expect(
      firstValueFrom(
        service.updateRiskInsightsSummary$(reportId, orgId, {
          data: {
            summaryData: "encrypted-data",
            metrics: mockMetrics.toRiskInsightsMetricsData(),
          },
        }),
      ),
    ).rejects.toThrow("Failed to update risk insights summary: Forbidden (Status: 403)");
  });

  it("getRiskInsightsApplicationData$ should call apiService.send with correct parameters and return an Observable", async () => {
    const reportId = "report123" as OrganizationReportId;
    const mockResponse: EncryptedDataWithKey | null = {
      organizationId: orgId,
      encryptedReportData: new EncString(JSON.stringify(mockReportData)),
      encryptedSummaryData: new EncString(JSON.stringify(mockSummaryData)),
      encryptedApplicationData: new EncString(JSON.stringify(mockApplicationData)),
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

  it("getRiskInsightsApplicationData$ should enrich errors from apiService.send", async () => {
    const reportId = "report123" as OrganizationReportId;
    const error = new ErrorResponse({ message: "Not Found" }, 404);
    mockApiService.send.mockReturnValue(Promise.reject(error));

    await expect(
      firstValueFrom(service.getRiskInsightsApplicationData$(orgId, reportId)),
    ).rejects.toThrow("Failed to get risk insights application data: Not Found (Status: 404)");
  });

  it("updateRiskInsightsApplicationData$ should call apiService.send with correct parameters and return an Observable", async () => {
    const reportId = "report123" as OrganizationReportId;
    // TODO Update to be encrypted test
    const mockApplication = makeEncString("application-data");

    mockApiService.send.mockResolvedValueOnce(undefined);
    const result = await firstValueFrom(
      service.updateRiskInsightsApplicationData$(reportId, orgId, {
        data: { applicationData: mockApplication.encryptedString! },
      }),
    );
    expect(mockApiService.send).toHaveBeenCalledWith(
      "PATCH",
      `/reports/organizations/${orgId.toString()}/data/application/${reportId.toString()}`,
      { applicationData: mockApplication.encryptedString!, id: reportId, organizationId: orgId },
      true,
      true,
    );
    expect(result).toBeTruthy();
  });

  it("updateRiskInsightsApplicationData$ should enrich errors from apiService.send", async () => {
    const reportId = "report123" as OrganizationReportId;
    const mockApplication = makeEncString("application-data");
    const error = new Error("Connection timeout");
    mockApiService.send.mockReturnValue(Promise.reject(error));

    await expect(
      firstValueFrom(
        service.updateRiskInsightsApplicationData$(reportId, orgId, {
          data: { applicationData: mockApplication.encryptedString! },
        }),
      ),
    ).rejects.toThrow("Failed to update risk insights application data: Connection timeout");
  });

  it("getOrganizationGroups$ should call apiService.send with correct parameters and return groups array", async () => {
    const mockGroups = {
      data: [
        { id: "group1", name: "Engineering" },
        { id: "group2", name: "Marketing" },
      ],
    };

    mockApiService.send.mockResolvedValueOnce(mockGroups);

    const result = await firstValueFrom(service.getOrganizationGroups$(orgId));

    expect(mockApiService.send).toHaveBeenCalledWith(
      "GET",
      `/organizations/${orgId.toString()}/groups`,
      null,
      true,
      true,
    );
    expect(result).toEqual([
      { id: "group1", name: "Engineering" },
      { id: "group2", name: "Marketing" },
    ]);
  });

  it("getOrganizationGroups$ should return empty array when response.data is not an array", async () => {
    const mockResponse: { data: null } = { data: null };

    mockApiService.send.mockResolvedValueOnce(mockResponse);

    const result = await firstValueFrom(service.getOrganizationGroups$(orgId));

    expect(result).toEqual([]);
  });

  it("getOrganizationGroups$ should return empty array when response has no data property", async () => {
    const mockResponse: Record<string, never> = {};

    mockApiService.send.mockResolvedValueOnce(mockResponse);

    const result = await firstValueFrom(service.getOrganizationGroups$(orgId));

    expect(result).toEqual([]);
  });

  it("getOrganizationGroups$ should enrich errors from apiService.send", async () => {
    const error = new ErrorResponse({ message: "Unauthorized" }, 401);
    mockApiService.send.mockReturnValue(Promise.reject(error));

    await expect(firstValueFrom(service.getOrganizationGroups$(orgId))).rejects.toThrow(
      "Failed to get organization groups: Unauthorized (Status: 401)",
    );
  });
});
