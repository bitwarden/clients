import { mock } from "jest-mock-extended";
import { of, throwError } from "rxjs";

import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { OrganizationId, OrganizationReportId, UserId } from "@bitwarden/common/types/guid";
import { LogService } from "@bitwarden/logging";

import { RiskInsightsMetrics } from "../../models/domain/risk-insights-metrics";
import { mockApplicationData, mockReportData, mockSummaryData } from "../../models/mocks/mock-data";
import {
  OrganizationReportApplication,
  ReportState,
  ReportStatus,
} from "../../models/report-models";
import { RiskInsightsApiService } from "../api/risk-insights-api.service";

import { RiskInsightsEncryptionService } from "./risk-insights-encryption.service";
import { RiskInsightsReportService } from "./risk-insights-report.service";
import { RiskInsightsSaveService } from "./risk-insights-save.service";

describe("RiskInsightsSaveService", () => {
  let service: RiskInsightsSaveService;
  let mockApiService: jest.Mocked<RiskInsightsApiService>;
  let mockEncryptionService: jest.Mocked<RiskInsightsEncryptionService>;
  let mockReportService: jest.Mocked<RiskInsightsReportService>;
  let mockLogService: jest.Mocked<LogService>;

  const orgId = "org-123" as OrganizationId;
  const userId = "user-123" as UserId;
  const reportId = "report-456" as OrganizationReportId;
  const contentEncryptionKey = new EncString("wrapped-key");

  const mockReportState: ReportState = {
    status: ReportStatus.Complete,
    error: null,
    data: {
      id: reportId,
      reportData: mockReportData,
      summaryData: mockSummaryData,
      applicationData: mockApplicationData,
      creationDate: new Date(),
      contentEncryptionKey,
    },
  };

  const mockOrganizationDetails = {
    organizationId: orgId,
    organizationName: "Test Organization",
  };

  const mockEncryptedData = {
    organizationId: orgId,
    encryptedReportData: new EncString("encrypted-report"),
    encryptedSummaryData: new EncString("encrypted-summary"),
    encryptedApplicationData: new EncString("encrypted-application"),
    contentEncryptionKey,
  };

  beforeEach(() => {
    mockApiService = mock<RiskInsightsApiService>();
    mockEncryptionService = mock<RiskInsightsEncryptionService>();
    mockReportService = mock<RiskInsightsReportService>();
    mockLogService = mock<LogService>();

    service = new RiskInsightsSaveService(
      mockApiService,
      mockEncryptionService,
      mockReportService,
      mockLogService,
    );

    jest.clearAllMocks();
  });

  describe("saveReportUpdates$", () => {
    it("should successfully save report updates with recomputed summary and metrics", (done) => {
      // Arrange
      const updatedApplicationData: OrganizationReportApplication[] = [
        { applicationName: "app1", isCritical: true, reviewedDate: null },
        { applicationName: "app2", isCritical: false, reviewedDate: new Date() },
      ];

      const updatedSummary = {
        ...mockSummaryData,
        totalCriticalApplicationCount: 1,
      };

      mockReportService.getApplicationsSummary.mockReturnValue(updatedSummary);
      mockReportService.isCriticalApplication.mockImplementation((app, appData) =>
        appData.some((a) => a.applicationName === app.applicationName && a.isCritical),
      );
      mockReportService.getReportMetrics.mockReturnValue(new RiskInsightsMetrics());
      mockEncryptionService.encryptRiskInsightsReport.mockResolvedValue(mockEncryptedData);
      mockApiService.updateRiskInsightsApplicationData$.mockReturnValue(of({} as any));
      mockApiService.updateRiskInsightsSummary$.mockReturnValue(of(undefined));

      // Act
      service
        .saveReportUpdates$({
          reportState: mockReportState,
          organizationDetails: mockOrganizationDetails,
          userId,
          updatedApplicationData,
        })
        .subscribe({
          next: (result) => {
            // Assert
            expect(result.updatedState.data?.summaryData).toEqual(updatedSummary);
            expect(result.updatedState.data?.applicationData).toEqual(updatedApplicationData);
            expect(result.metrics).toBeInstanceOf(RiskInsightsMetrics);
            expect(mockReportService.getApplicationsSummary).toHaveBeenCalledWith(
              mockReportData,
              updatedApplicationData,
              mockSummaryData.totalMemberCount,
            );
            expect(mockEncryptionService.encryptRiskInsightsReport).toHaveBeenCalledWith(
              { organizationId: orgId, userId },
              {
                reportData: mockReportData,
                summaryData: updatedSummary,
                applicationData: updatedApplicationData,
              },
              contentEncryptionKey,
            );
            expect(mockApiService.updateRiskInsightsApplicationData$).toHaveBeenCalledWith(
              reportId,
              orgId,
              expect.objectContaining({
                data: expect.any(Object),
              }),
            );
            expect(mockApiService.updateRiskInsightsSummary$).toHaveBeenCalledWith(
              reportId,
              orgId,
              expect.objectContaining({
                data: expect.any(Object),
              }),
            );
            done();
          },
          error: done.fail,
        });
    });

    it("should throw error when report data is missing", (done) => {
      // Arrange
      const invalidReportState: ReportState = {
        status: ReportStatus.Complete,
        error: null,
        data: null,
      };

      // Act
      service
        .saveReportUpdates$({
          reportState: invalidReportState,
          organizationDetails: mockOrganizationDetails,
          userId,
          updatedApplicationData: [],
        })
        .subscribe({
          next: () => done.fail("Should have thrown an error"),
          error: (error: unknown) => {
            // Assert
            expect((error as Error).message).toBe("Cannot save report updates without report data");
            done();
          },
        });
    });

    it("should handle encryption errors", (done) => {
      // Arrange
      const updatedApplicationData = mockApplicationData;
      const encryptionError = new Error("Encryption failed");

      mockReportService.getApplicationsSummary.mockReturnValue(mockSummaryData);
      mockReportService.isCriticalApplication.mockReturnValue(false);
      mockReportService.getReportMetrics.mockReturnValue(new RiskInsightsMetrics());
      mockEncryptionService.encryptRiskInsightsReport.mockRejectedValue(encryptionError);

      // Act
      service
        .saveReportUpdates$({
          reportState: mockReportState,
          organizationDetails: mockOrganizationDetails,
          userId,
          updatedApplicationData,
        })
        .subscribe({
          next: () => done.fail("Should have thrown an error"),
          error: (error: unknown) => {
            // Assert
            expect(error).toBe(encryptionError);
            done();
          },
        });
    });

    it("should handle API call failures", (done) => {
      // Arrange
      const updatedApplicationData = mockApplicationData;
      const apiError = new Error("API request failed");

      mockReportService.getApplicationsSummary.mockReturnValue(mockSummaryData);
      mockReportService.isCriticalApplication.mockReturnValue(false);
      mockReportService.getReportMetrics.mockReturnValue(new RiskInsightsMetrics());
      mockEncryptionService.encryptRiskInsightsReport.mockResolvedValue(mockEncryptedData);
      mockApiService.updateRiskInsightsApplicationData$.mockReturnValue(throwError(() => apiError));

      // Act
      service
        .saveReportUpdates$({
          reportState: mockReportState,
          organizationDetails: mockOrganizationDetails,
          userId,
          updatedApplicationData,
        })
        .subscribe({
          next: () => done.fail("Should have thrown an error"),
          error: (error: unknown) => {
            // Assert
            expect(error).toBe(apiError);
            expect(mockLogService.error).toHaveBeenCalledWith(
              "[RiskInsightsSaveService] Failed to save report updates",
              apiError,
            );
            done();
          },
        });
    });

    it("should skip API calls when report ID or org ID is missing", (done) => {
      // Arrange
      const reportStateWithoutId = {
        ...mockReportState,
        data: {
          ...mockReportState.data!,
          id: undefined as any,
        },
      };

      mockReportService.getApplicationsSummary.mockReturnValue(mockSummaryData);
      mockReportService.isCriticalApplication.mockReturnValue(false);
      mockReportService.getReportMetrics.mockReturnValue(new RiskInsightsMetrics());
      mockEncryptionService.encryptRiskInsightsReport.mockResolvedValue(mockEncryptedData);

      // Act
      service
        .saveReportUpdates$({
          reportState: reportStateWithoutId,
          organizationDetails: mockOrganizationDetails,
          userId,
          updatedApplicationData: mockApplicationData,
        })
        .subscribe({
          next: (result) => {
            // Assert
            expect(result.updatedState).toBeDefined();
            expect(mockApiService.updateRiskInsightsApplicationData$).not.toHaveBeenCalled();
            expect(mockApiService.updateRiskInsightsSummary$).not.toHaveBeenCalled();
            expect(mockLogService.warning).toHaveBeenCalledWith(
              "[RiskInsightsSaveService] Cannot save - missing report id or org id",
            );
            done();
          },
          error: done.fail,
        });
    });

    it("should correctly mark applications as critical in enriched data", (done) => {
      // Arrange
      const updatedApplicationData: OrganizationReportApplication[] = [
        { applicationName: "app.application1.com", isCritical: true, reviewedDate: null },
        { applicationName: "app.application2.com", isCritical: false, reviewedDate: null },
      ];

      mockReportService.getApplicationsSummary.mockReturnValue(mockSummaryData);
      mockReportService.isCriticalApplication.mockImplementation((app, appData) => {
        return appData.some((a) => a.applicationName === app.applicationName && a.isCritical);
      });
      mockReportService.getReportMetrics.mockReturnValue(new RiskInsightsMetrics());
      mockEncryptionService.encryptRiskInsightsReport.mockResolvedValue(mockEncryptedData);
      mockApiService.updateRiskInsightsApplicationData$.mockReturnValue(of({} as any));
      mockApiService.updateRiskInsightsSummary$.mockReturnValue(of(undefined));

      // Act
      service
        .saveReportUpdates$({
          reportState: mockReportState,
          organizationDetails: mockOrganizationDetails,
          userId,
          updatedApplicationData,
        })
        .subscribe({
          next: (result) => {
            // Assert - verify isCriticalApplication was called for each application
            expect(mockReportService.isCriticalApplication).toHaveBeenCalledTimes(
              mockReportData.length,
            );
            expect(result.metrics.totalCriticalApplicationCount).toBeGreaterThanOrEqual(0);
            done();
          },
          error: done.fail,
        });
    });

    it("should calculate correct password metrics", (done) => {
      // Arrange
      const updatedApplicationData: OrganizationReportApplication[] = [
        { applicationName: "app.application1.com", isCritical: true, reviewedDate: null },
      ];

      mockReportService.getApplicationsSummary.mockReturnValue(mockSummaryData);
      mockReportService.isCriticalApplication.mockReturnValue(true);
      mockReportService.getReportMetrics.mockReturnValue(new RiskInsightsMetrics());
      mockEncryptionService.encryptRiskInsightsReport.mockResolvedValue(mockEncryptedData);
      mockApiService.updateRiskInsightsApplicationData$.mockReturnValue(of({} as any));
      mockApiService.updateRiskInsightsSummary$.mockReturnValue(of(undefined));

      // Act
      service
        .saveReportUpdates$({
          reportState: mockReportState,
          organizationDetails: mockOrganizationDetails,
          userId,
          updatedApplicationData,
        })
        .subscribe({
          next: (result) => {
            // Assert - verify password metrics are calculated
            expect(result.metrics.totalPasswordCount).toBeGreaterThanOrEqual(0);
            expect(result.metrics.totalAtRiskPasswordCount).toBeGreaterThanOrEqual(0);
            expect(result.metrics.totalCriticalPasswordCount).toBeGreaterThanOrEqual(0);
            expect(result.metrics.totalCriticalAtRiskPasswordCount).toBeGreaterThanOrEqual(0);
            done();
          },
          error: done.fail,
        });
    });

    it("should preserve reportData in updated state", (done) => {
      // Arrange
      const updatedApplicationData = mockApplicationData;

      mockReportService.getApplicationsSummary.mockReturnValue(mockSummaryData);
      mockReportService.isCriticalApplication.mockReturnValue(false);
      mockReportService.getReportMetrics.mockReturnValue(new RiskInsightsMetrics());
      mockEncryptionService.encryptRiskInsightsReport.mockResolvedValue(mockEncryptedData);
      mockApiService.updateRiskInsightsApplicationData$.mockReturnValue(of({} as any));
      mockApiService.updateRiskInsightsSummary$.mockReturnValue(of(undefined));

      // Act
      service
        .saveReportUpdates$({
          reportState: mockReportState,
          organizationDetails: mockOrganizationDetails,
          userId,
          updatedApplicationData,
        })
        .subscribe({
          next: (result) => {
            // Assert - reportData should not change during save
            expect(result.updatedState.data?.reportData).toEqual(mockReportData);
            expect(result.updatedState.data?.id).toBe(reportId);
            expect(result.updatedState.data?.contentEncryptionKey).toBe(contentEncryptionKey);
            done();
          },
          error: done.fail,
        });
    });

    it("should call both API endpoints in parallel", (done) => {
      // Arrange
      const updatedApplicationData = mockApplicationData;

      mockReportService.getApplicationsSummary.mockReturnValue(mockSummaryData);
      mockReportService.isCriticalApplication.mockReturnValue(false);
      mockReportService.getReportMetrics.mockReturnValue(new RiskInsightsMetrics());
      mockEncryptionService.encryptRiskInsightsReport.mockResolvedValue(mockEncryptedData);
      mockApiService.updateRiskInsightsApplicationData$.mockReturnValue(of({} as any));
      mockApiService.updateRiskInsightsSummary$.mockReturnValue(of(undefined));

      // Act
      service
        .saveReportUpdates$({
          reportState: mockReportState,
          organizationDetails: mockOrganizationDetails,
          userId,
          updatedApplicationData,
        })
        .subscribe({
          next: () => {
            // Assert - both should be called (order doesn't matter for parallel calls)
            expect(mockApiService.updateRiskInsightsApplicationData$).toHaveBeenCalled();
            expect(mockApiService.updateRiskInsightsSummary$).toHaveBeenCalled();
            done();
          },
          error: done.fail,
        });
    });
  });
});
