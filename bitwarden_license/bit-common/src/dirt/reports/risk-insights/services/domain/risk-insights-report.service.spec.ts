import { mock } from "jest-mock-extended";
import { firstValueFrom, of, throwError } from "rxjs";

import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { makeEncString } from "@bitwarden/common/spec";
import { CipherId, OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";

import { LegacyRiskInsightsEncryptionService } from "../../../../access-intelligence/services";
import { DecryptedReportData, EncryptedDataWithKey, MemberDetails } from "../../models";
import {
  GetRiskInsightsReportResponse,
  SaveRiskInsightsReportResponse,
} from "../../models/api-models.types";
import { RiskInsightsMetrics } from "../../models/domain/risk-insights-metrics";
import { mockCiphers } from "../../models/mocks/ciphers.mock";
import { mockMemberCipherDetailsResponse } from "../../models/mocks/member-cipher-details-response.mock";
import {
  mockApplicationData,
  mockCipherHealthReports,
  mockCipherViews,
  mockMemberDetails,
  mockReportData,
  mockSummaryData,
} from "../../models/mocks/mock-data";
import { MemberCipherDetailsApiService } from "../api/member-cipher-details-api.service";
import { RiskInsightsApiService } from "../api/risk-insights-api.service";

import { PasswordHealthService } from "./password-health.service";
import { RiskInsightsReportService } from "./risk-insights-report.service";

describe("RiskInsightsReportService", () => {
  let service: RiskInsightsReportService;

  // Mock services
  const cipherService = mock<CipherService>();
  const memberCipherDetailsService = mock<MemberCipherDetailsApiService>();
  const mockPasswordHealthService = mock<PasswordHealthService>();
  const mockRiskInsightsApiService = mock<RiskInsightsApiService>();
  const mockRiskInsightsEncryptionService = mock<LegacyRiskInsightsEncryptionService>({
    encryptRiskInsightsReport: jest.fn().mockResolvedValue("encryptedReportData"),
    decryptRiskInsightsReport: jest.fn().mockResolvedValue("decryptedReportData"),
  });

  // Non changing mock data
  const mockOrganizationId = "orgId" as OrganizationId;
  const mockUserId = "userId" as UserId;
  const mockEncryptedKey = makeEncString("test-key");

  // Changing mock data
  let mockDecryptedData: DecryptedReportData;
  const mockReportEnc = makeEncString(JSON.stringify(mockReportData));
  const mockSummaryEnc = makeEncString(JSON.stringify(mockSummaryData));
  const mockApplicationsEnc = makeEncString(JSON.stringify(mockApplicationData));

  beforeEach(() => {
    cipherService.getAllFromApiForOrganization.mockResolvedValue(mockCiphers);

    memberCipherDetailsService.getMemberCipherDetails.mockResolvedValue(
      mockMemberCipherDetailsResponse,
    );

    // Mock PasswordHealthService methods
    mockPasswordHealthService.isValidCipher.mockImplementation((cipher: any) => {
      return (
        cipher.type === 1 && cipher.login?.password && !cipher.isDeleted && cipher.viewPassword
      );
    });
    mockPasswordHealthService.findWeakPasswordDetails.mockImplementation((cipher: any) => {
      if (cipher.login?.password === "123") {
        return { score: 1, detailValue: { label: "veryWeak", badgeVariant: "danger" } };
      }
      return null;
    });
    mockPasswordHealthService.auditPasswordLeaks$.mockImplementation((ciphers: any[]) => {
      const exposedDetails = ciphers
        .filter((cipher) => cipher.login?.password === "123")
        .map((cipher) => ({
          exposedXTimes: 100,
          cipherId: cipher.id,
        }));
      return of(exposedDetails);
    });

    service = new RiskInsightsReportService(
      mockRiskInsightsApiService,
      mockRiskInsightsEncryptionService,
    );

    mockDecryptedData = {
      reportData: mockReportData,
      summaryData: mockSummaryData,
      applicationData: mockApplicationData,
    };
  });

  it("should group and aggregate application health reports correctly", () => {
    // Mock the service methods
    cipherService.getAllFromApiForOrganization.mockResolvedValue(mockCipherViews);
    memberCipherDetailsService.getMemberCipherDetails.mockResolvedValue(mockMemberDetails);

    const result = service.generateApplicationsReport(mockCipherHealthReports);
    expect(Array.isArray(result)).toBe(true);

    // Should group by application name (trimmedUris)
    const appCom = result.find((r) => r.applicationName === "app.com");
    const otherCom = result.find((r) => r.applicationName === "other.com");
    expect(appCom).toBeTruthy();
    expect(appCom?.passwordCount).toBe(2);
    expect(otherCom).toBeTruthy();
    expect(otherCom?.passwordCount).toBe(1);
  });

  describe("saveRiskInsightsReport$", () => {
    it("should not update subjects if save response does not have id", (done) => {
      const mockEncryptedOutput: EncryptedDataWithKey = {
        organizationId: mockOrganizationId,
        encryptedReportData: mockReportEnc,
        encryptedSummaryData: mockSummaryEnc,
        encryptedApplicationData: mockApplicationsEnc,
        contentEncryptionKey: mockEncryptedKey,
      };
      mockRiskInsightsEncryptionService.encryptRiskInsightsReport.mockResolvedValue(
        mockEncryptedOutput,
      );

      const saveResponse = new SaveRiskInsightsReportResponse({ id: "" }); // Simulating no ID in response
      mockRiskInsightsApiService.saveRiskInsightsReport$.mockReturnValue(of(saveResponse));

      service
        .saveRiskInsightsReport$(
          mockReportData,
          mockSummaryData,
          mockApplicationData,
          new RiskInsightsMetrics(),
          {
            organizationId: mockOrganizationId,
            userId: mockUserId,
          },
        )
        .subscribe({
          next: (response) => {
            done.fail("Expected error due to invalid response");
          },
          error: (error: unknown) => {
            if (error instanceof ErrorResponse && error.statusCode) {
              expect(error.message).toBe("Invalid response from API");
            }
            done();
          },
        });
    });

    it("should propagate encryption errors", (done) => {
      mockRiskInsightsEncryptionService.encryptRiskInsightsReport.mockRejectedValue(
        new Error("Encryption failed"),
      );

      service
        .saveRiskInsightsReport$(
          mockReportData,
          mockSummaryData,
          mockApplicationData,
          new RiskInsightsMetrics(),
          {
            organizationId: mockOrganizationId,
            userId: mockUserId,
          },
        )
        .subscribe({
          next: () => {
            done.fail("Expected error to propagate");
          },
          error: (error: unknown) => {
            expect((error as Error).message).toBe("Encryption failed");
            done();
          },
        });
    });

    it("should propagate API save errors", (done) => {
      const mockEncryptedOutput: EncryptedDataWithKey = {
        organizationId: mockOrganizationId,
        encryptedReportData: mockReportEnc,
        encryptedSummaryData: mockSummaryEnc,
        encryptedApplicationData: mockApplicationsEnc,
        contentEncryptionKey: mockEncryptedKey,
      };
      mockRiskInsightsEncryptionService.encryptRiskInsightsReport.mockResolvedValue(
        mockEncryptedOutput,
      );
      mockRiskInsightsApiService.saveRiskInsightsReport$.mockReturnValue(
        throwError(() => new Error("API save failed")),
      );

      service
        .saveRiskInsightsReport$(
          mockReportData,
          mockSummaryData,
          mockApplicationData,
          new RiskInsightsMetrics(),
          {
            organizationId: mockOrganizationId,
            userId: mockUserId,
          },
        )
        .subscribe({
          next: () => {
            done.fail("Expected error to propagate");
          },
          error: (error: unknown) => {
            expect((error as Error).message).toBe("API save failed");
            done();
          },
        });
    });
  });

  describe("getRiskInsightsReport$", () => {
    beforeEach(() => {
      // Reset the mocks before each test
      jest.clearAllMocks();
    });

    it("should call with the correct organizationId", async () => {
      // we need to ensure that the api is invoked with the specified organizationId
      // here it doesn't matter what the Api returns
      const apiResponse = new GetRiskInsightsReportResponse({
        id: "reportId",
        date: new Date(),
        organizationId: mockOrganizationId,
        reportData: mockReportEnc.encryptedString,
        summaryData: mockSummaryEnc.encryptedString,
        applicationData: mockApplicationsEnc.encryptedString,
        contentEncryptionKey: mockEncryptedKey.encryptedString,
      });

      const decryptedResponse: DecryptedReportData = {
        reportData: [],
        summaryData: {
          totalMemberCount: 1,
          totalAtRiskMemberCount: 1,
          totalApplicationCount: 1,
          totalAtRiskApplicationCount: 1,
          totalCriticalMemberCount: 1,
          totalCriticalAtRiskMemberCount: 1,
          totalCriticalApplicationCount: 1,
          totalCriticalAtRiskApplicationCount: 1,
          totalPasswordCount: 0,
          totalAtRiskPasswordCount: 0,
          totalCriticalPasswordCount: 0,
          totalCriticalAtRiskPasswordCount: 0,
        },
        applicationData: [],
      };

      const userId = "userId" as UserId;

      // Mock api returned encrypted data
      mockRiskInsightsApiService.getRiskInsightsReport$.mockReturnValue(of(apiResponse));

      // Mock decrypted data
      mockRiskInsightsEncryptionService.decryptRiskInsightsReport.mockReturnValue(
        Promise.resolve(decryptedResponse),
      );

      await firstValueFrom(service.getRiskInsightsReport$(mockOrganizationId, userId));

      expect(mockRiskInsightsApiService.getRiskInsightsReport$).toHaveBeenCalledWith(
        mockOrganizationId,
      );
      expect(mockRiskInsightsEncryptionService.decryptRiskInsightsReport).toHaveBeenCalledWith(
        { organizationId: mockOrganizationId, userId },
        expect.anything(),
        expect.anything(),
      );
    });

    it("should decrypt report and update subjects if response is present", async () => {
      // Arrange: setup a mock response from the API
      // and ensure the decryption service is called with the correct parameters
      const organizationId = "orgId" as OrganizationId;
      const userId = "userId" as UserId;

      const mockResponse = new GetRiskInsightsReportResponse({
        id: "reportId",
        creationDate: new Date(),
        organizationId: organizationId as OrganizationId,
        reportData: mockReportEnc.encryptedString,
        summaryData: mockSummaryEnc.encryptedString,
        applicationData: mockApplicationsEnc.encryptedString,
        contentEncryptionKey: mockEncryptedKey.encryptedString,
      });

      mockRiskInsightsApiService.getRiskInsightsReport$.mockReturnValue(of(mockResponse));
      mockRiskInsightsEncryptionService.decryptRiskInsightsReport.mockResolvedValue(
        mockDecryptedData,
      );

      const result = await firstValueFrom(service.getRiskInsightsReport$(organizationId, userId));

      expect(mockRiskInsightsEncryptionService.decryptRiskInsightsReport).toHaveBeenCalledWith(
        { organizationId: mockOrganizationId, userId },
        expect.anything(),
        expect.anything(),
      );
      expect(result).toEqual({
        ...mockDecryptedData,
        id: mockResponse.id,
        creationDate: mockResponse.creationDate,
        contentEncryptionKey: mockEncryptedKey,
      });
    });
  });

  describe("getApplicationsSummary", () => {
    const baseApp = {
      memberDetails: [] as MemberDetails[],
      atRiskMemberDetails: [] as MemberDetails[],
      memberCount: 0,
      atRiskMemberCount: 0,
      atRiskPasswordCount: 0,
    };

    it("should include password counts aggregated from all reports", () => {
      const reports = [
        {
          ...baseApp,
          applicationName: "app1.com",
          passwordCount: 3,
          atRiskPasswordCount: 1,
          cipherIds: ["c1", "c2", "c3"] as CipherId[],
          atRiskCipherIds: ["c1"] as CipherId[],
        },
        {
          ...baseApp,
          applicationName: "app2.com",
          passwordCount: 2,
          atRiskPasswordCount: 2,
          cipherIds: ["c4", "c5"] as CipherId[],
          atRiskCipherIds: ["c4", "c5"] as CipherId[],
        },
      ];
      const applications = [
        { applicationName: "app1.com", isCritical: false, reviewedDate: null as Date | null },
      ];

      const result = service.getApplicationsSummary(reports, applications, 5);
      expect(result.totalPasswordCount).toBe(5);
      expect(result.totalAtRiskPasswordCount).toBe(3);
    });

    it("should include only critical app password counts in critical totals", () => {
      const reports = [
        {
          ...baseApp,
          applicationName: "critical.com",
          passwordCount: 4,
          atRiskPasswordCount: 2,
          cipherIds: ["c1", "c2", "c3", "c4"] as CipherId[],
          atRiskCipherIds: ["c1", "c2"] as CipherId[],
        },
        {
          ...baseApp,
          applicationName: "normal.com",
          passwordCount: 3,
          atRiskPasswordCount: 1,
          cipherIds: ["c5", "c6", "c7"] as CipherId[],
          atRiskCipherIds: ["c5"] as CipherId[],
        },
      ];
      const applications = [
        { applicationName: "critical.com", isCritical: true, reviewedDate: null as Date | null },
        { applicationName: "normal.com", isCritical: false, reviewedDate: null as Date | null },
      ];

      const result = service.getApplicationsSummary(reports, applications, 10);
      expect(result.totalPasswordCount).toBe(7);
      expect(result.totalAtRiskPasswordCount).toBe(3);
      expect(result.totalCriticalPasswordCount).toBe(4);
      expect(result.totalCriticalAtRiskPasswordCount).toBe(2);
    });

    it("should return 0 for all password counts when reports is empty", () => {
      const result = service.getApplicationsSummary([], [], 0);
      expect(result.totalPasswordCount).toBe(0);
      expect(result.totalAtRiskPasswordCount).toBe(0);
      expect(result.totalCriticalPasswordCount).toBe(0);
      expect(result.totalCriticalAtRiskPasswordCount).toBe(0);
    });
  });
});
