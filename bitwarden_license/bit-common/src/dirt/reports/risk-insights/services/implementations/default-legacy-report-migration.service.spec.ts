import { mock, MockProxy } from "jest-mock-extended";
import { firstValueFrom, of } from "rxjs";

import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import {
  CipherId,
  OrganizationId,
  OrganizationReportId,
  UserId,
} from "@bitwarden/common/types/guid";
import { LogService } from "@bitwarden/logging";

import { GetRiskInsightsReportResponse } from "../../models/api-models.types";
import {
  ApplicationHealthReportDetail,
  MemberDetails,
  OrganizationReportApplication,
  OrganizationReportSummary,
} from "../../models/report-models";
import { RiskInsightsApiService } from "../api/risk-insights-api.service";
import { RiskInsightsEncryptionService } from "../domain/risk-insights-encryption.service";

import { DefaultLegacyReportMigrationService } from "./default-legacy-report-migration.service";

describe("DefaultLegacyReportMigrationService", () => {
  let service: DefaultLegacyReportMigrationService;
  let mockApiService: MockProxy<RiskInsightsApiService>;
  let mockEncryptionService: MockProxy<RiskInsightsEncryptionService>;
  let mockAccountService: MockProxy<AccountService>;
  let mockLogService: MockProxy<LogService>;

  const organizationId = "org-123" as OrganizationId;
  const reportId = "report-456" as OrganizationReportId;
  const userId = "user-789" as UserId;

  beforeEach(() => {
    mockApiService = mock<RiskInsightsApiService>();
    mockEncryptionService = mock<RiskInsightsEncryptionService>();
    mockAccountService = mock<AccountService>();
    mockLogService = mock<LogService>();

    const mockAccount = { id: userId } as Account;
    mockAccountService.activeAccount$ = of(mockAccount);

    service = new DefaultLegacyReportMigrationService(
      mockApiService,
      mockEncryptionService,
      mockAccountService,
      mockLogService,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("migrateV1Report$", () => {
    it("should return null when no V1 report exists", async () => {
      mockApiService.getRiskInsightsReport$.mockReturnValue(of(null));

      const result = await firstValueFrom(service.migrateV1Report$(organizationId));

      expect(result).toBeNull();
      expect(mockEncryptionService.decryptRiskInsightsReport).not.toHaveBeenCalled();
    });

    it("should successfully migrate V1 report to V2", async () => {
      // Arrange: Create V1 data structures
      const member1: MemberDetails = {
        userGuid: "member-1",
        userName: "John Doe",
        email: "john@example.com",
        cipherId: "cipher-1" as CipherId,
      };
      const member2: MemberDetails = {
        userGuid: "member-2",
        userName: "Jane Smith",
        email: "jane@example.com",
        cipherId: "cipher-2" as CipherId,
      };

      const v1ReportData: ApplicationHealthReportDetail[] = [
        {
          applicationName: "github.com",
          passwordCount: 5,
          atRiskPasswordCount: 2,
          memberCount: 2,
          atRiskMemberCount: 1,
          memberDetails: [member1, member2],
          atRiskMemberDetails: [member1],
          cipherIds: ["cipher-1" as CipherId, "cipher-2" as CipherId],
          atRiskCipherIds: ["cipher-1" as CipherId],
        },
      ];

      const v1SummaryData: OrganizationReportSummary = {
        totalMemberCount: 2,
        totalApplicationCount: 1,
        totalAtRiskMemberCount: 1,
        totalAtRiskApplicationCount: 1,
        totalCriticalApplicationCount: 0,
        totalCriticalMemberCount: 0,
        totalCriticalAtRiskMemberCount: 0,
        totalCriticalAtRiskApplicationCount: 0,
      };

      const v1ApplicationData: OrganizationReportApplication[] = [
        {
          applicationName: "github.com",
          isCritical: false,
          reviewedDate: null,
        },
      ];

      const apiResponse = new GetRiskInsightsReportResponse({
        id: reportId,
        organizationId,
        creationDate: new Date("2024-01-01").toISOString(),
        reportData: "encrypted-reports",
        summaryData: "encrypted-summary",
        applicationData: "encrypted-applications",
        contentEncryptionKey: "encryption-key",
      });

      mockApiService.getRiskInsightsReport$.mockReturnValue(of(apiResponse));
      mockEncryptionService.decryptRiskInsightsReport.mockResolvedValue({
        reportData: v1ReportData,
        summaryData: v1SummaryData,
        applicationData: v1ApplicationData,
      });

      // Act
      const result = await firstValueFrom(service.migrateV1Report$(organizationId));

      // Assert
      expect(result).toBeDefined();
      expect(result?.id).toBe(reportId);
      expect(result?.organizationId).toBe(organizationId);

      // Verify member registry is built correctly (deduplicated)
      expect(Object.keys(result!.memberRegistry).length).toBe(2);
      expect(result!.memberRegistry["member-1"]).toEqual({
        id: "member-1",
        userName: "John Doe",
        email: "john@example.com",
      });
      expect(result!.memberRegistry["member-2"]).toEqual({
        id: "member-2",
        userName: "Jane Smith",
        email: "jane@example.com",
      });

      // Verify reports are transformed correctly
      expect(result!.reports.length).toBe(1);
      const transformedReport = result!.reports[0];
      expect(transformedReport.applicationName).toBe("github.com");
      expect(transformedReport.passwordCount).toBe(5);
      expect(transformedReport.atRiskPasswordCount).toBe(2);

      // Verify memberRefs conversion (Record<memberId, isAtRisk>)
      expect(transformedReport.memberRefs["member-1"]).toBe(true); // at-risk
      expect(transformedReport.memberRefs["member-2"]).toBe(false); // not at-risk

      // Verify cipherRefs conversion
      expect(transformedReport.cipherRefs["cipher-1"]).toBe(true); // at-risk
      expect(transformedReport.cipherRefs["cipher-2"]).toBe(false); // not at-risk

      // Verify applications metadata
      expect(result!.applications.length).toBe(1);
      expect(result!.applications[0].applicationName).toBe("github.com");
      expect(result!.applications[0].isCritical).toBe(false);

      // Verify summary is copied correctly
      expect(result!.summary.totalMemberCount).toBe(2);
      expect(result!.summary.totalApplicationCount).toBe(1);
      expect(result!.summary.totalAtRiskMemberCount).toBe(1);
    });

    it("should build member registry from multiple applications (deduplication)", async () => {
      // Arrange: Multiple apps with same members (should deduplicate)
      const sharedMember: MemberDetails = {
        userGuid: "member-shared",
        userName: "Shared User",
        email: "shared@example.com",
        cipherId: "cipher-1" as CipherId,
      };

      const v1ReportData: ApplicationHealthReportDetail[] = [
        {
          applicationName: "github.com",
          passwordCount: 2,
          atRiskPasswordCount: 1,
          memberCount: 1,
          atRiskMemberCount: 0,
          memberDetails: [sharedMember],
          atRiskMemberDetails: [],
          cipherIds: ["cipher-1" as CipherId],
          atRiskCipherIds: [],
        },
        {
          applicationName: "gitlab.com",
          passwordCount: 3,
          atRiskPasswordCount: 0,
          memberCount: 1,
          atRiskMemberCount: 0,
          memberDetails: [sharedMember], // Same member in different app
          atRiskMemberDetails: [],
          cipherIds: ["cipher-2" as CipherId],
          atRiskCipherIds: [],
        },
      ];

      const apiResponse = new GetRiskInsightsReportResponse({
        id: reportId,
        organizationId,
        creationDate: new Date(),
        reportData: "encrypted-reports",
        summaryData: "encrypted-summary",
        applicationData: "encrypted-applications",
        contentEncryptionKey: "encryption-key",
      });

      mockApiService.getRiskInsightsReport$.mockReturnValue(of(apiResponse));
      mockEncryptionService.decryptRiskInsightsReport.mockResolvedValue({
        reportData: v1ReportData,
        summaryData: {} as OrganizationReportSummary,
        applicationData: [],
      });

      // Act
      const result = await firstValueFrom(service.migrateV1Report$(organizationId));

      // Assert: Member should only appear once in registry
      expect(Object.keys(result!.memberRegistry).length).toBe(1);
      expect(result!.memberRegistry["member-shared"]).toEqual({
        id: "member-shared",
        userName: "Shared User",
        email: "shared@example.com",
      });
    });

    it("should preserve critical flags and review dates from V1 applicationData", async () => {
      // Arrange
      const v1ApplicationData: OrganizationReportApplication[] = [
        {
          applicationName: "github.com",
          isCritical: true,
          reviewedDate: new Date("2024-01-15"),
        },
      ];

      const apiResponse = new GetRiskInsightsReportResponse({
        id: reportId,
        organizationId,
        creationDate: new Date(),
        reportData: "encrypted-reports",
        summaryData: "encrypted-summary",
        applicationData: "encrypted-applications",
        contentEncryptionKey: "encryption-key",
      });

      mockApiService.getRiskInsightsReport$.mockReturnValue(of(apiResponse));
      mockEncryptionService.decryptRiskInsightsReport.mockResolvedValue({
        reportData: [
          {
            applicationName: "github.com",
            passwordCount: 1,
            atRiskPasswordCount: 0,
            memberCount: 0,
            atRiskMemberCount: 0,
            memberDetails: [],
            atRiskMemberDetails: [],
            cipherIds: [],
            atRiskCipherIds: [],
          },
        ],
        summaryData: {} as OrganizationReportSummary,
        applicationData: v1ApplicationData,
      });

      // Act
      const result = await firstValueFrom(service.migrateV1Report$(organizationId));

      // Assert
      expect(result!.applications[0].isCritical).toBe(true);
      expect(result!.applications[0].reviewedDate).toEqual(new Date("2024-01-15"));
    });

    it("should return null when decryption fails", async () => {
      // Arrange
      const apiResponse = new GetRiskInsightsReportResponse({
        id: reportId,
        organizationId,
        creationDate: new Date(),
        reportData: "encrypted-reports",
        summaryData: "encrypted-summary",
        applicationData: "encrypted-applications",
        contentEncryptionKey: "encryption-key",
      });

      mockApiService.getRiskInsightsReport$.mockReturnValue(of(apiResponse));
      mockEncryptionService.decryptRiskInsightsReport.mockRejectedValue(
        new Error("Decryption failed"),
      );

      // Act
      const result = await firstValueFrom(service.migrateV1Report$(organizationId));

      // Assert
      expect(result).toBeNull();
      expect(mockLogService.error).toHaveBeenCalledWith(
        "[LegacyReportMigration] Failed to migrate V1 report",
        expect.any(Error),
      );
    });

    it("should throw error when user ID is not found", async () => {
      // Arrange: No active account
      mockAccountService.activeAccount$ = of(null);

      // Act & Assert
      await expect(firstValueFrom(service.migrateV1Report$(organizationId))).rejects.toThrow(
        "Active account ID not found",
      );
    });

    it("should handle empty member arrays gracefully", async () => {
      // Arrange: Application with no members
      const v1ReportData: ApplicationHealthReportDetail[] = [
        {
          applicationName: "empty-app.com",
          passwordCount: 0,
          atRiskPasswordCount: 0,
          memberCount: 0,
          atRiskMemberCount: 0,
          memberDetails: [],
          atRiskMemberDetails: [],
          cipherIds: [],
          atRiskCipherIds: [],
        },
      ];

      const apiResponse = new GetRiskInsightsReportResponse({
        id: reportId,
        organizationId,
        creationDate: new Date(),
        reportData: "encrypted-reports",
        summaryData: "encrypted-summary",
        applicationData: "encrypted-applications",
        contentEncryptionKey: "encryption-key",
      });

      mockApiService.getRiskInsightsReport$.mockReturnValue(of(apiResponse));
      mockEncryptionService.decryptRiskInsightsReport.mockResolvedValue({
        reportData: v1ReportData,
        summaryData: {} as OrganizationReportSummary,
        applicationData: [],
      });

      // Act
      const result = await firstValueFrom(service.migrateV1Report$(organizationId));

      // Assert
      expect(result).toBeDefined();
      expect(Object.keys(result!.memberRegistry).length).toBe(0);
      expect(result!.reports[0].memberRefs).toEqual({});
      expect(result!.reports[0].cipherRefs).toEqual({});
    });

    it("should handle member with null userName", async () => {
      // Arrange: Member with null userName
      const memberWithNullName: MemberDetails = {
        userGuid: "member-1",
        userName: null,
        email: "user@example.com",
        cipherId: "cipher-1" as CipherId,
      };

      const v1ReportData: ApplicationHealthReportDetail[] = [
        {
          applicationName: "app.com",
          passwordCount: 1,
          atRiskPasswordCount: 0,
          memberCount: 1,
          atRiskMemberCount: 0,
          memberDetails: [memberWithNullName],
          atRiskMemberDetails: [],
          cipherIds: ["cipher-1" as CipherId],
          atRiskCipherIds: [],
        },
      ];

      const apiResponse = new GetRiskInsightsReportResponse({
        id: reportId,
        organizationId,
        creationDate: new Date(),
        reportData: "encrypted-reports",
        summaryData: "encrypted-summary",
        applicationData: "encrypted-applications",
        contentEncryptionKey: "encryption-key",
      });

      mockApiService.getRiskInsightsReport$.mockReturnValue(of(apiResponse));
      mockEncryptionService.decryptRiskInsightsReport.mockResolvedValue({
        reportData: v1ReportData,
        summaryData: {} as OrganizationReportSummary,
        applicationData: [],
      });

      // Act
      const result = await firstValueFrom(service.migrateV1Report$(organizationId));

      // Assert: null userName should be converted to empty string
      expect(result!.memberRegistry["member-1"].userName).toBe("");
    });
  });
});
