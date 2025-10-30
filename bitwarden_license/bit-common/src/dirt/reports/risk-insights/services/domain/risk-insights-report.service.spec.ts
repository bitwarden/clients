import { mock } from "jest-mock-extended";
import { firstValueFrom, of } from "rxjs";

import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { makeEncString } from "@bitwarden/common/spec";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";

import { DecryptedReportData, EncryptedDataWithKey } from "../../models";
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
import { RiskInsightsEncryptionService } from "./risk-insights-encryption.service";
import { RiskInsightsReportService } from "./risk-insights-report.service";

describe("RiskInsightsReportService", () => {
  let service: RiskInsightsReportService;

  // Mock services
  const cipherService = mock<CipherService>();
  const memberCipherDetailsService = mock<MemberCipherDetailsApiService>();
  const mockPasswordHealthService = mock<PasswordHealthService>();
  const mockRiskInsightsApiService = mock<RiskInsightsApiService>();
  const mockRiskInsightsEncryptionService = mock<RiskInsightsEncryptionService>({
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
          newApplications: [],
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
});
