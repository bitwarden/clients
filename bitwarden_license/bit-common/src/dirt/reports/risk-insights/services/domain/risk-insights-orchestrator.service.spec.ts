import { mock } from "jest-mock-extended";
import { of, throwError } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { makeEncString } from "@bitwarden/common/spec";
import { OrganizationId, OrganizationReportId, UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { LogService } from "@bitwarden/logging";

import { createNewSummaryData } from "../../helpers";
import {
  ReportStatus,
  RiskInsightsData,
  RiskInsightsEnrichedData,
  SaveRiskInsightsReportResponse,
} from "../../models";
import { RiskInsightsMetrics } from "../../models/domain/risk-insights-metrics";
import { mockMemberCipherDetailsResponse } from "../../models/mocks/member-cipher-details-response.mock";
import {
  mockApplicationData,
  mockEnrichedReportData,
  mockSummaryData,
} from "../../models/mocks/mock-data";
import { MemberCipherDetailsApiService } from "../api/member-cipher-details-api.service";
import { RiskInsightsApiService } from "../api/risk-insights-api.service";

import { CriticalAppsService } from "./critical-apps.service";
import { PasswordHealthService } from "./password-health.service";
import { RiskInsightsEncryptionService } from "./risk-insights-encryption.service";
import { RiskInsightsOrchestratorService } from "./risk-insights-orchestrator.service";
import { RiskInsightsReportService } from "./risk-insights-report.service";

/**
 * Test harness to encapsulate private member access.
 * Provides a maintainable, type-safe way to set up test scenarios
 * without directly accessing private members throughout tests.
 */
class TestHarness {
  constructor(private service: RiskInsightsOrchestratorService) {}

  setOrganizationContext(organizationId: OrganizationId, organizationName: string) {
    this.service["_organizationDetailsSubject"].next({ organizationId, organizationName });
    return this;
  }

  setUserId(userId: UserId) {
    this.service["_userIdSubject"].next(userId);
    return this;
  }

  setEnrichedReportData(data: RiskInsightsEnrichedData) {
    this.service["_enrichedReportDataSubject"].next(data);
    return this;
  }

  setupCompleteContext(organizationId: OrganizationId, userId: UserId, orgName = "Test Org") {
    return this.setOrganizationContext(organizationId, orgName).setUserId(userId);
  }

  getDestroySubject() {
    return this.service["_destroy$"];
  }

  getReportStateSubscription() {
    return this.service["_reportStateSubscription"];
  }
}

describe("RiskInsightsOrchestratorService", () => {
  let service: RiskInsightsOrchestratorService;

  // Non changing mock data
  const mockOrgId = "org-789" as OrganizationId;
  const mockOrgName = "Test Org";
  const mockUserId = "user-101" as UserId;
  const mockReportId = "report-1" as OrganizationReportId;
  const mockKey: EncString = makeEncString("wrappedKey");

  const reportState: RiskInsightsData = {
    id: mockReportId,
    reportData: [],
    summaryData: createNewSummaryData(),
    applicationData: [],
    creationDate: new Date(),
    contentEncryptionKey: mockKey,
  };
  const mockCiphers = [{ id: "cipher-1" }] as any;

  // Mock services
  const mockAccountService = mock<AccountService>({
    activeAccount$: of(mock<Account>({ id: mockUserId })),
  });
  const mockCriticalAppsService = mock<CriticalAppsService>({
    criticalAppsList$: of([]),
  });
  const mockOrganizationService = mock<OrganizationService>();
  const mockCipherService = mock<CipherService>();
  const mockMemberCipherDetailsApiService = mock<MemberCipherDetailsApiService>();
  let mockPasswordHealthService: PasswordHealthService;
  const mockReportApiService = mock<RiskInsightsApiService>();
  let mockReportService: RiskInsightsReportService;
  const mockRiskInsightsEncryptionService = mock<RiskInsightsEncryptionService>();
  const mockLogService = mock<LogService>();

  beforeEach(() => {
    // Mock pipes from constructor
    mockReportService = mock<RiskInsightsReportService>({
      generateApplicationsReport: jest.fn().mockReturnValue(mockEnrichedReportData),
      getApplicationsSummary: jest.fn().mockReturnValue(mockSummaryData),
      getOrganizationApplications: jest.fn().mockReturnValue(mockApplicationData),
      getRiskInsightsReport$: jest.fn().mockReturnValue(of(reportState)),
      saveRiskInsightsReport$: jest.fn().mockReturnValue(
        of({
          response: { id: mockReportId } as SaveRiskInsightsReportResponse,
          contentEncryptionKey: mockKey,
        }),
      ),
    });
    // Arrange mocks for new flow
    mockMemberCipherDetailsApiService.getMemberCipherDetails.mockResolvedValue(
      mockMemberCipherDetailsResponse,
    );

    mockPasswordHealthService = mock<PasswordHealthService>({
      auditPasswordLeaks$: jest.fn(() => of([])),
      isValidCipher: jest.fn().mockReturnValue(true),
      findWeakPasswordDetails: jest.fn().mockReturnValue(null),
    });

    mockCipherService.getAllFromApiForOrganization.mockReturnValue(mockCiphers);

    service = new RiskInsightsOrchestratorService(
      mockAccountService,
      mockCipherService,
      mockCriticalAppsService,
      mockLogService,
      mockMemberCipherDetailsApiService,
      mockOrganizationService,
      mockPasswordHealthService,
      mockReportApiService,
      mockReportService,
      mockRiskInsightsEncryptionService,
    );
  });

  describe("fetchReport", () => {
    it("should emit error ReportState when getRiskInsightsReport$ throws", (done) => {
      // Setup error passed via constructor for this test case
      mockReportService.getRiskInsightsReport$ = jest
        .fn()
        .mockReturnValue(throwError(() => new Error("API error")));
      const testService = new RiskInsightsOrchestratorService(
        mockAccountService,
        mockCipherService,
        mockCriticalAppsService,
        mockLogService,
        mockMemberCipherDetailsApiService,
        mockOrganizationService,
        mockPasswordHealthService,
        mockReportApiService,
        mockReportService,
        mockRiskInsightsEncryptionService,
      );

      const harness = new TestHarness(testService);
      harness.setupCompleteContext(mockOrgId, mockUserId, mockOrgName);
      testService.rawReportData$.subscribe((state) => {
        if (state.status != ReportStatus.Loading) {
          expect(state.error).toBe("Failed to fetch report");
          expect(state.data).toBeNull();
          done();
        }
      });
    });
  });

  describe("generateReport", () => {
    it("should generate report using member ciphers and password health, then save and emit ReportState", (done) => {
      // Set up ciphers in orchestrator
      const harness = new TestHarness(service);
      harness.setupCompleteContext(mockOrgId, mockUserId, mockOrgName);

      // Act
      service.generateReport();

      const metricsData = new RiskInsightsMetrics();
      metricsData.totalApplicationCount = 3;
      metricsData.totalAtRiskApplicationCount = 1;
      metricsData.totalAtRiskMemberCount = 2;
      metricsData.totalAtRiskPasswordCount = 1;
      metricsData.totalCriticalApplicationCount = 1;
      metricsData.totalCriticalAtRiskApplicationCount = 1;
      metricsData.totalCriticalMemberCount = 1;
      metricsData.totalCriticalAtRiskMemberCount = 1;
      metricsData.totalCriticalPasswordCount = 0;
      metricsData.totalCriticalAtRiskPasswordCount = 0;
      metricsData.totalMemberCount = 5;
      metricsData.totalPasswordCount = 2;

      // Assert
      service.rawReportData$.subscribe((state) => {
        if (state.status != ReportStatus.Loading && state.data) {
          expect(mockMemberCipherDetailsApiService.getMemberCipherDetails).toHaveBeenCalledWith(
            mockOrgId,
          );
          expect(mockReportService.generateApplicationsReport).toHaveBeenCalled();
          expect(mockReportService.saveRiskInsightsReport$).toHaveBeenCalledWith(
            mockEnrichedReportData,
            mockSummaryData,
            mockApplicationData,
            metricsData,
            { organizationId: mockOrgId, userId: mockUserId },
          );
          expect(state.data.reportData).toEqual(mockEnrichedReportData);
          expect(state.data.summaryData).toEqual(mockSummaryData);
          expect(state.data.applicationData).toEqual(mockApplicationData);
          done();
        }
      });
    });

    describe("destroy", () => {
      it("should complete destroy$ subject and unsubscribe reportStateSubscription", () => {
        const harness = new TestHarness(service);

        // Spy on the methods you expect to be called.
        const destroyCompleteSpy = jest.spyOn(harness.getDestroySubject(), "complete");
        const unsubscribeSpy = jest.spyOn(harness.getReportStateSubscription(), "unsubscribe");

        // Execute the destroy method.
        service.destroy();

        // Assert that the methods were called as expected.
        expect(destroyCompleteSpy).toHaveBeenCalled();
        expect(unsubscribeSpy).toHaveBeenCalled();
      });
    });
  });

  describe("criticalReportResults$", () => {
    it("should filter reportData and applicationData to only include critical applications", (done) => {
      // Arrange: Create test data with both critical and non-critical applications
      // Note: Using plain object instead of mock() because arrays need to work with .filter()
      const testEnrichedReportData: RiskInsightsEnrichedData = {
        reportData: [
          { ...mockEnrichedReportData[0], isMarkedAsCritical: true }, // Critical app
          { ...mockEnrichedReportData[1], isMarkedAsCritical: false }, // Non-critical app
        ],
        summaryData: {
          ...mockSummaryData,
          totalApplicationCount: 3,
          totalCriticalApplicationCount: 1,
        },
        applicationData: [
          { applicationName: "application1.com", isCritical: true, reviewedDate: new Date() },
          {
            applicationName: "site2.application1.com",
            isCritical: false,
            reviewedDate: null,
          },
          {
            applicationName: "application2.com",
            isCritical: false,
            reviewedDate: null,
          },
        ],
        creationDate: new Date(),
      };

      // Act: Emit the enriched report data to trigger the critical filtering pipeline
      const harness = new TestHarness(service);
      harness.setEnrichedReportData(testEnrichedReportData);

      // Assert: Verify that criticalReportResults$ only contains critical applications
      service.criticalReportResults$.subscribe((criticalResults) => {
        if (criticalResults) {
          // reportData should only have critical applications
          expect(criticalResults.reportData).toHaveLength(1);
          expect(criticalResults.reportData[0].isMarkedAsCritical).toBe(true);
          expect(criticalResults.reportData[0].applicationName).toBe("application1.com");

          // applicationData should only have critical applications
          expect(criticalResults.applicationData).toHaveLength(1);
          expect(criticalResults.applicationData[0].isCritical).toBe(true);
          expect(criticalResults.applicationData[0].applicationName).toBe("application1.com");

          // summaryData should be recalculated for critical applications only
          expect(criticalResults.summaryData).toBeDefined();
          expect(mockReportService.getApplicationsSummary).toHaveBeenCalledWith(
            expect.arrayContaining([
              expect.objectContaining({
                applicationName: "application1.com",
                isMarkedAsCritical: true,
              }),
            ]),
            expect.arrayContaining([
              expect.objectContaining({ applicationName: "application1.com", isCritical: true }),
            ]),
            testEnrichedReportData.summaryData.totalMemberCount,
          );

          done();
        }
      });
    });

    it("should return empty arrays when no critical applications exist", (done) => {
      // Arrange: Create test data with only non-critical applications
      const testEnrichedReportData: RiskInsightsEnrichedData = {
        reportData: [
          { ...mockEnrichedReportData[0], isMarkedAsCritical: false },
          { ...mockEnrichedReportData[1], isMarkedAsCritical: false },
        ],
        summaryData: {
          ...mockSummaryData,
          totalApplicationCount: 2,
          totalCriticalApplicationCount: 0,
        },
        applicationData: [
          {
            applicationName: "application1.com",
            isCritical: false,
            reviewedDate: null,
          },
          {
            applicationName: "application2.com",
            isCritical: false,
            reviewedDate: null,
          },
        ],
        creationDate: new Date(),
      };

      // Act: Emit the enriched report data
      const harness = new TestHarness(service);
      harness.setEnrichedReportData(testEnrichedReportData);

      // Assert: Verify that criticalReportResults$ contains empty arrays
      service.criticalReportResults$.subscribe((criticalResults) => {
        if (criticalResults) {
          expect(criticalResults.reportData).toHaveLength(0);
          expect(criticalResults.applicationData).toHaveLength(0);
          done();
        }
      });
    });
  });
});
