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
    const error = { statusCode: 500, message: "Internal Server Error" };
    mockApiService.send.mockReturnValue(Promise.reject(error));

    await expect(
      firstValueFrom(service.saveRiskInsightsReport$(mockSaveRiskInsightsReportRequest, orgId)),
    ).rejects.toEqual(error);

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
    ).rejects.toEqual(error);

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

  describe("getRiskOverTime$", () => {
    it("should call apiService.send with correct parameters and return the response", async () => {
      const mockResponse = {
        timeframe: "past_month",
        dataView: "applications",
        dataPoints: [
          { timestamp: "2026-01-11T00:00:00Z", atRisk: 45, total: 150 },
          { timestamp: "2026-01-18T00:00:00Z", atRisk: 52, total: 152 },
          { timestamp: "2026-01-25T00:00:00Z", atRisk: 48, total: 155 },
          { timestamp: "2026-02-01T00:00:00Z", atRisk: 50, total: 158 },
          { timestamp: "2026-02-08T00:00:00Z", atRisk: 46, total: 160 },
          { timestamp: "2026-02-15T00:00:00Z", atRisk: 42, total: 162 },
        ],
      };

      mockApiService.send.mockResolvedValueOnce(mockResponse);

      const result = await firstValueFrom(service.getRiskOverTime$(orgId, "month", "applications"));

      expect(mockApiService.send).toHaveBeenCalledWith(
        "GET",
        `/reports/organizations/${orgId.toString()}/data/risk-over-time?timeframe=month&dataView=applications`,
        null,
        true,
        true,
      );
      expect(result).toBeTruthy();
      expect(result!.timeframe).toBe("past_month");
      expect(result!.dataView).toBe("applications");
      expect(result!.dataPoints).toHaveLength(6);
      expect(result!.dataPoints[0].atRisk).toBe(45);
      expect(result!.dataPoints[0].total).toBe(150);
      expect(result!.dataPoints[0].timestamp).toBe("2026-01-11T00:00:00Z");
    });

    it("should return null when server responds with 404", async () => {
      const mockError = new ErrorResponse(null, 404);
      mockApiService.send.mockReturnValue(Promise.reject(mockError));

      const result = await firstValueFrom(service.getRiskOverTime$(orgId, "month", "applications"));

      expect(result).toBeNull();
    });

    it("should propagate non-404 errors", async () => {
      const error = { statusCode: 500, message: "Server error" };
      mockApiService.send.mockReturnValue(Promise.reject(error));

      await expect(
        firstValueFrom(service.getRiskOverTime$(orgId, "3mo", "members")),
      ).rejects.toEqual(error);
    });

    it("should handle null response", async () => {
      mockApiService.send.mockResolvedValueOnce(null);

      const result = await firstValueFrom(service.getRiskOverTime$(orgId, "12mo", "passwords"));

      expect(result).toBeNull();
    });
  });
});
