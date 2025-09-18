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
  });

  describe("encryptRiskInsightsReport", () => {
    it("should encrypt data and return encrypted packet", async () => {
      // arrange: setup our mocks
      mockKeyService.orgKeys$.mockReturnValue(orgKey$);

      // Act: call the method under test
      const result = await service.encryptRiskInsightsReport(orgId, userId, testData);

      // Assert: ensure that the methods were called with the expected parameters
      expect(mockKeyService.orgKeys$).toHaveBeenCalledWith(userId);
      expect(mockKeyGenerationService.createKey).toHaveBeenCalledWith(512);
      expect(mockEncryptService.encryptString).toHaveBeenCalledWith(
        JSON.stringify(testData),
        contentEncryptionKey,
      );
      expect(mockEncryptService.wrapSymmetricKey).toHaveBeenCalledWith(
        contentEncryptionKey,
        orgKey,
      );
      expect(result).toEqual({
        organizationId: orgId,
        encryptedData: ENCRYPTED_TEXT,
        encryptionKey: ENCRYPTED_KEY,
      });
    });

    it("should throw an error when encrypted text is null or empty", async () => {
      // arrange: setup our mocks
      mockKeyService.orgKeys$.mockReturnValue(orgKey$);
      mockEncryptService.encryptString.mockResolvedValue(new EncString(""));
      mockEncryptService.wrapSymmetricKey.mockResolvedValue(new EncString(ENCRYPTED_KEY));

      // Act & Assert: call the method under test and expect rejection
      await expect(service.encryptRiskInsightsReport(orgId, userId, testData)).rejects.toThrow(
        "Encryption failed, encrypted strings are null",
      );
    });

    it("should throw an error when encrypted key is null or empty", async () => {
      // arrange: setup our mocks
      mockKeyService.orgKeys$.mockReturnValue(orgKey$);
      mockEncryptService.encryptString.mockResolvedValue(new EncString(ENCRYPTED_TEXT));
      mockEncryptService.wrapSymmetricKey.mockResolvedValue(new EncString(""));

      // Act & Assert: call the method under test and expect rejection
      await expect(service.encryptRiskInsightsReport(orgId, userId, testData)).rejects.toThrow(
        "Encryption failed, encrypted strings are null",
      );
    });

    it("should throw if org key is not found", async () => {
      // when we cannot get an organization key, we should throw an error
      mockKeyService.orgKeys$.mockReturnValue(new BehaviorSubject({}));

      await expect(service.encryptRiskInsightsReport(orgId, userId, testData)).rejects.toThrow(
        "Organization key not found",
      );
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
        orgId,
        userId,
        new EncString("encrypted-data"),
        new EncString("wrapped-key"),
        (data) => data as typeof testData,
      );

      expect(mockKeyService.orgKeys$).toHaveBeenCalledWith(userId);
      expect(mockEncryptService.unwrapSymmetricKey).toHaveBeenCalledWith(
        new EncString("wrapped-key"),
        orgKey,
      );
      expect(mockEncryptService.decryptString).toHaveBeenCalledWith(
        new EncString("encrypted-data"),
        contentEncryptionKey,
      );
      expect(result).toEqual(testData);
    });

    it("should invoke data type validation method during decryption", async () => {
      // Arrange: setup our mocks
      mockKeyService.orgKeys$.mockReturnValue(orgKey$);
      mockEncryptService.unwrapSymmetricKey.mockResolvedValue(contentEncryptionKey);
      mockEncryptService.decryptString.mockResolvedValue(JSON.stringify(testData));
      const mockParseFn = jest.fn((data) => data as typeof testData);

      // act: call the decrypt method - with any params
      // actual decryption does not happen here,
      // we just want to ensure the method calls are correct
      const result = await service.decryptRiskInsightsReport(
        orgId,
        userId,
        new EncString("encrypted-data"),
        new EncString("wrapped-key"),
        mockParseFn,
      );

      expect(mockParseFn).toHaveBeenCalledWith(JSON.parse(JSON.stringify(testData)));
      expect(result).toEqual(testData);
    });

    it("should return null if org key is not found", async () => {
      mockKeyService.orgKeys$.mockReturnValue(new BehaviorSubject({}));

      const result = await service.decryptRiskInsightsReport(
        orgId,
        userId,
        new EncString("encrypted-data"),
        new EncString("wrapped-key"),
        (data) => data as typeof testData,
      );

      expect(result).toBeNull();
    });

    it("should return null if decrypt throws", async () => {
      mockKeyService.orgKeys$.mockReturnValue(orgKey$);
      mockEncryptService.unwrapSymmetricKey.mockRejectedValue(new Error("fail"));

      const result = await service.decryptRiskInsightsReport(
        orgId,
        userId,
        new EncString("encrypted-data"),
        new EncString("wrapped-key"),
        (data) => data as typeof testData,
      );
      expect(result).toBeNull();
    });

    it("should return null if decrypt throws", async () => {
      mockKeyService.orgKeys$.mockReturnValue(orgKey$);
      mockEncryptService.unwrapSymmetricKey.mockRejectedValue(new Error("fail"));

      const result = await service.decryptRiskInsightsReport(
        orgId,
        userId,
        new EncString("encrypted-data"),
        new EncString("wrapped-key"),
        (data) => data as typeof testData,
      );
      expect(result).toBeNull();
    });

    it("should return null if decrypt throws", async () => {
      mockKeyService.orgKeys$.mockReturnValue(orgKey$);
      mockEncryptService.unwrapSymmetricKey.mockRejectedValue(new Error("fail"));

      const result = await service.decryptRiskInsightsReport(
        orgId,
        userId,
        new EncString("encrypted-data"),
        new EncString("wrapped-key"),
        (data) => data as typeof testData,
      );
      expect(result).toBeNull();
    });
  });
});
