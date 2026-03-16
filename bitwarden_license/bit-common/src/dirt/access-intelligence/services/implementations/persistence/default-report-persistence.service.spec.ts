import { mock, MockProxy } from "jest-mock-extended";
import { firstValueFrom, of, throwError } from "rxjs";

import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { makeEncString } from "@bitwarden/common/spec";
import { OrganizationId, OrganizationReportId, UserId } from "@bitwarden/common/types/guid";
import { LogService } from "@bitwarden/logging";

import {
  AccessReport,
  AccessReportSettingsView,
  AccessReportView,
} from "../../../../access-intelligence/models";
import {
  GetRiskInsightsReportResponse,
  SaveRiskInsightsReportResponse,
} from "../../../../reports/risk-insights/models/api-models.types";
import { RiskInsightsApiService } from "../../../../reports/risk-insights/services/api/risk-insights-api.service";
import {
  createRiskInsights,
  createAccessReportMetrics,
  createRiskInsightsSummary,
} from "../../../../reports/risk-insights/testing/test-helpers";
import {
  AccessReportEncryptionService,
  DecryptedAccessReportData,
} from "../../abstractions/access-report-encryption.service";

import { DefaultReportPersistenceService } from "./default-report-persistence.service";

describe("DefaultReportPersistenceService", () => {
  let service: DefaultReportPersistenceService;
  let mockApiService: MockProxy<RiskInsightsApiService>;
  let mockEncryptionService: MockProxy<AccessReportEncryptionService>;
  let mockAccountService: MockProxy<AccountService>;
  let mockLogService: MockProxy<LogService>;

  const organizationId = "org-123" as OrganizationId;
  const reportId = "report-456" as OrganizationReportId;
  const userId = "user-789" as UserId;

  beforeEach(() => {
    mockApiService = mock<RiskInsightsApiService>();
    mockEncryptionService = mock<AccessReportEncryptionService>();
    mockAccountService = mock<AccountService>();
    mockLogService = mock<LogService>();

    const mockAccount = { id: userId } as Account;
    mockAccountService.activeAccount$ = of(mockAccount);

    service = new DefaultReportPersistenceService(
      mockApiService,
      mockEncryptionService,
      mockAccountService,
      mockLogService,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("saveReport", () => {
    it("should save report and return report ID", async () => {
      // Create view model using helper
      const view = createRiskInsights({
        organizationId,
        creationDate: new Date(),
      });

      // Mock RiskInsights.fromView() to return domain model with encrypted data
      const mockDomain = new AccessReport();
      mockDomain.organizationId = organizationId;
      mockDomain.reports = makeEncString("encrypted-reports");
      mockDomain.summary = makeEncString("encrypted-summary");
      mockDomain.applications = makeEncString("encrypted-applications");
      mockDomain.contentEncryptionKey = makeEncString("encryption-key");
      mockDomain.creationDate = new Date();

      jest.spyOn(AccessReport, "fromView").mockReturnValue(of(mockDomain));

      const saveResponse = new SaveRiskInsightsReportResponse({ id: reportId });
      mockApiService.saveRiskInsightsReport$.mockReturnValue(of(saveResponse));

      const result = await firstValueFrom(service.saveReport$(view, organizationId));

      expect(result.id).toBe(reportId);
      expect(result.contentEncryptionKey).toBeDefined();
      expect(AccessReport.fromView).toHaveBeenCalledWith(view, mockEncryptionService, {
        organizationId,
        userId,
      });
      expect(mockApiService.saveRiskInsightsReport$).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            organizationId,
            reportData: expect.any(String),
            summaryData: expect.any(String),
            applicationData: expect.any(String),
            contentEncryptionKey: expect.any(String),
          }),
        }),
        organizationId,
      );
      expect(mockLogService.debug).toHaveBeenCalledWith(
        "[DefaultReportPersistenceService] Saving report",
        { organizationId },
      );
    });

    it("should throw error if report has no encryption key", async () => {
      const view = createRiskInsights({ organizationId });

      // Mock domain model without encryption key
      const mockDomain = new AccessReport();
      mockDomain.organizationId = organizationId;
      mockDomain.contentEncryptionKey = undefined;

      jest.spyOn(AccessReport, "fromView").mockReturnValue(of(mockDomain));

      await expect(firstValueFrom(service.saveReport$(view, organizationId))).rejects.toThrow(
        "Report encryption key not found",
      );
    });

    it("should handle API errors gracefully", async () => {
      const view = createRiskInsights({
        organizationId,
        creationDate: new Date(),
      });

      const mockDomain = new AccessReport();
      mockDomain.organizationId = organizationId;
      mockDomain.contentEncryptionKey = makeEncString("key");
      mockDomain.reports = makeEncString("reports");
      mockDomain.summary = makeEncString("summary");
      mockDomain.applications = makeEncString("apps");
      mockDomain.creationDate = new Date();

      jest.spyOn(AccessReport, "fromView").mockReturnValue(of(mockDomain));

      mockApiService.saveRiskInsightsReport$.mockReturnValue(
        throwError(() => new Error("API error")),
      );

      await expect(firstValueFrom(service.saveReport$(view, organizationId))).rejects.toThrow(
        "API error",
      );
    });
  });

  describe("saveApplicationMetadata", () => {
    it("should save application metadata and summary", async () => {
      const app1 = new AccessReportSettingsView();
      app1.applicationName = "github.com";
      app1.isCritical = true;
      app1.reviewedDate = new Date();

      const app2 = new AccessReportSettingsView();
      app2.applicationName = "gitlab.com";
      app2.isCritical = false;
      app2.reviewedDate = undefined;

      const summary = createRiskInsightsSummary({
        totalApplicationCount: 2,
        totalAtRiskApplicationCount: 1,
        totalMemberCount: 10,
        totalAtRiskMemberCount: 3,
      });

      // Create full view model using helper
      const view = createRiskInsights({
        id: reportId,
        organizationId,
        applications: [app1, app2],
        summary,
      });

      // Mock toMetrics() to return proper RiskInsightsMetrics instance
      const mockMetrics = createAccessReportMetrics({
        totalApplicationCount: 2,
        totalAtRiskApplicationCount: 1,
        totalMemberCount: 10,
        totalAtRiskMemberCount: 3,
      });
      jest.spyOn(view, "toMetrics").mockReturnValue(mockMetrics);

      // Mock RiskInsights.fromView() to return domain model
      const mockDomain = new AccessReport();
      mockDomain.reports = makeEncString("encrypted-reports");
      mockDomain.summary = makeEncString("encrypted-summary");
      mockDomain.applications = makeEncString("encrypted-apps");
      mockDomain.contentEncryptionKey = makeEncString("key");

      jest.spyOn(AccessReport, "fromView").mockReturnValue(of(mockDomain));

      // Using {} as any for mock response (acceptable per testing standards for mock objects)
      mockApiService.updateRiskInsightsApplicationData$.mockReturnValue(of({} as any));
      mockApiService.updateRiskInsightsSummary$.mockReturnValue(of(undefined));

      await firstValueFrom(service.saveApplicationMetadata$(view));

      expect(AccessReport.fromView).toHaveBeenCalledWith(view, mockEncryptionService, {
        organizationId,
        userId,
      });

      expect(mockApiService.updateRiskInsightsApplicationData$).toHaveBeenCalledWith(
        reportId,
        organizationId,
        expect.objectContaining({
          data: {
            applicationData: expect.any(String),
          },
        }),
      );

      expect(mockApiService.updateRiskInsightsSummary$).toHaveBeenCalledWith(
        reportId,
        organizationId,
        expect.objectContaining({
          data: {
            summaryData: expect.any(String),
            metrics: expect.objectContaining({
              totalApplicationCount: 2,
              totalAtRiskApplicationCount: 1,
            }),
          },
        }),
      );

      expect(view.toMetrics).toHaveBeenCalled();
    });

    it("should throw error if user ID not found", async () => {
      mockAccountService.activeAccount$ = of(null as any);

      const view = createRiskInsights({
        id: reportId,
        organizationId,
      });

      await expect(firstValueFrom(service.saveApplicationMetadata$(view))).rejects.toThrow(
        "Null or undefined account",
      );
    });

    it("should handle encryption errors", async () => {
      const view = createRiskInsights({
        id: reportId,
        organizationId,
      });

      jest
        .spyOn(AccessReport, "fromView")
        .mockReturnValue(throwError(() => new Error("Encryption failed")));

      await expect(firstValueFrom(service.saveApplicationMetadata$(view))).rejects.toThrow(
        "Encryption failed",
      );
    });

    it("should handle API update failures", async () => {
      const view = createRiskInsights({
        id: reportId,
        organizationId,
      });

      const mockDomain = new AccessReport();
      mockDomain.reports = makeEncString("encrypted-reports");
      mockDomain.summary = makeEncString("encrypted-summary");
      mockDomain.applications = makeEncString("encrypted-apps");
      mockDomain.contentEncryptionKey = makeEncString("key");

      jest.spyOn(AccessReport, "fromView").mockReturnValue(of(mockDomain));

      mockApiService.updateRiskInsightsApplicationData$.mockReturnValue(
        throwError(() => new Error("Update failed")),
      );

      await expect(firstValueFrom(service.saveApplicationMetadata$(view))).rejects.toThrow(
        "Update failed",
      );
    });
  });

  describe("loadReport", () => {
    it("should load and decrypt report successfully", async () => {
      const apiResponse = new GetRiskInsightsReportResponse({
        id: reportId,
        organizationId,
        creationDate: new Date().toISOString(),
        reportData: "encrypted-reports",
        summaryData: "encrypted-summary",
        applicationData: "encrypted-apps",
        contentEncryptionKey: "encryption-key",
      });

      const decryptedData: DecryptedAccessReportData = {
        reportData: {
          reports: [
            {
              applicationName: "github.com",
              passwordCount: 2,
              atRiskPasswordCount: 1,
              memberCount: 1,
              atRiskMemberCount: 1,
              cipherRefs: { "cipher-1": true, "cipher-2": false },
              memberRefs: { "member-1": true },
            },
          ],
          memberRegistry: {
            "member-1": { id: "member-1", userName: "John Doe", email: "john@example.com" },
          },
        },
        summaryData: {
          totalMemberCount: 10,
          totalAtRiskMemberCount: 3,
          totalApplicationCount: 5,
          totalAtRiskApplicationCount: 2,
          totalCriticalMemberCount: 2,
          totalCriticalAtRiskMemberCount: 1,
          totalCriticalApplicationCount: 1,
          totalCriticalAtRiskApplicationCount: 1,
        },
        applicationData: [
          {
            applicationName: "github.com",
            isCritical: true,
            reviewedDate: "2024-01-15T10:30:00.000Z",
          },
        ],
      };

      mockApiService.getRiskInsightsReport$.mockReturnValue(of(apiResponse));
      mockEncryptionService.decryptReport$.mockReturnValue(of(decryptedData));

      const result = await firstValueFrom(service.loadReport$(organizationId));

      expect(result!.report).toBeInstanceOf(AccessReportView);
      expect(result!.report.id).toBe(reportId);
      expect(result!.report.organizationId).toBe(organizationId);
      expect(result!.report.reports).toHaveLength(1);
      expect(result!.report.applications).toHaveLength(1);
      expect(result!.report.summary.totalApplicationCount).toBe(5);

      expect(mockLogService.debug).toHaveBeenCalledWith(
        "[DefaultReportPersistenceService] Loading report",
        { organizationId },
      );
    });

    it("should return null if no report exists", async () => {
      mockApiService.getRiskInsightsReport$.mockReturnValue(of(null));

      const result = await firstValueFrom(service.loadReport$(organizationId));

      expect(result).toBeNull();
      expect(mockEncryptionService.decryptReport$).not.toHaveBeenCalled();
    });

    it("should throw error if encryption key missing", async () => {
      const apiResponse = new GetRiskInsightsReportResponse({
        id: reportId,
        organizationId,
        creationDate: new Date().toISOString(),
        reportData: "encrypted-reports",
        summaryData: "encrypted-summary",
        applicationData: "encrypted-apps",
        contentEncryptionKey: "",
      });

      mockApiService.getRiskInsightsReport$.mockReturnValue(of(apiResponse));

      await expect(firstValueFrom(service.loadReport$(organizationId))).rejects.toThrow(
        "Report encryption key not found",
      );
    });

    it("should throw error if user ID not found", async () => {
      mockAccountService.activeAccount$ = of(null as any);

      await expect(firstValueFrom(service.loadReport$(organizationId))).rejects.toThrow(
        "Null or undefined account",
      );
    });

    it("should handle decryption errors", async () => {
      const apiResponse = new GetRiskInsightsReportResponse({
        id: reportId,
        organizationId,
        creationDate: new Date().toISOString(),
        reportData: "encrypted-reports",
        summaryData: "encrypted-summary",
        applicationData: "encrypted-apps",
        contentEncryptionKey: "encryption-key",
      });

      mockApiService.getRiskInsightsReport$.mockReturnValue(of(apiResponse));
      mockEncryptionService.decryptReport$.mockReturnValue(
        throwError(() => new Error("Decryption failed")),
      );

      await expect(firstValueFrom(service.loadReport$(organizationId))).rejects.toThrow(
        "Decryption failed",
      );
    });

    it("should convert report data to view models correctly", async () => {
      const apiResponse = new GetRiskInsightsReportResponse({
        id: reportId,
        organizationId,
        creationDate: new Date().toISOString(),
        reportData: "encrypted-reports",
        summaryData: "encrypted-summary",
        applicationData: "encrypted-apps",
        contentEncryptionKey: "encryption-key",
      });

      const decryptedData: DecryptedAccessReportData = {
        reportData: {
          reports: [
            {
              applicationName: "gitlab.com",
              passwordCount: 3,
              atRiskPasswordCount: 1,
              memberCount: 2,
              atRiskMemberCount: 1,
              cipherRefs: { c1: false, c2: true, c3: false },
              memberRefs: { m1: true, m2: false },
            },
          ],
          memberRegistry: {
            m1: { id: "m1", userName: "Alice", email: "alice@example.com" },
            m2: { id: "m2", userName: "Bob", email: "bob@example.com" },
          },
        },
        summaryData: {
          totalMemberCount: 20,
          totalAtRiskMemberCount: 5,
          totalApplicationCount: 10,
          totalAtRiskApplicationCount: 3,
          totalCriticalMemberCount: 4,
          totalCriticalAtRiskMemberCount: 2,
          totalCriticalApplicationCount: 2,
          totalCriticalAtRiskApplicationCount: 1,
        },
        applicationData: [
          {
            applicationName: "gitlab.com",
            isCritical: false,
            reviewedDate: undefined,
          },
        ],
      };

      mockApiService.getRiskInsightsReport$.mockReturnValue(of(apiResponse));
      mockEncryptionService.decryptReport$.mockReturnValue(of(decryptedData));

      const result = await firstValueFrom(service.loadReport$(organizationId));

      expect(result!.report.reports[0].applicationName).toBe("gitlab.com");
      expect(result!.report.reports[0].passwordCount).toBe(3);
      expect(result!.report.reports[0].atRiskPasswordCount).toBe(1);
      expect(result!.report.reports[0].memberCount).toBe(2);
      expect(result!.report.reports[0].atRiskMemberCount).toBe(1);

      expect(result!.report.reports[0].cipherRefs["c1"]).toBe(false);
      expect(result!.report.reports[0].cipherRefs["c2"]).toBe(true);
      expect(result!.report.reports[0].cipherRefs["c3"]).toBe(false);

      expect(result!.report.reports[0].memberRefs["m1"]).toBe(true);
      expect(result!.report.reports[0].memberRefs["m2"]).toBe(false);

      expect(result!.report.applications[0].applicationName).toBe("gitlab.com");
      expect(result!.report.applications[0].isCritical).toBe(false);
      expect(result!.report.applications[0].reviewedDate).toBeUndefined();

      expect(result!.report.summary.totalMemberCount).toBe(20);
      expect(result!.report.summary.totalAtRiskMemberCount).toBe(5);
    });
  });
});
