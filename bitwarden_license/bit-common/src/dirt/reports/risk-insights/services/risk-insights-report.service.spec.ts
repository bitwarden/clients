import { mock } from "jest-mock-extended";
import { firstValueFrom, of } from "rxjs";

import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { createNewSummaryData } from "../helpers";
import {
  GetRiskInsightsReportResponse,
  SaveRiskInsightsReportResponse,
} from "../models/api-models.types";
import { EncryptedDataWithKey } from "../models/password-health";
import {
  ApplicationHealthReportDetail,
  OrganizationReportSummary,
  RiskInsightsReportData,
} from "../models/report-models";
import { MemberCipherDetailsResponse } from "../response/member-cipher-details.response";

import { mockCiphers } from "./ciphers.mock";
import { MemberCipherDetailsApiService } from "./member-cipher-details-api.service";
import { mockMemberCipherDetails } from "./member-cipher-details-api.service.spec";
import { PasswordHealthService } from "./password-health.service";
import { RiskInsightsApiService } from "./risk-insights-api.service";
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
  const ENCRYPTED_TEXT = "This data has been encrypted";
  const ENCRYPTED_KEY = "Re-encrypted Cipher Key";
  const mockEncryptedText = new EncString(ENCRYPTED_TEXT);
  const mockEncryptedKey = new EncString(ENCRYPTED_KEY);

  // Changing mock data
  let mockCipherViews: CipherView[];
  let mockMemberDetails: MemberCipherDetailsResponse[];
  let mockReport: ApplicationHealthReportDetail[];
  let mockSummary: OrganizationReportSummary;
  let mockEncryptedReport: EncryptedDataWithKey;

  beforeEach(() => {
    cipherService.getAllFromApiForOrganization.mockResolvedValue(mockCiphers);

    memberCipherDetailsService.getMemberCipherDetails.mockResolvedValue(mockMemberCipherDetails);

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
      cipherService,
      memberCipherDetailsService,
      mockRiskInsightsApiService,
      mockRiskInsightsEncryptionService,
      mockPasswordHealthService,
    );

    // Reset mock ciphers before each test
    mockCipherViews = [
      mock<CipherView>({
        id: "cipher-1",
        type: CipherType.Login,
        login: { password: "pass1", username: "user1", uris: [{ uri: "https://app.com/login" }] },
        isDeleted: false,
        viewPassword: true,
      }),
      mock<CipherView>({
        id: "cipher-2",
        type: CipherType.Login,
        login: { password: "pass2", username: "user2", uris: [{ uri: "app.com/home" }] },
        isDeleted: false,
        viewPassword: true,
      }),
      mock<CipherView>({
        id: "cipher-3",
        type: CipherType.Login,
        login: { password: "pass3", username: "user3", uris: [{ uri: "https://other.com" }] },
        isDeleted: false,
        viewPassword: true,
      }),
    ];
    mockMemberDetails = [
      mock<MemberCipherDetailsResponse>({
        cipherIds: ["cipher-1"],
        userGuid: "user1",
        userName: "User 1",
        email: "user1@app.com",
      }),
      mock<MemberCipherDetailsResponse>({
        cipherIds: ["cipher-2"],
        userGuid: "user2",
        userName: "User 2",
        email: "user2@app.com",
      }),
      mock<MemberCipherDetailsResponse>({
        cipherIds: ["cipher-3"],
        userGuid: "user3",
        userName: "User 3",
        email: "user3@other.com",
      }),
    ];

    mockReport = [
      {
        applicationName: "app1",
        passwordCount: 0,
        atRiskPasswordCount: 0,
        atRiskCipherIds: [],
        memberCount: 0,
        atRiskMemberCount: 0,
        memberDetails: [],
        atRiskMemberDetails: [],
        cipherIds: [],
      },
    ];
    mockSummary = createNewSummaryData();

    mockEncryptedReport = {
      organizationId: mockOrganizationId,
      encryptedData: mockEncryptedText,
      contentEncryptionKey: mockEncryptedKey,
    };
  });

  it("should group and aggregate application health reports correctly", (done) => {
    // Mock the service methods
    cipherService.getAllFromApiForOrganization.mockResolvedValue(mockCipherViews);
    memberCipherDetailsService.getMemberCipherDetails.mockResolvedValue(mockMemberDetails);

    service.generateApplicationsReport$("orgId" as any).subscribe((result) => {
      expect(Array.isArray(result)).toBe(true);

      // Should group by application name (trimmedUris)
      const appCom = result.find((r) => r.applicationName === "app.com");
      const otherCom = result.find((r) => r.applicationName === "other.com");
      expect(appCom).toBeTruthy();
      expect(appCom?.passwordCount).toBe(2);
      expect(otherCom).toBeTruthy();
      expect(otherCom?.passwordCount).toBe(1);
      done();
    });
  });

  it("should generate the raw data report correctly", async () => {
    const result = await firstValueFrom(service.LEGACY_generateRawDataReport$(mockOrganizationId));

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
    const result = await firstValueFrom(service.generateRawDataUriReport$(mockOrganizationId));

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
    const result = await firstValueFrom(
      service.LEGACY_generateApplicationsReport$(mockOrganizationId),
    );

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
    const reportResult = await firstValueFrom(
      service.LEGACY_generateApplicationsReport$(mockOrganizationId),
    );
    const reportSummary = service.generateApplicationsSummary(reportResult);

    expect(reportSummary.totalMemberCount).toEqual(7);
    expect(reportSummary.totalAtRiskMemberCount).toEqual(6);
    expect(reportSummary.totalApplicationCount).toEqual(8);
    expect(reportSummary.totalAtRiskApplicationCount).toEqual(7);
  });

  describe("saveRiskInsightsReport$", () => {
    it("should not update subjects if save response does not have id", (done) => {
      mockRiskInsightsEncryptionService.encryptRiskInsightsReport.mockResolvedValue(
        mockEncryptedReport,
      );

      const saveResponse = new SaveRiskInsightsReportResponse({ id: "" }); // Simulating no ID in response
      mockRiskInsightsApiService.saveRiskInsightsReport$.mockReturnValue(of(saveResponse));

      service
        .saveRiskInsightsReport$(mockReport, mockSummary, {
          organizationId: mockOrganizationId,
          userId: mockUserId,
        })
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

    it("should encrypt and save report, then update subjects", async () => {});
  });

  describe("getRiskInsightsReport$", () => {
    beforeEach(() => {
      // Reset the mocks before each test
      jest.clearAllMocks();
    });

    it("should call with the correct organizationId", async () => {
      // we need to ensure that the api is invoked with the specified organizationId
      // here it doesn't matter what the Api returns
      const apiResponse = {
        id: "reportId",
        date: new Date().toISOString(),
        organizationId: mockOrganizationId,
        reportData: mockEncryptedReport.encryptedData,
        contentEncryptionKey: mockEncryptedReport.contentEncryptionKey,
      } as GetRiskInsightsReportResponse;

      const decryptedResponse: RiskInsightsReportData = {
        data: [],
        summary: {
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
      };

      const organizationId = "orgId" as OrganizationId;
      const userId = "userId" as UserId;

      // Mock api returned encrypted data
      mockRiskInsightsApiService.getRiskInsightsReport$.mockReturnValue(of(apiResponse));

      // Mock decrypted data
      mockRiskInsightsEncryptionService.decryptRiskInsightsReport.mockReturnValue(
        Promise.resolve(decryptedResponse),
      );

      await firstValueFrom(service.getRiskInsightsReport$(organizationId, userId));

      expect(mockRiskInsightsApiService.getRiskInsightsReport$).toHaveBeenCalledWith(
        organizationId,
      );
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
        reportData: mockEncryptedReport.encryptedData,
        contentEncryptionKey: mockEncryptedReport.contentEncryptionKey,
      } as GetRiskInsightsReportResponse;

      const decryptedReport = {
        data: [{ foo: "bar" }],
      };
      mockRiskInsightsApiService.getRiskInsightsReport$.mockReturnValue(of(mockResponse));
      mockRiskInsightsEncryptionService.decryptRiskInsightsReport.mockResolvedValue(
        decryptedReport,
      );

      const result = await firstValueFrom(service.getRiskInsightsReport$(organizationId, userId));

      expect(mockRiskInsightsEncryptionService.decryptRiskInsightsReport).toHaveBeenCalledWith(
        organizationId,
        userId,
        expect.anything(),
        expect.anything(),
        expect.any(Function),
      );
      expect(result).toEqual(decryptedReport);
    });
  });
});
