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
import { RiskInsightsData, SaveRiskInsightsReportResponse } from "../../models";
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
    it("should call with correct org and user IDs and emit ReportState", (done) => {
      // Arrange
      const privateOrganizationDetailsSubject = service["_organizationDetailsSubject"];
      const privateUserIdSubject = service["_userIdSubject"];

      // Set up organization and user context
      privateOrganizationDetailsSubject.next({
        organizationId: mockOrgId,
        organizationName: mockOrgName,
      });
      privateUserIdSubject.next(mockUserId);

      // Act
      service.fetchReport();

      // Assert
      service.rawReportData$.subscribe((state) => {
        if (!state.loading) {
          expect(mockReportService.getRiskInsightsReport$).toHaveBeenCalledWith(
            mockOrgId,
            mockUserId,
          );
          expect(state.data).toEqual(reportState);
          done();
        }
      });
    });

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

      const { _organizationDetailsSubject, _userIdSubject } = testService as any;
      _organizationDetailsSubject.next({
        organizationId: mockOrgId,
        organizationName: mockOrgName,
      });
      _userIdSubject.next(mockUserId);
      testService.fetchReport();
      testService.rawReportData$.subscribe((state) => {
        if (!state.loading) {
          expect(state.error).toBe("Failed to fetch report");
          expect(state.data).toBeNull();
          done();
        }
      });
    });
  });

  describe("generateReport", () => {
    it("should generate report using member ciphers and password health, then save and emit ReportState", (done) => {
      const privateOrganizationDetailsSubject = service["_organizationDetailsSubject"];
      const privateUserIdSubject = service["_userIdSubject"];

      // Set up ciphers in orchestrator
      privateOrganizationDetailsSubject.next({
        organizationId: mockOrgId,
        organizationName: mockOrgName,
      });
      privateUserIdSubject.next(mockUserId);

      // Act
      service.generateReport();

      // Assert
      service.rawReportData$.subscribe((state) => {
        if (!state.loading && state.data) {
          expect(mockMemberCipherDetailsApiService.getMemberCipherDetails).toHaveBeenCalledWith(
            mockOrgId,
          );
          expect(mockReportService.generateApplicationsReport).toHaveBeenCalled();
          expect(mockReportService.saveRiskInsightsReport$).toHaveBeenCalledWith(
            mockEnrichedReportData,
            mockSummaryData,
            mockApplicationData,
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
        const privateDestroy = (service as any)._destroy$;
        const privateReportStateSubscription = (service as any)._reportStateSubscription;

        // Spy on the methods you expect to be called.
        const destroyCompleteSpy = jest.spyOn(privateDestroy, "complete");
        const unsubscribeSpy = jest.spyOn(privateReportStateSubscription, "unsubscribe");

        // Execute the destroy method.
        service.destroy();

        // Assert that the methods were called as expected.
        expect(destroyCompleteSpy).toHaveBeenCalled();
        expect(unsubscribeSpy).toHaveBeenCalled();
      });
    });
  });
});
