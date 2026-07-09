import { mock } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { KeyGenerationService } from "@bitwarden/common/key-management/crypto";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { SdkLoadService } from "@bitwarden/common/platform/abstractions/sdk/sdk-load.service";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { makeSymmetricCryptoKey } from "@bitwarden/common/spec";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { OrgKey } from "@bitwarden/common/types/key";
import { KeyService } from "@bitwarden/key-management";
import { LogService } from "@bitwarden/logging";
import { PureCrypto } from "@bitwarden/sdk-internal";

import { EncryptedReportData, DecryptedReportData } from "../../models";
import { mockApplicationData, mockReportData, mockSummaryData } from "../../models/mocks/mock-data";

import { RiskInsightsEncryptionService } from "./risk-insights-encryption.service";

describe("RiskInsightsEncryptionService", () => {
  let service: RiskInsightsEncryptionService;
  const mockKeyService = mock<KeyService>();
  const mockEncryptService = mock<EncryptService>();
  const mockKeyGenerationService = mock<KeyGenerationService>();
  const mockLogService = mock<LogService>();

  const ENCRYPTED_TEXT = "This data has been encrypted";
  const ENCRYPTED_KEY = "Re-encrypted Cipher Key";
  const orgId = "org-123" as OrganizationId;
  const userId = "user-123" as UserId;
  const orgKey = makeSymmetricCryptoKey<OrgKey>();
  const contentEncryptionKey = new SymmetricCryptoKey(new Uint8Array(64));
  const testData = { foo: "bar" };
  const OrgRecords: Record<OrganizationId, OrgKey> = {
    [orgId]: orgKey,
    ["testOrg" as OrganizationId]: makeSymmetricCryptoKey<OrgKey>(),
  };
  const orgKey$ = new BehaviorSubject(OrgRecords);

  let mockDecryptedData: DecryptedReportData;
  let mockEncryptedData: EncryptedReportData;
  let mockKey: EncString;

  beforeEach(() => {
    service = new RiskInsightsEncryptionService(
      mockKeyService,
      mockEncryptService,
      mockKeyGenerationService,
      mockLogService,
    );

    jest.clearAllMocks();

    Object.defineProperty(SdkLoadService, "Ready", {
      value: Promise.resolve(),
      configurable: true,
    });
    jest.spyOn(PureCrypto, "make_aes256_cbc_hmac_key").mockReturnValue({} as any);
    jest.spyOn(SymmetricCryptoKey, "fromSdk").mockReturnValue(contentEncryptionKey);
    mockEncryptService.wrapSymmetricKey.mockResolvedValue(new EncString(ENCRYPTED_KEY));
    mockEncryptService.encryptString.mockResolvedValue(new EncString(ENCRYPTED_TEXT));
    mockEncryptService.unwrapSymmetricKey.mockResolvedValue(contentEncryptionKey);
    mockEncryptService.decryptString.mockResolvedValue(JSON.stringify(testData));
    mockKeyService.orgKeys$.mockReturnValue(orgKey$);

    mockKey = new EncString("wrapped-key");
    mockEncryptedData = {
      encryptedReportData: new EncString(JSON.stringify(mockReportData)),
      encryptedSummaryData: new EncString(JSON.stringify(mockSummaryData)),
      encryptedApplicationData: new EncString(JSON.stringify(mockApplicationData)),
    };
    mockDecryptedData = {
      reportData: mockReportData,
      summaryData: mockSummaryData,
      applicationData: mockApplicationData,
    };
  });

  describe("encryptRiskInsightsReport", () => {
    it("should encrypt data and return encrypted packet", async () => {
      // arrange: setup our mocks
      mockKeyService.orgKeys$.mockReturnValue(orgKey$);

      // Act: call the method under test
      const result = await service.encryptRiskInsightsReport(
        { organizationId: orgId, userId },
        mockDecryptedData,
      );

      // Assert: ensure that the methods were called with the expected parameters
      expect(mockKeyService.orgKeys$).toHaveBeenCalledWith(userId);
      expect(PureCrypto.make_aes256_cbc_hmac_key).toHaveBeenCalled();

      // Assert all variables were encrypted
      expect(mockEncryptService.encryptString).toHaveBeenCalledWith(
        JSON.stringify(mockDecryptedData.reportData),
        contentEncryptionKey,
      );
      expect(mockEncryptService.encryptString).toHaveBeenCalledWith(
        JSON.stringify(mockDecryptedData.summaryData),
        contentEncryptionKey,
      );
      expect(mockEncryptService.encryptString).toHaveBeenCalledWith(
        JSON.stringify(mockDecryptedData.applicationData),
        contentEncryptionKey,
      );

      expect(mockEncryptService.wrapSymmetricKey).toHaveBeenCalledWith(
        contentEncryptionKey,
        orgKey,
      );

      // Mocked encrypt returns ENCRYPTED_TEXT
      expect(result).toEqual({
        organizationId: orgId,
        encryptedReportData: new EncString(ENCRYPTED_TEXT),
        encryptedSummaryData: new EncString(ENCRYPTED_TEXT),
        encryptedApplicationData: new EncString(ENCRYPTED_TEXT),
        contentEncryptionKey: new EncString(ENCRYPTED_KEY),
      });
    });

    it("should throw an error when encrypted text is null or empty", async () => {
      // arrange: setup our mocks
      mockKeyService.orgKeys$.mockReturnValue(orgKey$);
      mockEncryptService.encryptString.mockResolvedValue(new EncString(""));
      mockEncryptService.wrapSymmetricKey.mockResolvedValue(new EncString(ENCRYPTED_KEY));

      // Act & Assert: call the method under test and expect rejection
      await expect(
        service.encryptRiskInsightsReport({ organizationId: orgId, userId }, mockDecryptedData),
      ).rejects.toThrow("Encryption failed, encrypted strings are null");
    });

    it("should throw an error when encrypted key is null or empty", async () => {
      // arrange: setup our mocks
      mockKeyService.orgKeys$.mockReturnValue(orgKey$);
      mockEncryptService.encryptString.mockResolvedValue(new EncString(ENCRYPTED_TEXT));
      mockEncryptService.wrapSymmetricKey.mockResolvedValue(new EncString(""));

      // Act & Assert: call the method under test and expect rejection
      await expect(
        service.encryptRiskInsightsReport({ organizationId: orgId, userId }, mockDecryptedData),
      ).rejects.toThrow("Encryption failed, encrypted strings are null");
    });

    it("should throw if org key is not found", async () => {
      // when we cannot get an organization key, we should throw an error
      mockKeyService.orgKeys$.mockReturnValue(new BehaviorSubject({}));

      await expect(
        service.encryptRiskInsightsReport({ organizationId: orgId, userId }, mockDecryptedData),
      ).rejects.toThrow("Organization key not found");
    });
  });

  describe("decryptRiskInsightsReport", () => {
    it("should decrypt data and return original object", async () => {
      // Arrange: setup our mocks with valid data structures
      mockKeyService.orgKeys$.mockReturnValue(orgKey$);
      mockEncryptService.unwrapSymmetricKey.mockResolvedValue(contentEncryptionKey);

      // Mock decryption to return valid data for each call
      mockEncryptService.decryptString
        .mockResolvedValueOnce(JSON.stringify(mockReportData))
        .mockResolvedValueOnce(JSON.stringify(mockSummaryData))
        .mockResolvedValueOnce(JSON.stringify(mockApplicationData));

      // act: call the decrypt method
      const result = await service.decryptRiskInsightsReport(
        { organizationId: orgId, userId },
        mockEncryptedData,
        mockKey,
      );

      expect(mockKeyService.orgKeys$).toHaveBeenCalledWith(userId);
      expect(mockEncryptService.unwrapSymmetricKey).toHaveBeenCalledWith(mockKey, orgKey);
      expect(mockEncryptService.decryptString).toHaveBeenCalledTimes(3);

      // Verify decrypted data matches the mocked valid data
      expect(result).toEqual({
        reportData: mockReportData,
        summaryData: mockSummaryData,
        applicationData: mockApplicationData,
      });
    });

    it("should invoke data type validation method during decryption", async () => {
      // Arrange: setup our mocks with valid data structures
      mockKeyService.orgKeys$.mockReturnValue(orgKey$);
      mockEncryptService.unwrapSymmetricKey.mockResolvedValue(contentEncryptionKey);

      // Mock decryption to return valid data for each call
      mockEncryptService.decryptString
        .mockResolvedValueOnce(JSON.stringify(mockReportData))
        .mockResolvedValueOnce(JSON.stringify(mockSummaryData))
        .mockResolvedValueOnce(JSON.stringify(mockApplicationData));

      // act: call the decrypt method
      const result = await service.decryptRiskInsightsReport(
        { organizationId: orgId, userId },
        mockEncryptedData,
        mockKey,
      );

      // Verify that validation passed and returned the correct data
      expect(result).toEqual({
        reportData: mockReportData,
        summaryData: mockSummaryData,
        applicationData: mockApplicationData,
      });
    });

    it("should return null if org key is not found", async () => {
      mockKeyService.orgKeys$.mockReturnValue(new BehaviorSubject({}));
      await expect(
        service.decryptRiskInsightsReport(
          { organizationId: orgId, userId },

          mockEncryptedData,
          mockKey,
        ),
      ).rejects.toEqual(Error("Organization key not found"));
    });

    it("should throw if decrypt throws", async () => {
      mockKeyService.orgKeys$.mockReturnValue(orgKey$);
      mockEncryptService.unwrapSymmetricKey.mockRejectedValue(new Error("fail"));

      await expect(
        service.decryptRiskInsightsReport(
          { organizationId: orgId, userId },

          mockEncryptedData,
          mockKey,
        ),
      ).rejects.toEqual(Error("fail"));
    });

    it("should drop invalid report elements and log a warning", async () => {
      mockKeyService.orgKeys$.mockReturnValue(orgKey$);
      mockEncryptService.unwrapSymmetricKey.mockResolvedValue(contentEncryptionKey);

      mockEncryptService.decryptString
        .mockResolvedValueOnce(JSON.stringify([{ invalid: "data" }])) // invalid report data
        .mockResolvedValueOnce(JSON.stringify(mockSummaryData))
        .mockResolvedValueOnce(JSON.stringify(mockApplicationData));

      const result = await service.decryptRiskInsightsReport(
        { organizationId: orgId, userId },
        mockEncryptedData,
        mockKey,
      );

      expect(result.reportData).toEqual([]);
      expect(mockLogService.warning).toHaveBeenCalledWith(
        expect.stringContaining("Dropped 1 invalid report element"),
      );
    });

    it("should default invalid summary fields to 0 and log a warning", async () => {
      mockKeyService.orgKeys$.mockReturnValue(orgKey$);
      mockEncryptService.unwrapSymmetricKey.mockResolvedValue(contentEncryptionKey);

      mockEncryptService.decryptString.mockReset();
      mockEncryptService.decryptString
        .mockResolvedValueOnce(JSON.stringify(mockReportData))
        .mockResolvedValueOnce(JSON.stringify({ totalMemberCount: "10" })) // wrong type
        .mockResolvedValueOnce(JSON.stringify(mockApplicationData));

      const result = await service.decryptRiskInsightsReport(
        { organizationId: orgId, userId },
        mockEncryptedData,
        mockKey,
      );

      expect(result.summaryData.totalMemberCount).toBe(0);
      expect(mockLogService.warning).toHaveBeenCalledWith(
        expect.stringContaining("Defaulted 1 invalid summary field"),
      );
    });

    it("should drop invalid application elements and log a warning", async () => {
      mockKeyService.orgKeys$.mockReturnValue(orgKey$);
      mockEncryptService.unwrapSymmetricKey.mockResolvedValue(contentEncryptionKey);

      mockEncryptService.decryptString.mockReset();
      mockEncryptService.decryptString
        .mockResolvedValueOnce(JSON.stringify(mockReportData))
        .mockResolvedValueOnce(JSON.stringify(mockSummaryData))
        .mockResolvedValueOnce(JSON.stringify([{ invalid: "application" }]));

      const result = await service.decryptRiskInsightsReport(
        { organizationId: orgId, userId },
        mockEncryptedData,
        mockKey,
      );

      expect(result.applicationData).toEqual([]);
      expect(mockLogService.warning).toHaveBeenCalledWith(
        expect.stringContaining("Dropped 1 invalid application element"),
      );
    });

    it("should drop application elements with invalid date strings", async () => {
      mockKeyService.orgKeys$.mockReturnValue(orgKey$);
      mockEncryptService.unwrapSymmetricKey.mockResolvedValue(contentEncryptionKey);

      const invalidApplicationData = [
        {
          applicationName: "Test App",
          isCritical: true,
          reviewedDate: "invalid-date-string",
        },
      ];

      mockEncryptService.decryptString.mockReset();
      mockEncryptService.decryptString
        .mockResolvedValueOnce(JSON.stringify(mockReportData))
        .mockResolvedValueOnce(JSON.stringify(mockSummaryData))
        .mockResolvedValueOnce(JSON.stringify(invalidApplicationData));

      const result = await service.decryptRiskInsightsReport(
        { organizationId: orgId, userId },
        mockEncryptedData,
        mockKey,
      );

      expect(result.applicationData).toEqual([]);
      expect(mockLogService.warning).toHaveBeenCalled();
    });

    it("should throw when report data is not an array (structural failure)", async () => {
      mockKeyService.orgKeys$.mockReturnValue(orgKey$);
      mockEncryptService.unwrapSymmetricKey.mockResolvedValue(contentEncryptionKey);

      mockEncryptService.decryptString.mockReset();
      mockEncryptService.decryptString
        .mockResolvedValueOnce(JSON.stringify({ not: "an array" }))
        .mockResolvedValueOnce(JSON.stringify(mockSummaryData))
        .mockResolvedValueOnce(JSON.stringify(mockApplicationData));

      await expect(
        service.decryptRiskInsightsReport(
          { organizationId: orgId, userId },
          mockEncryptedData,
          mockKey,
        ),
      ).rejects.toThrow(
        /Report data validation failed.*This may indicate data corruption or tampering/,
      );
    });
  });
});
