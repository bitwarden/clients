import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { MockSdkService } from "@bitwarden/common/platform/spec/mock-sdk.service";
import { CsprngArray } from "@bitwarden/common/types/csprng";
import { UserId } from "@bitwarden/common/types/guid";
import { UserKey } from "@bitwarden/common/types/key";

import { KeyService } from "../../abstractions/key.service";

import { DefaultUserAsymmetricKeysRegenerationService } from "./default-user-asymmetric-key-regeneration.service";

describe("DefaultUserAsymmetricKeysRegenerationService", () => {
  let sut: DefaultUserAsymmetricKeysRegenerationService;
  const userId = "userId" as UserId;
  const mockRandomBytes = new Uint8Array(64) as CsprngArray;
  const mockUserKey = new SymmetricCryptoKey(mockRandomBytes) as UserKey;

  let keyService: MockProxy<KeyService>;
  let logService: MockProxy<LogService>;
  let sdkService: MockSdkService;
  let configService: MockProxy<ConfigService>;

  beforeEach(() => {
    keyService = mock<KeyService>();
    logService = mock<LogService>();
    sdkService = new MockSdkService();
    configService = mock<ConfigService>();

    sut = new DefaultUserAsymmetricKeysRegenerationService(
      keyService,
      logService,
      sdkService,
      configService,
    );
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe("regenerateIfNeeded", () => {
    beforeEach(() => {
      configService.getFeatureFlag.mockResolvedValue(true);
    });

    it("should not call shouldRegenerate when feature flag is off", async () => {
      configService.getFeatureFlag.mockResolvedValue(false);
      const shouldRegenerateSpy = jest.spyOn(sut, "shouldRegenerate");

      await sut.regenerateIfNeeded(userId);

      expect(shouldRegenerateSpy).not.toHaveBeenCalled();
    });

    it("should not regenerate when shouldRegenerate throws", async () => {
      jest.spyOn(sut, "shouldRegenerate").mockRejectedValue(new Error("error"));
      const regenerateSpy = jest.spyOn(sut, "regenerateUserPublicKeyEncryptionKeyPair");

      await sut.regenerateIfNeeded(userId);

      expect(regenerateSpy).not.toHaveBeenCalled();
    });

    it("should not regenerate when shouldRegenerate returns false", async () => {
      jest.spyOn(sut, "shouldRegenerate").mockResolvedValue(false);
      const regenerateSpy = jest.spyOn(sut, "regenerateUserPublicKeyEncryptionKeyPair");

      await sut.regenerateIfNeeded(userId);

      expect(regenerateSpy).not.toHaveBeenCalled();
    });

    it("should regenerate when shouldRegenerate returns true", async () => {
      jest.spyOn(sut, "shouldRegenerate").mockResolvedValue(true);
      const regenerateSpy = jest
        .spyOn(sut, "regenerateUserPublicKeyEncryptionKeyPair")
        .mockResolvedValue(true);

      await sut.regenerateIfNeeded(userId);

      expect(regenerateSpy).toHaveBeenCalledWith(userId);
    });
  });

  describe("shouldRegenerate", () => {
    it("should return false when user key is null", async () => {
      keyService.userKey$.mockReturnValue(of(null as unknown as UserKey));

      const result = await sut.shouldRegenerate(userId);

      expect(result).toBe(false);
    });

    it("should return true when SDK says keys should be regenerated", async () => {
      keyService.userKey$.mockReturnValue(of(mockUserKey));

      const mockClient = sdkService.simulate.userLogin(userId);
      mockClient.user_crypto_management
        .mockDeep()
        .should_regenerate_public_key_encryption_key_pair.mockResolvedValue(true);

      const result = await sut.shouldRegenerate(userId);

      expect(result).toBe(true);
    });

    it("should return false when SDK says keys should not be regenerated", async () => {
      keyService.userKey$.mockReturnValue(of(mockUserKey));

      const mockClient = sdkService.simulate.userLogin(userId);
      mockClient.user_crypto_management
        .mockDeep()
        .should_regenerate_public_key_encryption_key_pair.mockResolvedValue(false);

      const result = await sut.shouldRegenerate(userId);

      expect(result).toBe(false);
    });
  });

  describe("regenerateUserPublicKeyEncryptionKeyPair", () => {
    it("should throw error when user key is not found", async () => {
      keyService.userKey$.mockReturnValue(of(null as unknown as UserKey));

      await expect(sut.regenerateUserPublicKeyEncryptionKeyPair(userId)).rejects.toThrow(
        "User key not found",
      );
    });

    it("should return true when SDK regenerates keys", async () => {
      keyService.userKey$.mockReturnValue(of(mockUserKey));

      const mockClient = sdkService.simulate.userLogin(userId);
      mockClient.user_crypto_management
        .mockDeep()
        .regenerate_public_key_encryption_key_pair_if_needed.mockResolvedValue(true);

      const result = await sut.regenerateUserPublicKeyEncryptionKeyPair(userId);

      expect(result).toBe(true);
    });

    it("should return false when SDK returns false", async () => {
      keyService.userKey$.mockReturnValue(of(mockUserKey));

      const mockClient = sdkService.simulate.userLogin(userId);
      mockClient.user_crypto_management
        .mockDeep()
        .regenerate_public_key_encryption_key_pair_if_needed.mockResolvedValue(false);

      const result = await sut.regenerateUserPublicKeyEncryptionKeyPair(userId);

      expect(result).toBe(false);
    });
  });
});
