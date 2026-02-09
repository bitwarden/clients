import { mock } from "jest-mock-extended";
import { of, throwError } from "rxjs";

import {
  CollectionAdminService,
  OrganizationUserApiService,
  OrganizationUserUserDetailsResponse,
} from "@bitwarden/admin-console/common";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { CollectionAdminView } from "@bitwarden/common/admin-console/models/collections";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { ListResponse } from "@bitwarden/common/models/response/list.response";
import { makeEncString } from "@bitwarden/common/spec";
import { OrganizationId, OrganizationReportId, UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { LogService } from "@bitwarden/logging";

import { createNewSummaryData } from "../../helpers";
import { ReportStatus, RiskInsightsData, SaveRiskInsightsReportResponse } from "../../models";
import { RiskInsightsMetrics } from "../../models/domain/risk-insights-metrics";
import {
  mockApplicationData,
  mockEnrichedReportData,
  mockSummaryData,
} from "../../models/mocks/mock-data";
import { MemberCipherDetailsApiService } from "../api/member-cipher-details-api.service";
import { RiskInsightsApiService } from "../api/risk-insights-api.service";

import { CriticalAppsService } from "./critical-apps.service";
import { PasswordHealthService } from "./password-health.service";
import { RiskInsightsOrchestratorService } from "./risk-insights-orchestrator.service";
import { RiskInsightsReportService } from "./risk-insights-report.service";
import { RiskInsightsSaveService } from "./risk-insights-save.service";

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
  const mockCollectionAdminService = mock<CollectionAdminService>();
  const mockOrganizationService = mock<OrganizationService>();
  const mockOrganizationUserApiService = mock<OrganizationUserApiService>();
  const mockCipherService = mock<CipherService>();
  const mockMemberCipherDetailsApiService = mock<MemberCipherDetailsApiService>();
  let mockPasswordHealthService: PasswordHealthService;
  const mockReportApiService = mock<RiskInsightsApiService>();
  let mockReportService: RiskInsightsReportService;
  const mockLogService = mock<LogService>();
  const mockSaveService = mock<RiskInsightsSaveService>();

  // Mock data for V2 dependencies
  const mockCollectionAdminViews: CollectionAdminView[] = [
    {
      id: "coll-1",
      name: "Collection 1",
      users: [],
      groups: [],
      assigned: false,
      readOnly: false,
    } as unknown as CollectionAdminView,
    {
      id: "coll-2",
      name: "Collection 2",
      users: [],
      groups: [],
      assigned: false,
      readOnly: false,
    } as unknown as CollectionAdminView,
  ];
  const mockOrgUsers: ListResponse<OrganizationUserUserDetailsResponse> = {
    data: [
      { id: "user-1", email: "user1@test.com", groups: ["group-1"] },
      { id: "user-2", email: "user2@test.com", groups: [] },
    ],
  } as unknown as ListResponse<OrganizationUserUserDetailsResponse>;
  const mockGroups: Array<{ id: string; name: string }> = [
    { id: "group-1", name: "Group 1" },
    { id: "group-2", name: "Group 2" },
  ];

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

    // Arrange mocks for V2 flow
    mockCollectionAdminService.collectionAdminViews$.mockReturnValue(of(mockCollectionAdminViews));
    mockOrganizationUserApiService.getAllUsers.mockResolvedValue(mockOrgUsers);
    mockReportApiService.getOrganizationGroups$.mockReturnValue(of(mockGroups));

    mockPasswordHealthService = mock<PasswordHealthService>({
      auditPasswordLeaks$: jest.fn(() => of([])),
      isValidCipher: jest.fn().mockReturnValue(true),
      findWeakPasswordDetails: jest.fn().mockReturnValue(null),
    });

    mockCipherService.getAllFromApiForOrganization.mockReturnValue(mockCiphers);

    service = new RiskInsightsOrchestratorService(
      mockAccountService,
      mockCipherService,
      mockCollectionAdminService,
      mockCriticalAppsService,
      mockLogService,
      mockMemberCipherDetailsApiService,
      mockOrganizationService,
      mockOrganizationUserApiService,
      mockPasswordHealthService,
      mockReportApiService,
      mockReportService,
      mockSaveService,
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
        mockCollectionAdminService,
        mockCriticalAppsService,
        mockLogService,
        mockMemberCipherDetailsApiService,
        mockOrganizationService,
        mockOrganizationUserApiService,
        mockPasswordHealthService,
        mockReportApiService,
        mockReportService,
        mockSaveService,
      );

      const { _organizationDetailsSubject, _userIdSubject } = testService as any;
      _organizationDetailsSubject.next({
        organizationId: mockOrgId,
        organizationName: mockOrgName,
      });
      _userIdSubject.next(mockUserId);
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
    it("should generate report using V2 frontend mapping, then save and emit ReportState", (done) => {
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
          // V2 uses frontend mapping instead of getMemberCipherDetails
          expect(mockCollectionAdminService.collectionAdminViews$).toHaveBeenCalledWith(
            mockOrgId,
            mockUserId,
          );
          expect(mockOrganizationUserApiService.getAllUsers).toHaveBeenCalledWith(mockOrgId, {
            includeGroups: true,
          });
          expect(mockReportApiService.getOrganizationGroups$).toHaveBeenCalledWith(mockOrgId);

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
