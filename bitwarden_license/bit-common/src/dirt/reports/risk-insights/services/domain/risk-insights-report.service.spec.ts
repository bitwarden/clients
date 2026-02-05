import { mock } from "jest-mock-extended";
import { firstValueFrom, of } from "rxjs";

import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
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
  const mockConfigService = mock<ConfigService>();
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

    // Mock configService with feature flag on by default
    mockConfigService.getFeatureFlag$.mockReturnValue(of(true));

    service = new RiskInsightsReportService(
      mockRiskInsightsApiService,
      mockRiskInsightsEncryptionService,
      mockConfigService,
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
      jest.clearAllMocks();
      mockConfigService.getFeatureFlag$.mockReturnValue(of(true));
    });

    it("should decrypt report and return data", async () => {
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

      mockRiskInsightsApiService.downloadRiskInsightsReport$.mockReturnValue(of(mockResponse));
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

    it("should use download endpoint when feature flag is true", async () => {
      const organizationId = "orgId" as OrganizationId;
      const userId = "userId" as UserId;

      const mockResponse = new GetRiskInsightsReportResponse({
        id: "reportId",
        creationDate: new Date(),
        organizationId: organizationId,
        reportData: mockReportEnc.encryptedString,
        summaryData: mockSummaryEnc.encryptedString,
        applicationData: mockApplicationsEnc.encryptedString,
        contentEncryptionKey: mockEncryptedKey.encryptedString,
      });

      mockRiskInsightsApiService.downloadRiskInsightsReport$.mockReturnValue(of(mockResponse));
      mockRiskInsightsEncryptionService.decryptRiskInsightsReport.mockResolvedValue(
        mockDecryptedData,
      );

      await firstValueFrom(service.getRiskInsightsReport$(organizationId, userId));

      expect(mockRiskInsightsApiService.downloadRiskInsightsReport$).toHaveBeenCalledWith(
        organizationId,
      );
      expect(mockRiskInsightsApiService.getRiskInsightsReport$).not.toHaveBeenCalled();
    });

    it("should use regular get endpoint when feature flag is false", async () => {
      mockConfigService.getFeatureFlag$.mockReturnValue(of(false));

      const organizationId = "orgId" as OrganizationId;
      const userId = "userId" as UserId;

      const mockResponse = new GetRiskInsightsReportResponse({
        id: "reportId",
        creationDate: new Date(),
        organizationId: organizationId,
        reportData: mockReportEnc.encryptedString,
        summaryData: mockSummaryEnc.encryptedString,
        applicationData: mockApplicationsEnc.encryptedString,
        contentEncryptionKey: mockEncryptedKey.encryptedString,
      });

      mockRiskInsightsApiService.getRiskInsightsReport$.mockReturnValue(of(mockResponse));
      mockRiskInsightsEncryptionService.decryptRiskInsightsReport.mockResolvedValue(
        mockDecryptedData,
      );

      await firstValueFrom(service.getRiskInsightsReport$(organizationId, userId));

      expect(mockRiskInsightsApiService.getRiskInsightsReport$).toHaveBeenCalledWith(
        organizationId,
      );
      expect(mockRiskInsightsApiService.downloadRiskInsightsReport$).not.toHaveBeenCalled();
    });
  });
});
