import { mock } from "jest-mock-extended";

import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { KeyGenerationService } from "@bitwarden/common/platform/abstractions/key-generation.service";
import { EncString } from "@bitwarden/common/platform/models/domain/enc-string";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { OrganizationId } from "@bitwarden/common/types/guid";
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
  const orgKey = "org-key" as unknown as OrgKey;
  const contentEncryptionKey = new SymmetricCryptoKey(new Uint8Array(64));
  const testData = { foo: "bar" };

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
  });

  describe("encryptRiskInsightsReport", () => {
    it("should encrypt data and return encrypted packet", async () => {
      // arrange: setup our mocks
      mockKeyService.getOrgKey.mockResolvedValue(orgKey);

      // Act: call the method under test
      const result = await service.encryptRiskInsightsReport(orgId, testData);

      // Assert: ensure that the methods were called with the expected parameters
      expect(mockKeyService.getOrgKey).toHaveBeenCalledWith(orgId);
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

    it("should throw if org key is not found", async () => {
      // when we cannot get an organization key, we should throw an error
      mockKeyService.getOrgKey.mockResolvedValue(null);

      await expect(service.encryptRiskInsightsReport(orgId, testData)).rejects.toThrow(
        "Organization key not found",
      );
    });
  });

  describe("decryptRiskInsightsReport", () => {
    it("should decrypt data and return original object", async () => {
      // Arrange: setup our mocks
      mockKeyService.getOrgKey.mockResolvedValue(orgKey);
      mockEncryptService.unwrapSymmetricKey.mockResolvedValue(contentEncryptionKey);
      mockEncryptService.decryptString.mockResolvedValue(JSON.stringify(testData));

      // act: call the decrypt method - with any params
      // actual decryption does not happen here,
      // we just want to ensure the method calls are correct
      const result = await service.decryptRiskInsightsReport(
        orgId,
        new EncString("encrypted-data"),
        new EncString("wrapped-key"),
      );

      expect(mockKeyService.getOrgKey).toHaveBeenCalledWith(orgId);
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

    it("should return null if org key is not found", async () => {
      mockKeyService.getOrgKey.mockResolvedValue(null);

      const result = await service.decryptRiskInsightsReport(
        orgId,
        new EncString("encrypted-data"),
        new EncString("wrapped-key"),
      );
      expect(result).toBeNull();
    });

    it("should return null if decrypt throws", async () => {
      mockKeyService.getOrgKey.mockResolvedValue(orgKey);
      mockEncryptService.unwrapSymmetricKey.mockRejectedValue(new Error("fail"));

      const result = await service.decryptRiskInsightsReport(
        orgId,
        new EncString("encrypted-data"),
        new EncString("wrapped-key"),
      );
      expect(result).toBeNull();
    });

    it("should return null if decrypt throws", async () => {
      mockKeyService.getOrgKey.mockResolvedValue(orgKey);
      mockEncryptService.unwrapSymmetricKey.mockRejectedValue(new Error("fail"));

      const result = await service.decryptRiskInsightsReport(
        orgId,
        new EncString("encrypted-data"),
        new EncString("wrapped-key"),
      );
      expect(result).toBeNull();
    });

    it("should return null if decrypt throws", async () => {
      mockKeyService.getOrgKey.mockResolvedValue(orgKey);
      mockEncryptService.unwrapSymmetricKey.mockRejectedValue(new Error("fail"));

      const result = await service.decryptRiskInsightsReport(
        orgId,
        new EncString("encrypted-data"),
        new EncString("wrapped-key"),
      );
      expect(result).toBeNull();
    });
  });
});
