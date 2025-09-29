import { mock } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { KeyGenerationService } from "@bitwarden/common/key-management/crypto";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { makeSymmetricCryptoKey } from "@bitwarden/common/spec";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { OrgKey } from "@bitwarden/common/types/key";
import { KeyService } from "@bitwarden/key-management";

import { EncryptedReportData, DecryptedReportData } from "../models";
import { mockApplicationsData, mockReportData, mockSummaryData } from "../models/mock-data";

import { RiskInsightsEncryptionService } from "./risk-insights-encryption.service";

describe("RiskInsightsEncryptionService", () => {
  let service: RiskInsightsEncryptionService;
  const mockKeyService = mock<KeyService>();
  const mockEncryptService = mock<EncryptService>();
  const mockKeyGenerationService = mock<KeyGenerationService>();

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
    );

    jest.clearAllMocks();

    // Always use the same contentEncryptionKey for both encrypt and decrypt tests
    mockKeyGenerationService.createKey.mockResolvedValue(contentEncryptionKey);
    mockEncryptService.wrapSymmetricKey.mockResolvedValue(new EncString(ENCRYPTED_KEY));
    mockEncryptService.encryptString.mockResolvedValue(new EncString(ENCRYPTED_TEXT));
    mockEncryptService.unwrapSymmetricKey.mockResolvedValue(contentEncryptionKey);
    mockEncryptService.decryptString.mockResolvedValue(JSON.stringify(testData));
    mockKeyService.orgKeys$.mockReturnValue(orgKey$);

    mockKey = new EncString("wrapped-key");
    mockEncryptedData = {
      encryptedReportData: new EncString(JSON.stringify(mockReportData)),
      encryptedSummaryData: new EncString(JSON.stringify(mockSummaryData)),
      encryptedApplicationsData: new EncString(JSON.stringify(mockApplicationsData)),
    };
    mockDecryptedData = {
      reportData: mockReportData,
      summaryData: mockSummaryData,
      applicationsData: mockApplicationsData,
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
      expect(mockKeyGenerationService.createKey).toHaveBeenCalledWith(512);

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
        JSON.stringify(mockDecryptedData.applicationsData),
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
        encryptedApplicationsData: new EncString(ENCRYPTED_TEXT),
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
      // Arrange: setup our mocks
      mockKeyService.orgKeys$.mockReturnValue(orgKey$);
      mockEncryptService.unwrapSymmetricKey.mockResolvedValue(contentEncryptionKey);
      mockEncryptService.decryptString.mockResolvedValue(JSON.stringify(testData));

      // act: call the decrypt method - with any params
      // actual decryption does not happen here,
      // we just want to ensure the method calls are correct
      const result = await service.decryptRiskInsightsReport(
        { organizationId: orgId, userId },
        mockEncryptedData,
        mockKey,
      );

      expect(mockKeyService.orgKeys$).toHaveBeenCalledWith(userId);
      expect(mockEncryptService.unwrapSymmetricKey).toHaveBeenCalledWith(mockKey, orgKey);
      expect(mockEncryptService.decryptString).toHaveBeenCalledTimes(3);

      // Mock decrypt returns JSON.stringify(testData)
      expect(result).toEqual({
        reportData: testData,
        summaryData: testData,
        applicationsData: testData,
      });
    });

    it("should invoke data type validation method during decryption", async () => {
      // Arrange: setup our mocks
      mockKeyService.orgKeys$.mockReturnValue(orgKey$);
      mockEncryptService.unwrapSymmetricKey.mockResolvedValue(contentEncryptionKey);
      mockEncryptService.decryptString.mockResolvedValue(JSON.stringify(testData));

      // act: call the decrypt method - with any params
      // actual decryption does not happen here,
      // we just want to ensure the method calls are correct
      const result = await service.decryptRiskInsightsReport(
        { organizationId: orgId, userId },
        mockEncryptedData,
        mockKey,
      );

      expect(result).toEqual({
        reportData: testData,
        summaryData: testData,
        applicationsData: testData,
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

    it("should return null if decrypt throws", async () => {
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
  });
});
