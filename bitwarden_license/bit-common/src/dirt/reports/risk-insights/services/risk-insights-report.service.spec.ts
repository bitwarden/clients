import { mock } from "jest-mock-extended";
import { firstValueFrom, of } from "rxjs";
import { ZXCVBNResult } from "zxcvbn";

import { AuditService } from "@bitwarden/common/abstractions/audit.service";
import { EncryptedString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { PasswordStrengthServiceAbstraction } from "@bitwarden/common/tools/password-strength";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";

import { GetRiskInsightsReportResponse } from "../models/password-health";

import { mockCiphers } from "./ciphers.mock";
import { MemberCipherDetailsApiService } from "./member-cipher-details-api.service";
import { mockMemberCipherDetails } from "./member-cipher-details-api.service.spec";
import { RiskInsightsApiService } from "./risk-insights-api.service";
import { RiskInsightsEncryptionService } from "./risk-insights-encryption.service";
import { RiskInsightsReportService } from "./risk-insights-report.service";

describe("RiskInsightsReportService", () => {
  let service: RiskInsightsReportService;
  const pwdStrengthService = mock<PasswordStrengthServiceAbstraction>();
  const auditService = mock<AuditService>();
  const cipherService = mock<CipherService>();
  const memberCipherDetailsService = mock<MemberCipherDetailsApiService>();
  const mockRiskInsightsApiService = mock<RiskInsightsApiService>();
  const mockRiskInsightsEncryptionService = mock<RiskInsightsEncryptionService>({
    encryptRiskInsightsReport: jest.fn().mockResolvedValue("encryptedReportData"),
    decryptRiskInsightsReport: jest.fn().mockResolvedValue("decryptedReportData"),
  });
  const orgId = "orgId" as OrganizationId;

  beforeEach(() => {
    pwdStrengthService.getPasswordStrength.mockImplementation((password: string) => {
      const score = password.length < 4 ? 1 : 4;
      return { score } as ZXCVBNResult;
    });

    auditService.passwordLeaked.mockImplementation((password: string) =>
      Promise.resolve(password === "123" ? 100 : 0),
    );

    cipherService.getAllFromApiForOrganization.mockResolvedValue(mockCiphers);

    memberCipherDetailsService.getMemberCipherDetails.mockResolvedValue(mockMemberCipherDetails);

    service = new RiskInsightsReportService(
      pwdStrengthService,
      auditService,
      cipherService,
      memberCipherDetailsService,
      mockRiskInsightsApiService,
      mockRiskInsightsEncryptionService,
    );
  });

  it("should generate the raw data report correctly", async () => {
    const result = await firstValueFrom(service.generateRawDataReport$(orgId));

    expect(result).toHaveLength(6);

    let testCaseResults = result.filter((x) => x.id === "cbea34a8-bde4-46ad-9d19-b05001228ab1");
    expect(testCaseResults).toHaveLength(1);
    let testCase = testCaseResults[0];
    expect(testCase).toBeTruthy();
    expect(testCase.cipherMembers).toHaveLength(2);
    expect(testCase.trimmedUris).toHaveLength(5);
    expect(testCase.weakPasswordDetail).toBeTruthy();
    expect(testCase.exposedPasswordDetail).toBeTruthy();
    expect(testCase.reusedPasswordCount).toEqual(2);

    testCaseResults = result.filter((x) => x.id === "cbea34a8-bde4-46ad-9d19-b05001227tt1");
    expect(testCaseResults).toHaveLength(1);
    testCase = testCaseResults[0];
    expect(testCase).toBeTruthy();
    expect(testCase.cipherMembers).toHaveLength(1);
    expect(testCase.trimmedUris).toHaveLength(1);
    expect(testCase.weakPasswordDetail).toBeFalsy();
    expect(testCase.exposedPasswordDetail).toBeFalsy();
    expect(testCase.reusedPasswordCount).toEqual(1);
  });

  it("should generate the raw data + uri report correctly", async () => {
    const result = await firstValueFrom(service.generateRawDataUriReport$(orgId));

    expect(result).toHaveLength(11);

    // Two ciphers that have google.com as their uri. There should be 2 results
    const googleResults = result.filter((x) => x.trimmedUri === "google.com");
    expect(googleResults).toHaveLength(2);

    // There is an invalid uri and it should not be trimmed
    const invalidUriResults = result.filter((x) => x.trimmedUri === "this_is-not|a-valid-uri123@+");
    expect(invalidUriResults).toHaveLength(1);

    // Verify the details for one of the googles matches the password health info
    // expected
    const firstGoogle = googleResults.filter(
      (x) => x.cipherId === "cbea34a8-bde4-46ad-9d19-b05001228ab1" && x.trimmedUri === "google.com",
    )[0];
    expect(firstGoogle.weakPasswordDetail).toBeTruthy();
    expect(firstGoogle.exposedPasswordDetail).toBeTruthy();
    expect(firstGoogle.reusedPasswordCount).toEqual(2);
  });

  it("should generate applications health report data correctly", async () => {
    const result = await firstValueFrom(service.generateApplicationsReport$(orgId));

    expect(result).toHaveLength(8);

    // Two ciphers have google.com associated with them. The first cipher
    // has 2 members and the second has 4. However, the 2 members in the first
    // cipher are also associated with the second. The total amount of members
    // should be 4 not 6
    const googleTestResults = result.filter((x) => x.applicationName === "google.com");
    expect(googleTestResults).toHaveLength(1);
    const googleTest = googleTestResults[0];
    expect(googleTest.memberCount).toEqual(4);

    // Both ciphers have at risk passwords
    expect(googleTest.passwordCount).toEqual(2);

    // All members are at risk since both ciphers are at risk
    expect(googleTest.atRiskMemberDetails).toHaveLength(4);
    expect(googleTest.atRiskPasswordCount).toEqual(2);

    // There are 2 ciphers associated with 101domain.com
    const domain101TestResults = result.filter((x) => x.applicationName === "101domain.com");
    expect(domain101TestResults).toHaveLength(1);
    const domain101Test = domain101TestResults[0];
    expect(domain101Test.passwordCount).toEqual(2);

    // The first cipher is at risk. The second cipher is not at risk
    expect(domain101Test.atRiskPasswordCount).toEqual(1);

    // The first cipher has 2 members. The second cipher the second
    // cipher has 4. One of the members in the first cipher is associated
    // with the second. So there should be 5 members total.
    expect(domain101Test.memberCount).toEqual(5);

    // The first cipher is at risk. The total at risk members is 2 and
    // at risk password count is 1.
    expect(domain101Test.atRiskMemberDetails).toHaveLength(2);
    expect(domain101Test.atRiskPasswordCount).toEqual(1);
  });

  it("should generate applications summary data correctly", async () => {
    const reportResult = await firstValueFrom(service.generateApplicationsReport$(orgId));
    const reportSummary = service.generateApplicationsSummary(reportResult);

    expect(reportSummary.totalMemberCount).toEqual(7);
    expect(reportSummary.totalAtRiskMemberCount).toEqual(6);
    expect(reportSummary.totalApplicationCount).toEqual(8);
    expect(reportSummary.totalAtRiskApplicationCount).toEqual(7);
  });

  describe("saveRiskInsightsReport", () => {
    it("should not update subjects if save response does not have id", async () => {
      const organizationId = "orgId" as OrganizationId;
      const userId = "userId" as UserId;
      const report = [{ applicationName: "app1" }] as any;

      const encryptedReport = {
        organizationId: organizationId as OrganizationId,
        encryptedData: "encryptedData" as EncryptedString,
        encryptionKey: "encryptionKey" as EncryptedString,
      };

      mockRiskInsightsEncryptionService.encryptRiskInsightsReport.mockResolvedValue(
        encryptedReport,
      );

      const saveResponse = { id: "" }; // Simulating no ID in response
      mockRiskInsightsApiService.saveRiskInsightsReport.mockReturnValue(of(saveResponse));

      const reportSubjectSpy = jest.spyOn((service as any).riskInsightsReportSubject, "next");
      const summarySubjectSpy = jest.spyOn((service as any).riskInsightsSummarySubject, "next");

      await service.saveRiskInsightsReport(organizationId, userId, report);

      expect(reportSubjectSpy).not.toHaveBeenCalled();
      expect(summarySubjectSpy).not.toHaveBeenCalled();
    });
  });

  describe("getRiskInsightsReport", () => {
    beforeEach(() => {
      // Reset the mocks before each test
      jest.clearAllMocks();
    });

    it("should call riskInsightsApiService.getRiskInsightsReport with the correct organizationId", () => {
      // we need to ensure that the api is invoked with the specified organizationId
      // here it doesn't matter what the Api returns
      const apiResponse = {
        id: "reportId",
        date: new Date().toISOString(),
        organizationId: "orgId",
        reportData: "encryptedReportData",
        reportKey: "encryptionKey",
      } as GetRiskInsightsReportResponse;

      const organizationId = "orgId" as OrganizationId;
      const userId = "userId" as UserId;
      mockRiskInsightsApiService.getRiskInsightsReport.mockReturnValue(of(apiResponse));
      service.getRiskInsightsReport(organizationId, userId);
      expect(mockRiskInsightsApiService.getRiskInsightsReport).toHaveBeenCalledWith(organizationId);
      expect(mockRiskInsightsEncryptionService.decryptRiskInsightsReport).toHaveBeenCalledWith(
        organizationId,
        userId,
        expect.anything(), // encryptedData
        expect.anything(), // wrappedKey
        expect.any(Function), // parser
      );
    });

    it("should decrypt report and update subjects if response is present", async () => {
      // Arrange: setup a mock response from the API
      // and ensure the decryption service is called with the correct parameters
      const organizationId = "orgId" as OrganizationId;
      const userId = "userId" as UserId;

      const mockResponse = {
        id: "reportId",
        date: new Date().toISOString(),
        organizationId: organizationId as OrganizationId,
        reportData: "encryptedReportData",
        reportKey: "encryptionKey",
      } as GetRiskInsightsReportResponse;

      const decryptedReport = {
        data: [{ foo: "bar" }],
      };
      mockRiskInsightsApiService.getRiskInsightsReport.mockReturnValue(of(mockResponse));
      mockRiskInsightsEncryptionService.decryptRiskInsightsReport.mockResolvedValue(
        decryptedReport,
      );

      const reportSubjectSpy = jest.spyOn((service as any).riskInsightsReportSubject, "next");

      service.getRiskInsightsReport(organizationId, userId);

      // Wait for all microtasks to complete
      await Promise.resolve();

      expect(mockRiskInsightsEncryptionService.decryptRiskInsightsReport).toHaveBeenCalledWith(
        organizationId,
        userId,
        expect.anything(),
        expect.anything(),
        expect.any(Function),
      );
      expect(reportSubjectSpy).toHaveBeenCalledWith(decryptedReport.data);
    });
  });
});
