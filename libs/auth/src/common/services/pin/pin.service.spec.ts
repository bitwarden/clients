import { mock } from "jest-mock-extended";

import { KdfConfig } from "@bitwarden/common/auth/models/domain/kdf-config";
import { CryptoService } from "@bitwarden/common/platform/abstractions/crypto.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { EncString } from "@bitwarden/common/platform/models/domain/enc-string";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import {
  VaultTimeoutSettingsService,
  PinLockType,
} from "@bitwarden/common/services/vault-timeout/vault-timeout-settings.service";
import { UserKey } from "@bitwarden/common/types/key";

import { PinService } from "./pin.service.implementation";
describe("PinService", () => {
  let pinService: PinService;

  const stateService = mock<StateService>();
  const cryptoService = mock<CryptoService>();
  const vaultTimeoutSettingsService = mock<VaultTimeoutSettingsService>();
  const logService = mock<LogService>();

  beforeEach(() => {
    jest.clearAllMocks();

    pinService = new PinService(
      stateService,
      cryptoService,
      vaultTimeoutSettingsService,
      logService,
    );
  });

  it("instantiates", () => {
    expect(pinService).not.toBeFalsy();
  });

  describe("decryptUserKeyWithPin(...)", () => {
    const mockPin = "1234";
    const mockProtectedPin = "protectedPin";
    const DEFAULT_PBKDF2_ITERATIONS = 600000;
    const mockUserEmail = "user@example.com";
    const mockUserKey = new SymmetricCryptoKey(randomBytes(32)) as UserKey;

    function setupDecryptUserKeyWithPinMocks(
      pinLockType: PinLockType,
      migrationStatus: "PRE" | "POST" = "POST",
    ) {
      vaultTimeoutSettingsService.isPinLockSet.mockResolvedValue(pinLockType);

      stateService.getKdfConfig.mockResolvedValue(new KdfConfig(DEFAULT_PBKDF2_ITERATIONS));
      stateService.getEmail.mockResolvedValue(mockUserEmail);

      if (migrationStatus === "PRE") {
        cryptoService.decryptAndMigrateOldPinKey.mockResolvedValue(mockUserKey);
      } else {
        cryptoService.decryptUserKeyWithPin.mockResolvedValue(mockUserKey);
      }

      mockPinEncryptedKeyDataByPinLockType(pinLockType, migrationStatus);

      stateService.getProtectedPin.mockResolvedValue(mockProtectedPin);
      cryptoService.decryptToUtf8.mockResolvedValue(mockPin);
    }

    // Note: both pinKeyEncryptedUserKeys use encryptionType: 2 (AesCbc256_HmacSha256_B64)
    const pinKeyEncryptedUserKeyEphemeral = new EncString(
      "2.gbauOANURUHqvhLTDnva1A==|nSW+fPumiuTaDB/s12+JO88uemV6rhwRSR+YR1ZzGr5j6Ei3/h+XEli2Unpz652NlZ9NTuRpHxeOqkYYJtp7J+lPMoclgteXuAzUu9kqlRc=|DeUFkhIwgkGdZA08bDnDqMMNmZk21D+H5g8IostPKAY=",
    );

    const pinKeyEncryptedUserKeyPersistant = new EncString(
      "2.fb5kOEZvh9zPABbP8WRmSQ==|Yi6ZAJY+UtqCKMUSqp1ahY9Kf8QuneKXs6BMkpNsakLVOzTYkHHlilyGABMF7GzUO8QHyZi7V/Ovjjg+Naf3Sm8qNhxtDhibITv4k8rDnM0=|TFkq3h2VNTT1z5BFbebm37WYuxyEHXuRo0DZJI7TQnw=",
    );

    const oldPinKeyEncryptedMasterKeyPostMigration: any = null;
    const oldPinKeyEncryptedMasterKeyPreMigrationPersistent =
      "2.fb5kOEZvh9zPABbP8WRmSQ==|Yi6ZAJY+UtqCKMUSqp1ahY9Kf8QuneKXs6BMkpNsakLVOzTYkHHlilyGABMF7GzUO8QHyZi7V/Ovjjg+Naf3Sm8qNhxtDhibITv4k8rDnM0=|TFkq3h2VNTT1z5BFbebm37WYuxyEHXuRo0DZJI7TQnw=";
    const oldPinKeyEncryptedMasterKeyPreMigrationEphemeral = new EncString(
      "2.fb5kOEZvh9zPABbP8WRmSQ==|Yi6ZAJY+UtqCKMUSqp1ahY9Kf8QuneKXs6BMkpNsakLVOzTYkHHlilyGABMF7GzUO8QHyZi7V/Ovjjg+Naf3Sm8qNhxtDhibITv4k8rDnM0=|TFkq3h2VNTT1z5BFbebm37WYuxyEHXuRo0DZJI7TQnw=",
    );

    function mockPinEncryptedKeyDataByPinLockType(
      pinLockType: PinLockType,
      migrationStatus: "PRE" | "POST" = "POST",
    ) {
      switch (pinLockType) {
        case "PERSISTANT":
          stateService.getPinKeyEncryptedUserKey.mockResolvedValue(
            pinKeyEncryptedUserKeyPersistant,
          );
          if (migrationStatus === "PRE") {
            stateService.getEncryptedPinProtected.mockResolvedValue(
              oldPinKeyEncryptedMasterKeyPreMigrationPersistent,
            );
          } else {
            stateService.getEncryptedPinProtected.mockResolvedValue(
              oldPinKeyEncryptedMasterKeyPostMigration,
            );
          }
          break;
        case "TRANSIENT":
          stateService.getPinKeyEncryptedUserKeyEphemeral.mockResolvedValue(
            pinKeyEncryptedUserKeyEphemeral,
          );

          if (migrationStatus === "PRE") {
            stateService.getDecryptedPinProtected.mockResolvedValue(
              oldPinKeyEncryptedMasterKeyPreMigrationEphemeral,
            );
          } else {
            stateService.getDecryptedPinProtected.mockResolvedValue(
              oldPinKeyEncryptedMasterKeyPostMigration,
            );
          }
          break;
        case "DISABLED":
          // no mocking required. Error should be thrown
          break;
      }
    }

    const testCases: { pinLockType: PinLockType; migrationStatus: "PRE" | "POST" }[] = [
      { pinLockType: "PERSISTANT", migrationStatus: "PRE" },
      { pinLockType: "PERSISTANT", migrationStatus: "POST" },
      { pinLockType: "TRANSIENT", migrationStatus: "PRE" },
      { pinLockType: "TRANSIENT", migrationStatus: "POST" },
    ];

    testCases.forEach(({ pinLockType, migrationStatus }) => {
      describe(`given a ${pinLockType} PIN (${migrationStatus} migration)`, () => {
        it(`should successfully decrypt and return user key when using a valid PIN`, async () => {
          // Arrange
          setupDecryptUserKeyWithPinMocks(pinLockType, migrationStatus);

          // Act
          const result = await pinService.decryptUserKeyWithPin(mockPin);

          // Assert
          expect(result).toEqual(mockUserKey);
        });

        it(`should return null when PIN is incorrect and user key cannot be decrypted`, async () => {
          // Arrange
          setupDecryptUserKeyWithPinMocks("PERSISTANT");

          cryptoService.decryptUserKeyWithPin.mockResolvedValue(null);

          // Act
          const result = await pinService.decryptUserKeyWithPin(mockPin);

          // Assert
          expect(result).toBeNull();
        });

        // not sure if this is a realistic scenario but going to test it anyway
        it(`should return null when PIN doesn't match after successful user key decryption`, async () => {
          // Arrange
          setupDecryptUserKeyWithPinMocks("PERSISTANT");

          // non matching PIN
          cryptoService.decryptToUtf8.mockResolvedValue("9999");

          // Act
          const result = await pinService.decryptUserKeyWithPin(mockPin);

          // Assert
          expect(result).toBeNull();
        });
      });
    });

    it(`should return null when pin is disabled`, async () => {
      // Arrange
      setupDecryptUserKeyWithPinMocks("DISABLED");

      // Act
      const result = await pinService.decryptUserKeyWithPin(mockPin);

      // Assert
      expect(result).toBeNull();
    });
  });
});

// Test helpers
function randomBytes(length: number): Uint8Array {
  return new Uint8Array(Array.from({ length }, (_, k) => k % 255));
}
