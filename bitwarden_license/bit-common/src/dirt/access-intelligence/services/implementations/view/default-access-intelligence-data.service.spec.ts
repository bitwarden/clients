import { firstValueFrom, of, skip, throwError } from "rxjs";

import {
  OrganizationUserApiService,
  OrganizationUserUserDetailsResponse,
} from "@bitwarden/admin-console/common";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { OrganizationId, OrganizationReportId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { LogService } from "@bitwarden/logging";

import { ReportProgress } from "../../../../reports/risk-insights/models/report-models";
import {
  createCipher,
  createRiskInsights,
  createReport,
} from "../../../../reports/risk-insights/testing/test-helpers";
import { ReportGenerationService } from "../../abstractions/report-generation.service";
import { ReportPersistenceService } from "../../abstractions/report-persistence.service";

import { DefaultAccessIntelligenceDataService } from "./default-access-intelligence-data.service";

describe("DefaultAccessIntelligenceDataService", () => {
  let service: DefaultAccessIntelligenceDataService;
  let cipherService: jest.Mocked<CipherService>;
  let organizationUserApiService: jest.Mocked<OrganizationUserApiService>;
  let reportGenerationService: jest.Mocked<ReportGenerationService>;
  let reportPersistenceService: jest.Mocked<ReportPersistenceService>;
  let logService: jest.Mocked<LogService>;

  const orgId = "org-123" as OrganizationId;
  const testReport = createRiskInsights({
    reports: [createReport("test-app.com")],
  });
  const testCiphers = [createCipher(), createCipher()];

  beforeEach(() => {
    // Create mocks
    cipherService = {
      getAllFromApiForOrganization: jest.fn(),
    } as any;

    organizationUserApiService = {
      getAllUsers: jest.fn(),
    } as any;

    reportGenerationService = {
      generateReport: jest.fn(),
    } as any;

    reportPersistenceService = {
      loadReport$: jest.fn(),
      saveReport$: jest.fn(),
      saveApplicationMetadata$: jest.fn(),
    } as any;

    logService = {
      debug: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
    } as any;

    service = new DefaultAccessIntelligenceDataService(
      cipherService,
      organizationUserApiService,
      reportGenerationService,
      reportPersistenceService,
      logService,
    );
  });

  describe("Initialization", () => {
    it("should load existing report and emit via report$", async () => {
      reportPersistenceService.loadReport$.mockReturnValue(
        of({ report: testReport, hadLegacyBlobs: false }),
      );

      await firstValueFrom(service.initializeForOrganization$(orgId));

      const report = await firstValueFrom(service.report$);
      expect(report).toBe(testReport);
      expect(reportPersistenceService.loadReport$).toHaveBeenCalledWith(orgId);
    });

    it("should emit null if no report exists", async () => {
      reportPersistenceService.loadReport$.mockReturnValue(of(null));

      await firstValueFrom(service.initializeForOrganization$(orgId));

      const report = await firstValueFrom(service.report$);
      expect(report).toBeNull();
    });

    it("should re-save report when V1 blobs are detected", async () => {
      const legacyReport = createRiskInsights({
        reports: [createReport("v1-app.com")],
      });

      const newId = "report-id-123" as OrganizationReportId;
      const newKey = new EncString("new-key");
      reportPersistenceService.loadReport$.mockReturnValue(
        of({ report: legacyReport, hadLegacyBlobs: true }),
      );
      reportPersistenceService.saveReport$.mockReturnValue(
        of({ id: newId, contentEncryptionKey: newKey }),
      );

      await firstValueFrom(service.initializeForOrganization$(orgId));

      expect(reportPersistenceService.saveReport$).toHaveBeenCalledWith(legacyReport, orgId);
      const report = await firstValueFrom(service.report$);
      expect(report).toBe(legacyReport);
      expect(report?.id).toBe(newId);
    });

    it("should handle load errors gracefully", async () => {
      reportPersistenceService.loadReport$.mockReturnValue(
        throwError(() => new Error("Load failed")),
      );

      await firstValueFrom(service.initializeForOrganization$(orgId));

      const error = await firstValueFrom(service.error$);
      expect(error).toBe("Failed to initialize");

      const report = await firstValueFrom(service.report$);
      expect(report).toBeNull();
    });
  });

  describe("Report Generation", () => {
    beforeEach(() => {
      cipherService.getAllFromApiForOrganization.mockResolvedValue(testCiphers);
      organizationUserApiService.getAllUsers.mockResolvedValue({
        data: [
          {
            id: "user-1",
            name: "Alice",
            email: "alice@example.com",
            collections: [{ id: "col-1", readOnly: false, hidePasswords: false, manage: true }],
            groups: ["group-1"],
          } as OrganizationUserUserDetailsResponse,
        ],
      } as any);
      reportGenerationService.generateReport.mockReturnValue(of(testReport));
      reportPersistenceService.loadReport$.mockReturnValue(of(null));
      reportPersistenceService.saveReport$.mockReturnValue(
        of({
          id: "report-id-123" as OrganizationReportId,
          contentEncryptionKey: new EncString(""),
        }),
      );
    });

    it("should load data, generate, save, and emit report", async () => {
      await firstValueFrom(service.generateNewReport$(orgId));

      const report = await firstValueFrom(service.report$);
      expect(report).toBe(testReport);
      expect(report?.id).toBe("report-id-123" as OrganizationReportId);
      expect(report?.organizationId).toBe(orgId);

      expect(cipherService.getAllFromApiForOrganization).toHaveBeenCalledWith(orgId);
      expect(organizationUserApiService.getAllUsers).toHaveBeenCalledWith(orgId, {
        includeCollections: true,
        includeGroups: true,
      });
      expect(reportGenerationService.generateReport).toHaveBeenCalled();
      expect(reportPersistenceService.saveReport$).toHaveBeenCalledWith(testReport, orgId);
    });

    it("should carry over previous application metadata", async () => {
      const previousReport = createRiskInsights({
        applications: [
          { applicationName: "github.com", isCritical: true, reviewedDate: new Date() } as any,
        ],
      });

      // Prime in-memory report state via initialize so generateNewReport$ can read it
      reportPersistenceService.loadReport$.mockReturnValue(
        of({ report: previousReport, hadLegacyBlobs: false }),
      );
      await firstValueFrom(service.initializeForOrganization$(orgId));

      await firstValueFrom(service.generateNewReport$(orgId));

      expect(reportGenerationService.generateReport).toHaveBeenCalledWith(
        testCiphers,
        expect.anything(),
        expect.anything(),
        expect.anything(),
        previousReport.applications,
      );
    });

    it("should store ciphers for UI", async () => {
      await firstValueFrom(service.generateNewReport$(orgId));

      const ciphers = await firstValueFrom(service.ciphers$);
      expect(ciphers).toEqual(testCiphers);
    });

    it("should handle generation errors and keep previous report", async () => {
      reportPersistenceService.loadReport$.mockReturnValue(
        of({ report: testReport, hadLegacyBlobs: false }),
      );
      await firstValueFrom(service.initializeForOrganization$(orgId));

      reportGenerationService.generateReport.mockReturnValue(
        throwError(() => new Error("Generation failed")),
      );

      await expect(firstValueFrom(service.generateNewReport$(orgId))).rejects.toThrow(
        "Generation failed",
      );

      const report = await firstValueFrom(service.report$);
      expect(report).toBe(testReport); // Previous report still present
    });

    it("should handle save errors and keep generated report", async () => {
      reportPersistenceService.saveReport$.mockReturnValue(
        throwError(() => new Error("Save failed")),
      );

      await expect(firstValueFrom(service.generateNewReport$(orgId))).rejects.toThrow(
        "Save failed",
      );

      const error = await firstValueFrom(service.error$);
      expect(error).toBe("Failed to generate report");
    });

    it("should emit full progress sequence", async () => {
      const progressSteps: (ReportProgress | null)[] = [];
      const sub = service.reportProgress$
        .pipe(skip(1))
        .subscribe((step) => progressSteps.push(step));

      await firstValueFrom(service.generateNewReport$(orgId));
      sub.unsubscribe();

      expect(progressSteps).toEqual([
        null, // reset at start
        ReportProgress.FetchingMembers,
        ReportProgress.AnalyzingPasswords,
        ReportProgress.CalculatingRisks,
        ReportProgress.GeneratingReport,
        ReportProgress.Saving,
        ReportProgress.Complete,
      ]);
    });

    it("should reset reportProgress$ to null on generation error", async () => {
      reportGenerationService.generateReport.mockReturnValue(
        throwError(() => new Error("Generation failed")),
      );

      await expect(firstValueFrom(service.generateNewReport$(orgId))).rejects.toThrow(
        "Generation failed",
      );

      const progress = await firstValueFrom(service.reportProgress$);
      expect(progress).toBeNull();
    });
  });

  describe("Load Existing Report", () => {
    it("should load and emit report", async () => {
      reportPersistenceService.loadReport$.mockReturnValue(
        of({ report: testReport, hadLegacyBlobs: false }),
      );

      await firstValueFrom(service.loadExistingReport$(orgId));

      const report = await firstValueFrom(service.report$);
      expect(report).toBe(testReport);
    });

    it("should emit null if no report exists", async () => {
      reportPersistenceService.loadReport$.mockReturnValue(of(null));

      await firstValueFrom(service.loadExistingReport$(orgId));

      const report = await firstValueFrom(service.report$);
      expect(report).toBeNull();
    });
  });

  describe("Application Metadata Updates", () => {
    let mockReport: any;

    beforeEach(() => {
      mockReport = createRiskInsights({
        applications: [
          { applicationName: "github.com", isCritical: false, reviewedDate: undefined } as any,
        ],
      });
      mockReport.markApplicationsAsCritical = jest.fn();
      mockReport.unmarkApplicationsAsCritical = jest.fn();
      mockReport.markApplicationAsReviewed = jest.fn();

      reportPersistenceService.loadReport$.mockReturnValue(
        of({ report: mockReport, hadLegacyBlobs: false }),
      );
      reportPersistenceService.saveApplicationMetadata$.mockReturnValue(of(undefined as void));
    });

    it("should mark applications as critical and persist", async () => {
      await firstValueFrom(service.initializeForOrganization$(orgId));
      await firstValueFrom(service.markApplicationsAsCritical$(["github.com"]));

      expect(mockReport.markApplicationsAsCritical).toHaveBeenCalledWith(["github.com"]);
      expect(reportPersistenceService.saveApplicationMetadata$).toHaveBeenCalledWith(mockReport);

      const report = await firstValueFrom(service.report$);
      expect(report?.applications).toBe(mockReport.applications);
    });

    it("should unmark applications as critical and persist", async () => {
      mockReport.applications[0].isCritical = true;

      await firstValueFrom(service.initializeForOrganization$(orgId));
      await firstValueFrom(service.unmarkApplicationsAsCritical$(["github.com"]));

      expect(mockReport.unmarkApplicationsAsCritical).toHaveBeenCalledWith(["github.com"]);
      expect(reportPersistenceService.saveApplicationMetadata$).toHaveBeenCalledWith(mockReport);
    });

    it("should mark applications as reviewed and persist", async () => {
      await firstValueFrom(service.initializeForOrganization$(orgId));
      const reviewDate = new Date();
      await firstValueFrom(service.markApplicationsAsReviewed$(["github.com"], reviewDate));

      expect(mockReport.markApplicationAsReviewed).toHaveBeenCalledWith("github.com", reviewDate);
      expect(reportPersistenceService.saveApplicationMetadata$).toHaveBeenCalledWith(mockReport);
    });

    it("should throw error if no report loaded", async () => {
      reportPersistenceService.loadReport$.mockReturnValue(of(null));
      await firstValueFrom(service.initializeForOrganization$(orgId));

      await expect(
        firstValueFrom(service.markApplicationsAsCritical$(["github.com"])),
      ).rejects.toThrow("No report loaded");
    });

    it("should rollback mutation on save failure (mark critical)", async () => {
      mockReport.applications[0].isCritical = false;

      await firstValueFrom(service.initializeForOrganization$(orgId));

      reportPersistenceService.saveApplicationMetadata$.mockReturnValue(
        throwError(() => new Error("Save failed")),
      );

      await expect(
        firstValueFrom(service.markApplicationsAsCritical$(["github.com"])),
      ).rejects.toThrow("Save failed");

      // Rollback restores isCritical to its original value via direct property assignment
      expect(mockReport.applications[0].isCritical).toBe(false);
    });

    it("should emit updated report after mutation", async () => {
      await firstValueFrom(service.initializeForOrganization$(orgId));

      let emitCount = 0;
      service.report$.subscribe(() => emitCount++);

      await firstValueFrom(service.markApplicationsAsCritical$(["github.com"]));

      expect(emitCount).toBeGreaterThan(1); // Initial + mutation emit
    });

    it("should use correct organizationId when marking critical after report generation", async () => {
      cipherService.getAllFromApiForOrganization.mockResolvedValue(testCiphers);
      organizationUserApiService.getAllUsers.mockResolvedValue({ data: [] } as any);
      reportPersistenceService.loadReport$.mockReturnValue(of(null));
      reportPersistenceService.saveReport$.mockReturnValue(
        of({
          id: "report-id-123" as OrganizationReportId,
          contentEncryptionKey: new EncString(""),
        }),
      );
      reportGenerationService.generateReport.mockReturnValue(of(testReport));

      await firstValueFrom(service.generateNewReport$(orgId));
      await firstValueFrom(service.markApplicationsAsCritical$(["test-app.com"]));

      expect(reportPersistenceService.saveApplicationMetadata$).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: orgId }),
      );
    });

    it("should rollback mutation on save failure (unmark critical)", async () => {
      mockReport.applications[0].isCritical = true;

      await firstValueFrom(service.initializeForOrganization$(orgId));

      reportPersistenceService.saveApplicationMetadata$.mockReturnValue(
        throwError(() => new Error("Save failed")),
      );

      await expect(
        firstValueFrom(service.unmarkApplicationsAsCritical$(["github.com"])),
      ).rejects.toThrow("Save failed");

      // Rollback restores isCritical to its original value via direct property assignment
      expect(mockReport.applications[0].isCritical).toBe(true);
    });

    it("should rollback mutation on save failure (mark reviewed)", async () => {
      const originalDate = new Date("2024-01-01");
      mockReport.applications[0].reviewedDate = originalDate;

      mockReport.markApplicationAsReviewed.mockImplementation((_name: string, date?: Date) => {
        mockReport.applications[0].reviewedDate = date;
      });

      await firstValueFrom(service.initializeForOrganization$(orgId));

      reportPersistenceService.saveApplicationMetadata$.mockReturnValue(
        throwError(() => new Error("Save failed")),
      );

      const newDate = new Date("2025-06-01");
      await expect(
        firstValueFrom(service.markApplicationsAsReviewed$(["github.com"], newDate)),
      ).rejects.toThrow("Save failed");

      expect(mockReport.applications[0].reviewedDate).toBe(originalDate);
    });
  });

  describe("Organization Switching", () => {
    it("should reset state when switching organizations", async () => {
      reportPersistenceService.loadReport$.mockReturnValue(
        of({ report: testReport, hadLegacyBlobs: false }),
      );

      await firstValueFrom(service.initializeForOrganization$(orgId));
      const firstReport = await firstValueFrom(service.report$);
      expect(firstReport).toBe(testReport);

      // Switch to different org
      const newOrgId = "org-456" as OrganizationId;
      reportPersistenceService.loadReport$.mockReturnValue(of(null));

      await firstValueFrom(service.initializeForOrganization$(newOrgId));
      const secondReport = await firstValueFrom(service.report$);
      expect(secondReport).toBeNull();
    });
  });

  describe("Edge Cases", () => {
    it("should expose ciphers$ for UI icon display", async () => {
      cipherService.getAllFromApiForOrganization.mockResolvedValue(testCiphers);
      organizationUserApiService.getAllUsers.mockResolvedValue({ data: [] } as any);
      reportGenerationService.generateReport.mockReturnValue(of(testReport));
      reportPersistenceService.loadReport$.mockReturnValue(of(null));
      reportPersistenceService.saveReport$.mockReturnValue(
        of({ id: "report-id" as OrganizationReportId, contentEncryptionKey: new EncString("") }),
      );

      await firstValueFrom(service.generateNewReport$(orgId));

      const ciphers = await firstValueFrom(service.ciphers$);
      expect(ciphers).toEqual(testCiphers);
    });

    it("should clear error after successful operation", async () => {
      // First operation fails
      reportPersistenceService.loadReport$.mockReturnValue(
        throwError(() => new Error("Load failed")),
      );
      await firstValueFrom(service.initializeForOrganization$(orgId));

      let error = await firstValueFrom(service.error$);
      expect(error).toBe("Failed to initialize");

      // Second operation succeeds
      reportPersistenceService.loadReport$.mockReturnValue(
        of({ report: testReport, hadLegacyBlobs: false }),
      );
      await firstValueFrom(service.initializeForOrganization$(orgId));

      error = await firstValueFrom(service.error$);
      expect(error).toBeNull();
    });
  });

  describe("Data Transformation", () => {
    it("should transform organization user data correctly", async () => {
      const apiUsers = [
        {
          id: "user-1",
          name: "Alice",
          email: "alice@example.com",
          collections: [{ id: "col-1", readOnly: false, hidePasswords: false, manage: true }],
          groups: ["group-1"],
        } as OrganizationUserUserDetailsResponse,
        {
          id: "user-2",
          name: "Bob",
          email: "bob@example.com",
          collections: [{ id: "col-1", readOnly: false, hidePasswords: false, manage: false }],
          groups: ["group-2"],
        } as OrganizationUserUserDetailsResponse,
      ];

      cipherService.getAllFromApiForOrganization.mockResolvedValue(testCiphers);
      organizationUserApiService.getAllUsers.mockResolvedValue({ data: apiUsers } as any);
      reportGenerationService.generateReport.mockReturnValue(of(testReport));
      reportPersistenceService.loadReport$.mockReturnValue(of(null));
      reportPersistenceService.saveReport$.mockReturnValue(
        of({ id: "report-id" as OrganizationReportId, contentEncryptionKey: new EncString("") }),
      );

      await firstValueFrom(service.generateNewReport$(orgId));

      expect(reportGenerationService.generateReport).toHaveBeenCalledWith(
        testCiphers,
        expect.arrayContaining([
          { id: "user-1", name: "Alice", email: "alice@example.com" },
          { id: "user-2", name: "Bob", email: "bob@example.com" },
        ]),
        expect.arrayContaining([
          {
            collectionId: "col-1",
            users: expect.any(Set),
            groups: expect.any(Set),
          },
        ]),
        expect.arrayContaining([
          { groupId: "group-1", users: expect.any(Set) },
          { groupId: "group-2", users: expect.any(Set) },
        ]),
        expect.anything(),
      );
    });
  });
});
