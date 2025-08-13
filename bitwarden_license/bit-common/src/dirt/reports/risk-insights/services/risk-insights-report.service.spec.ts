import { mock } from "jest-mock-extended";
import { firstValueFrom, of } from "rxjs";

import { EncString } from "@bitwarden/common/platform/models/domain/enc-string";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";

import { ApplicationHealthReportDetail } from "../models/report-models";

import { mockCiphers } from "./ciphers.mock";
import { MemberCipherDetailsApiService } from "./member-cipher-details-api.service";
import { mockMemberCipherDetails } from "./member-cipher-details-api.service.spec";
import { PasswordHealthService } from "./password-health.service";
import { RiskInsightsApiService } from "./risk-insights-api.service";
import { RiskInsightsEncryptionService } from "./risk-insights-encryption.service";
import { RiskInsightsReportService } from "./risk-insights-report.service";

describe("RiskInsightsReportService", () => {
  let service: RiskInsightsReportService;
  const ENCRYPTED_TEXT = "This data has been encrypted";
  const ENCRYPTED_KEY = "Re-encrypted Cipher Key";
  const passwordHealthService = mock<PasswordHealthService>();
  const cipherService = mock<CipherService>();
  const memberCipherDetailsService = mock<MemberCipherDetailsApiService>();
  const mockRiskInsightsApiService = mock<RiskInsightsApiService>();
  const mockRiskInsightsEncryptionService = mock<RiskInsightsEncryptionService>();

  const mockReportId = "report-id";
  const mockOrganizationId = "org-123" as OrganizationId;
  const mockUserId = "user-456" as UserId;
  const mockEncryptedText = new EncString(ENCRYPTED_TEXT);
  const mockEncryptedKey = new EncString(ENCRYPTED_KEY);
  const mockReportDate = new Date().toISOString();

  beforeEach(() => {
    // Mock the password health service methods
    passwordHealthService.isValidCipher.mockImplementation(
      (cipher) =>
        cipher.type === 1 && cipher.login?.password && !cipher.isDeleted && cipher.viewPassword,
    );

    passwordHealthService.findWeakPasswordDetails.mockImplementation((cipher) => {
      const score = cipher.login.password.length < 4 ? 1 : 4;
      return score <= 2 ? { score, detailValue: { label: "weak", badgeVariant: "warning" } } : null;
    });

    passwordHealthService.auditPasswordLeaks$.mockImplementation((ciphers) =>
      of(
        ciphers
          .filter((cipher) => cipher.login.password === "123")
          .map((cipher) => ({ cipherId: cipher.id, exposedXTimes: 100 })),
      ),
    );

    cipherService.getAllFromApiForOrganization.mockResolvedValue(mockCiphers);
    memberCipherDetailsService.getMemberCipherDetails.mockResolvedValue(mockMemberCipherDetails);

    // Mock encryption/decryption
    mockRiskInsightsEncryptionService.encryptRiskInsightsReport.mockResolvedValue({
      organizationId: mockOrganizationId,
      encryptedData: mockEncryptedText.encryptedString,
      contentEncryptionKey: mockEncryptedKey.encryptedString,
    });

    mockRiskInsightsEncryptionService.decryptRiskInsightsReport.mockResolvedValue({
      data: [],
      summary: {
        totalMemberCount: 0,
        totalAtRiskMemberCount: 0,
        totalApplicationCount: 0,
        totalAtRiskApplicationCount: 0,
      },
    });

    // Mock API calls
    mockRiskInsightsApiService.saveRiskInsightsReport$.mockReturnValue(of({ id: mockReportId }));
    mockRiskInsightsApiService.getRiskInsightsReport$.mockReturnValue(
      of({
        id: mockReportId,
        organizationId: mockOrganizationId,
        date: mockReportDate,
        reportData: mockEncryptedText.encryptedString,
        contentEncryptionKey: mockEncryptedKey.encryptedString,
      }),
    );

    service = new RiskInsightsReportService(
      passwordHealthService,
      cipherService,
      memberCipherDetailsService,
      mockRiskInsightsApiService,
      mockRiskInsightsEncryptionService,
    );
  });

  it("should generate applications health report data correctly", async () => {
    const result = await firstValueFrom(service.generateApplicationsReport$(mockOrganizationId));

    expect(result).toHaveLength(8);

    // Two ciphers have google.com associated with them
    const googleTestResults = result.filter((x) => x.applicationName === "google.com");
    expect(googleTestResults).toHaveLength(1);
    const googleTest = googleTestResults[0];

    // Verify member count (should be unique across ciphers)
    expect(googleTest.memberCount).toEqual(4);
    expect(googleTest.passwordCount).toEqual(2);
    expect(googleTest.atRiskMemberDetails).toHaveLength(4);
    expect(googleTest.atRiskPasswordCount).toEqual(2);

    // Test 101domain.com aggregation
    const domain101TestResults = result.filter((x) => x.applicationName === "101domain.com");
    expect(domain101TestResults).toHaveLength(1);
    const domain101Test = domain101TestResults[0];
    expect(domain101Test.passwordCount).toEqual(2);
    expect(domain101Test.atRiskPasswordCount).toEqual(1);
    expect(domain101Test.memberCount).toEqual(5);
    expect(domain101Test.atRiskMemberDetails).toHaveLength(2);
  });

  it("should generate applications summary data correctly", async () => {
    const reportResult = await firstValueFrom(
      service.generateApplicationsReport$(mockOrganizationId),
    );
    const reportSummary = service.generateApplicationsSummary(reportResult);

    expect(reportSummary.totalMemberCount).toEqual(7);
    expect(reportSummary.totalAtRiskMemberCount).toEqual(6);
    expect(reportSummary.totalApplicationCount).toEqual(8);
    expect(reportSummary.totalAtRiskApplicationCount).toEqual(7);
  });

  it("should save report correctly", async () => {
    const mockReport: ApplicationHealthReportDetail[] = []; // Your mock application health report
    const mockSummary = {
      totalMemberCount: 10,
      totalAtRiskMemberCount: 5,
      totalApplicationCount: 3,
      totalAtRiskApplicationCount: 2,
    };

    const result = await firstValueFrom(
      service.saveReport$(mockReport, mockSummary, {
        organizationId: mockOrganizationId,
        userId: mockUserId,
      }),
    );

    expect(mockRiskInsightsEncryptionService.encryptRiskInsightsReport).toHaveBeenCalledWith(
      mockOrganizationId,
      mockUserId,
      { data: mockReport, summary: mockSummary },
    );
    expect(mockRiskInsightsApiService.saveRiskInsightsReport$).toHaveBeenCalled();
    expect(result).toStrictEqual({ id: "report-id" });
  });

  it("should get risk insights report correctly", async () => {
    const result = await firstValueFrom(
      service.getRiskInsightsReport$(mockOrganizationId, mockUserId),
    );

    expect(mockRiskInsightsApiService.getRiskInsightsReport$).toHaveBeenCalledWith(
      mockOrganizationId,
    );
    expect(result).toEqual({
      data: [],
      summary: {
        totalMemberCount: 0,
        totalAtRiskMemberCount: 0,
        totalApplicationCount: 0,
        totalAtRiskApplicationCount: 0,
      },
    });
  });

  it("should handle empty risk insights report response", async () => {
    mockRiskInsightsApiService.getRiskInsightsReport$.mockReturnValue(of(null));

    const result = await firstValueFrom(
      service.getRiskInsightsReport$(mockOrganizationId, mockUserId),
    );

    expect(result).toEqual({
      data: [],
      summary: {
        totalMemberCount: 0,
        totalAtRiskMemberCount: 0,
        totalApplicationCount: 0,
        totalAtRiskApplicationCount: 0,
      },
    });
  });
});
