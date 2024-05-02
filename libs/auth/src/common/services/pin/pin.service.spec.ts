import { mock } from "jest-mock-extended";

import { KdfConfigService } from "@bitwarden/common/auth/abstractions/kdf-config.service";
import { FakeMasterPasswordService } from "@bitwarden/common/auth/services/master-password/fake-master-password.service";
import { EncryptService } from "@bitwarden/common/platform/abstractions/encrypt.service";
import { KeyGenerationService } from "@bitwarden/common/platform/abstractions/key-generation.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { DEFAULT_KDF_CONFIG } from "@bitwarden/common/platform/enums";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { EncString } from "@bitwarden/common/platform/models/domain/enc-string";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import {
  FakeAccountService,
  FakeStateProvider,
  mockAccountServiceWith,
} from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { MasterKey, PinKey, UserKey } from "@bitwarden/common/types/key";

import {
  PinService,
  PIN_KEY_ENCRYPTED_USER_KEY,
  PIN_KEY_ENCRYPTED_USER_KEY_EPHEMERAL,
  OLD_PIN_KEY_ENCRYPTED_MASTER_KEY,
  PROTECTED_PIN,
  PinLockType,
} from "./pin.service.implementation";

describe("PinService", () => {
  let sut: PinService;

  let accountService: FakeAccountService;
  let masterPasswordService: FakeMasterPasswordService;
  let stateProvider: FakeStateProvider;

  const encryptService = mock<EncryptService>();
  const kdfConfigService = mock<KdfConfigService>();
  const keyGenerationService = mock<KeyGenerationService>();
  const logService = mock<LogService>();
  const stateService = mock<StateService>();

  const mockUserId = Utils.newGuid() as UserId;
  const mockUserKey = new SymmetricCryptoKey(randomBytes(32)) as UserKey; // TODO-rr-bw: verify 32 is correct
  const mockMasterKey = new SymmetricCryptoKey(randomBytes(32)) as MasterKey; // TODO-rr-bw: verify 32 is correct
  const mockPinKey = new SymmetricCryptoKey(randomBytes(32)) as PinKey; // TODO-rr-bw: verify 32 is correct
  const mockUserEmail = "user@example.com";
  const mockPin = "1234";
  const mockProtectedPin = "protectedPin";
  const mockProtectedPinEncString = new EncString(mockProtectedPin);

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

  beforeEach(() => {
    jest.clearAllMocks();

    accountService = mockAccountServiceWith(mockUserId);
    masterPasswordService = new FakeMasterPasswordService();
    stateProvider = new FakeStateProvider(accountService);

    sut = new PinService(
      accountService,
      encryptService,
      kdfConfigService,
      keyGenerationService,
      logService,
      masterPasswordService,
      stateProvider,
      stateService,
    );
  });

  it("should instantiate the PinService", () => {
    expect(sut).not.toBeFalsy();
  });

  describe("userId validation", () => {
    it("should throw an error if a userId is not provided", async () => {
      await expect(sut.getPinKeyEncryptedUserKey(undefined)).rejects.toThrow(
        "User ID is required. Cannot get pinKeyEncryptedUserKey.",
      );
      await expect(sut.getPinKeyEncryptedUserKeyEphemeral(undefined)).rejects.toThrow(
        "User ID is required. Cannot get pinKeyEncryptedUserKeyEphemeral.",
      );
      await expect(sut.clearPinKeyEncryptedUserKey(undefined)).rejects.toThrow(
        "User ID is required. Cannot clear pinKeyEncryptedUserKey.",
      );
      await expect(sut.clearPinKeyEncryptedUserKeyEphemeral(undefined)).rejects.toThrow(
        "User ID is required. Cannot clear pinKeyEncryptedUserKeyEphemeral.",
      );
      await expect(
        sut.createPinKeyEncryptedUserKey(mockPin, mockUserKey, undefined),
      ).rejects.toThrow("User ID is required. Cannot create pinKeyEncryptedUserKey.");
      await expect(sut.getProtectedPin(undefined)).rejects.toThrow(
        "User ID is required. Cannot get protectedPin.",
      );
      await expect(sut.setProtectedPin(mockProtectedPin, undefined)).rejects.toThrow(
        "User ID is required. Cannot set protectedPin.",
      );
      await expect(sut.getOldPinKeyEncryptedMasterKey(undefined)).rejects.toThrow(
        "User ID is required. Cannot get oldPinKeyEncryptedMasterKey.",
      );
      await expect(sut.clearOldPinKeyEncryptedMasterKey(undefined)).rejects.toThrow(
        "User ID is required. Cannot clear oldPinKeyEncryptedMasterKey.",
      );
      await expect(
        sut.createPinKeyEncryptedUserKey(mockPin, mockUserKey, undefined),
      ).rejects.toThrow("User ID is required. Cannot create pinKeyEncryptedUserKey.");
      await expect(sut.getPinLockType(undefined)).rejects.toThrow("Cannot get PinLockType.");
      await expect(sut.isPinSet(undefined)).rejects.toThrow(
        "User ID is required. Cannot determine if PIN is set.",
      );
    });
  });

  describe("get/clear/create/store pinKeyEncryptedUserKey methods", () => {
    describe("getPinKeyEncryptedUserKey()", () => {
      it("should get the pinKeyEncryptedUserKey of the specified userId", async () => {
        await sut.getPinKeyEncryptedUserKey(mockUserId);

        expect(stateProvider.mock.getUserState$).toHaveBeenCalledWith(
          PIN_KEY_ENCRYPTED_USER_KEY,
          mockUserId,
        );
      });
    });

    describe("clearPinKeyEncryptedUserKey()", () => {
      it("should clear the pinKeyEncryptedUserKey of the specified userId", async () => {
        await sut.clearPinKeyEncryptedUserKey(mockUserId);

        expect(stateProvider.mock.setUserState).toHaveBeenCalledWith(
          PIN_KEY_ENCRYPTED_USER_KEY,
          null,
          mockUserId,
        );
      });
    });

    describe("getPinKeyEncryptedUserKeyEphemeral()", () => {
      it("should get the pinKeyEncrypterUserKeyEphemeral of the specified userId", async () => {
        await sut.getPinKeyEncryptedUserKeyEphemeral(mockUserId);

        expect(stateProvider.mock.getUserState$).toHaveBeenCalledWith(
          PIN_KEY_ENCRYPTED_USER_KEY_EPHEMERAL,
          mockUserId,
        );
      });
    });

    describe("clearPinKeyEncryptedUserKeyEphemeral()", () => {
      it("should clear the pinKeyEncryptedUserKey of the specified userId", async () => {
        await sut.clearPinKeyEncryptedUserKeyEphemeral(mockUserId);

        expect(stateProvider.mock.setUserState).toHaveBeenCalledWith(
          PIN_KEY_ENCRYPTED_USER_KEY_EPHEMERAL,
          null,
          mockUserId,
        );
      });
    });

    describe("createPinKeyEncryptedUserKey()", () => {
      it("should throw an error if a userKey is not provided", async () => {
        await expect(
          sut.createPinKeyEncryptedUserKey(mockPin, undefined, mockUserId),
        ).rejects.toThrow("No UserKey provided. Cannot create pinKeyEncryptedUserKey.");
      });

      it("should create a pinKeyEncryptedUserKey", async () => {
        sut.makePinKey = jest.fn().mockResolvedValue(mockPinKey);

        await sut.createPinKeyEncryptedUserKey(mockPin, mockUserKey, mockUserId);

        expect(encryptService.encrypt).toHaveBeenCalledWith(mockUserKey.key, mockPinKey);
      });
    });

    describe("storePinKeyEncryptedUserKey", () => {
      it("should store a pinKeyEncryptedUserKey (persistent version) when 'storeAsEphemeral' is false", async () => {
        const storeAsEphemeral = false;

        await sut.storePinKeyEncryptedUserKey(
          pinKeyEncryptedUserKeyPersistant,
          storeAsEphemeral,
          mockUserId,
        );

        expect(stateProvider.mock.setUserState).toHaveBeenCalledWith(
          PIN_KEY_ENCRYPTED_USER_KEY,
          pinKeyEncryptedUserKeyPersistant.encryptedString,
          mockUserId,
        );
      });

      it("should store a pinKeyEncryptedUserKeyEphemeral when 'storeAsEphemeral' is true", async () => {
        const storeAsEphemeral = true;

        await sut.storePinKeyEncryptedUserKey(
          pinKeyEncryptedUserKeyEphemeral,
          storeAsEphemeral,
          mockUserId,
        );

        expect(stateProvider.mock.setUserState).toHaveBeenCalledWith(
          PIN_KEY_ENCRYPTED_USER_KEY_EPHEMERAL,
          pinKeyEncryptedUserKeyEphemeral.encryptedString,
          mockUserId,
        );
      });
    });
  });

  describe("protectedPin methods", () => {
    describe("getProtectedPin()", () => {
      it("should get the protectedPin of the specified userId", async () => {
        await sut.getProtectedPin(mockUserId);

        expect(stateProvider.mock.getUserState$).toHaveBeenCalledWith(PROTECTED_PIN, mockUserId);
      });
    });

    describe("setProtectedPin()", () => {
      it("should set the protectedPin of the specified userId", async () => {
        await sut.setProtectedPin(mockProtectedPin, mockUserId);

        expect(stateProvider.mock.setUserState).toHaveBeenCalledWith(
          PROTECTED_PIN,
          mockProtectedPin,
          mockUserId,
        );
      });
    });

    describe("createProtectedPin()", () => {
      it("should throw an error if a userKey is not provided", async () => {
        await expect(sut.createProtectedPin(mockPin, undefined)).rejects.toThrow(
          "No UserKey provided. Cannot create protectedPin.",
        );
      });

      it("should create a protectedPin from the provided PIN and userKey", async () => {
        encryptService.encrypt.mockResolvedValue(mockProtectedPinEncString);

        const result = await sut.createProtectedPin(mockPin, mockUserKey);

        expect(encryptService.encrypt).toHaveBeenCalledWith(mockPin, mockUserKey);
        expect(result).toEqual(mockProtectedPinEncString);
      });
    });
  });

  describe("oldPinKeyEncryptedMasterKey methods", () => {
    describe("getOldPinKeyEncryptedMasterKey()", () => {
      it("should get the oldPinKeyEncryptedMasterKey of the specified userId", async () => {
        await sut.getOldPinKeyEncryptedMasterKey(mockUserId);

        expect(stateProvider.mock.getUserState$).toHaveBeenCalledWith(
          OLD_PIN_KEY_ENCRYPTED_MASTER_KEY,
          mockUserId,
        );
      });
    });

    describe("clearOldPinKeyEncryptedMasterKey()", () => {
      it("should clear the oldPinKeyEncryptedMasterKey of the specified userId", async () => {
        await sut.clearOldPinKeyEncryptedMasterKey(mockUserId);

        expect(stateProvider.mock.setUserState).toHaveBeenCalledWith(
          OLD_PIN_KEY_ENCRYPTED_MASTER_KEY,
          null,
          mockUserId,
        );
      });
    });
  });

  describe("makePinKey()", () => {
    it("should make a PinKey", async () => {
      keyGenerationService.deriveKeyFromPassword.mockResolvedValue(mockPinKey);

      await sut.makePinKey(mockPin, mockUserEmail, DEFAULT_KDF_CONFIG);

      expect(keyGenerationService.deriveKeyFromPassword).toHaveBeenCalledWith(
        mockPin,
        mockUserEmail,
        DEFAULT_KDF_CONFIG,
      );
      expect(keyGenerationService.stretchKey).toHaveBeenCalledWith(mockPinKey);
    });
  });

  describe("getPinLockType()", () => {
    it("should return 'PERSISTENT' if a pinKeyEncryptedUserKey (persistent version) is found", async () => {
      sut.getProtectedPin = jest.fn().mockResolvedValue(null);
      sut.getPinKeyEncryptedUserKey = jest.fn().mockResolvedValue(pinKeyEncryptedUserKeyPersistant);

      const result = await sut.getPinLockType(mockUserId);

      expect(result).toBe("PERSISTENT");
    });

    it("should return 'PERSISTENT' if an old oldPinKeyEncryptedMasterKey is found", async () => {
      sut.getProtectedPin = jest.fn().mockResolvedValue(null);
      sut.getPinKeyEncryptedUserKey = jest.fn().mockResolvedValue(null);
      sut.getOldPinKeyEncryptedMasterKey = jest
        .fn()
        .mockResolvedValue(oldPinKeyEncryptedMasterKeyPreMigrationPersistent);

      const result = await sut.getPinLockType(mockUserId);

      expect(result).toBe("PERSISTENT");
    });

    it("should return 'EPHEMERAL' if neither a pinKeyEncryptedUserKey (persistent version) nor an old oldPinKeyEncryptedMasterKey are found, but a protectedPin is found", async () => {
      sut.getProtectedPin = jest.fn().mockResolvedValue(mockProtectedPin);
      sut.getPinKeyEncryptedUserKey = jest.fn().mockResolvedValue(null);
      sut.getOldPinKeyEncryptedMasterKey = jest.fn().mockResolvedValue(null);

      const result = await sut.getPinLockType(mockUserId);

      expect(result).toBe("EPHEMERAL");
    });

    it("should return 'DISABLED' if ALL three of these are NOT found: protectedPin, pinKeyEncryptedUserKey (persistent version), oldPinKeyEncryptedMasterKey", async () => {
      sut.getProtectedPin = jest.fn().mockResolvedValue(null);
      sut.getPinKeyEncryptedUserKey = jest.fn().mockResolvedValue(null);
      sut.getOldPinKeyEncryptedMasterKey = jest.fn().mockResolvedValue(null);

      const result = await sut.getPinLockType(mockUserId);

      expect(result).toBe("DISABLED");
    });
  });

  describe("isPinSet()", () => {
    it.each(["PERSISTENT", "EPHEMERAL"])(
      "should return true if the user PinLockType is '%s'",
      async () => {
        sut.getPinLockType = jest.fn().mockResolvedValue("PERSISTENT");

        const result = await sut.isPinSet(mockUserId);

        expect(result).toEqual(true);
      },
    );

    it("should return false if the user PinLockType is 'DISABLED'", async () => {
      sut.getPinLockType = jest.fn().mockResolvedValue("DISABLED");

      const result = await sut.isPinSet(mockUserId);

      expect(result).toEqual(false);
    });
  });

  describe("decryptUserKeyWithPin()", () => {
    async function setupDecryptUserKeyWithPinMocks(
      pinLockType: PinLockType,
      migrationStatus: "PRE" | "POST" = "POST",
    ) {
      sut.getPinLockType = jest.fn().mockResolvedValue(pinLockType);

      mockPinEncryptedKeyDataByPinLockType(pinLockType, migrationStatus);

      kdfConfigService.getKdfConfig.mockResolvedValue(DEFAULT_KDF_CONFIG);
      stateService.getEmail.mockResolvedValue(mockUserEmail);

      if (pinLockType === "PERSISTENT" && migrationStatus === "PRE") {
        await mockDecryptAndMigrateOldPinKeyEncryptedMasterKeyFn();
      } else {
        mockDecryptUserKeyFn();
      }

      sut.getProtectedPin = jest.fn().mockResolvedValue(mockProtectedPin);
      encryptService.decryptToUtf8.mockResolvedValue(mockPin);
    }

    async function mockDecryptAndMigrateOldPinKeyEncryptedMasterKeyFn() {
      sut.makePinKey = jest.fn().mockResolvedValue(mockPinKey);
      encryptService.decryptToBytes.mockResolvedValue(mockMasterKey.key);

      stateService.getEncryptedCryptoSymmetricKey.mockResolvedValue(mockUserKey.keyB64); // TODO-rr-bw: verify .keyB64 is correct
      masterPasswordService.mock.decryptUserKeyWithMasterKey.mockResolvedValue(mockUserKey);

      sut.createPinKeyEncryptedUserKey = jest
        .fn()
        .mockResolvedValue(pinKeyEncryptedUserKeyPersistant);

      await sut.storePinKeyEncryptedUserKey(pinKeyEncryptedUserKeyPersistant, false, mockUserId);

      sut.createProtectedPin = jest.fn().mockResolvedValue(mockProtectedPinEncString);
      await sut.setProtectedPin(mockProtectedPinEncString.encryptedString, mockUserId);

      await sut.clearOldPinKeyEncryptedMasterKey(mockUserId);

      await stateService.setCryptoMasterKeyBiometric(null, { userId: mockUserId });
    }

    function mockDecryptUserKeyFn() {
      sut.getPinKeyEncryptedUserKey = jest.fn().mockResolvedValue(pinKeyEncryptedUserKeyPersistant);
      sut.makePinKey = jest.fn().mockResolvedValue(mockPinKey);
      encryptService.decryptToBytes.mockResolvedValue(mockUserKey.key);
    }

    function mockPinEncryptedKeyDataByPinLockType(
      pinLockType: PinLockType,
      migrationStatus: "PRE" | "POST" = "POST",
    ) {
      switch (pinLockType) {
        case "PERSISTENT":
          sut.getPinKeyEncryptedUserKey = jest
            .fn()
            .mockResolvedValue(pinKeyEncryptedUserKeyPersistant);

          if (migrationStatus === "PRE") {
            sut.getOldPinKeyEncryptedMasterKey = jest
              .fn()
              .mockResolvedValue(oldPinKeyEncryptedMasterKeyPreMigrationPersistent);
          } else {
            sut.getOldPinKeyEncryptedMasterKey = jest
              .fn()
              .mockResolvedValue(oldPinKeyEncryptedMasterKeyPostMigration); // null
          }

          break;
        case "EPHEMERAL":
          sut.getPinKeyEncryptedUserKeyEphemeral = jest
            .fn()
            .mockResolvedValue(pinKeyEncryptedUserKeyEphemeral);

          break;
        case "DISABLED":
          // no mocking required. Error should be thrown
          break;
      }
    }

    const testCases: { pinLockType: PinLockType; migrationStatus: "PRE" | "POST" }[] = [
      { pinLockType: "PERSISTENT", migrationStatus: "PRE" },
      { pinLockType: "PERSISTENT", migrationStatus: "POST" },
      { pinLockType: "EPHEMERAL", migrationStatus: "POST" },
    ];

    testCases.forEach(({ pinLockType, migrationStatus }) => {
      describe(`given a ${pinLockType} PIN (${migrationStatus} migration)`, () => {
        if (pinLockType === "PERSISTENT" && migrationStatus === "PRE") {
          it("should clear the oldPinKeyEncryptedMasterKey from state", async () => {
            await setupDecryptUserKeyWithPinMocks(pinLockType, migrationStatus);

            await sut.decryptUserKeyWithPin(mockPin, mockUserId);

            expect(stateProvider.mock.setUserState).toHaveBeenCalledWith(
              OLD_PIN_KEY_ENCRYPTED_MASTER_KEY,
              null,
              mockUserId,
            );
          });

          it("should set the new pinKeyEncrypterUserKey to state", async () => {
            await setupDecryptUserKeyWithPinMocks(pinLockType, migrationStatus);

            await sut.decryptUserKeyWithPin(mockPin, mockUserId);

            expect(stateProvider.mock.setUserState).toHaveBeenCalledWith(
              PIN_KEY_ENCRYPTED_USER_KEY,
              pinKeyEncryptedUserKeyPersistant.encryptedString,
              mockUserId,
            );
          });
        }

        it(`should successfully decrypt and return user key when using a valid PIN`, async () => {
          // Arrange
          await setupDecryptUserKeyWithPinMocks(pinLockType, migrationStatus);

          // Act
          const result = await sut.decryptUserKeyWithPin(mockPin, mockUserId);

          // Assert
          expect(result).toEqual(mockUserKey);
        });

        it(`should return null when PIN is incorrect and user key cannot be decrypted`, async () => {
          // Arrange
          await setupDecryptUserKeyWithPinMocks(pinLockType, migrationStatus);

          sut.decryptUserKeyWithPin = jest.fn().mockResolvedValue(null);

          // Act
          const result = await sut.decryptUserKeyWithPin(mockPin, mockUserId);

          // Assert
          expect(result).toBeNull();
        });

        // not sure if this is a realistic scenario but going to test it anyway
        it(`should return null when PIN doesn't match after successful user key decryption`, async () => {
          // Arrange
          await setupDecryptUserKeyWithPinMocks(pinLockType, migrationStatus);

          // non matching PIN
          encryptService.decryptToUtf8.mockResolvedValue("9999");

          // Act
          const result = await sut.decryptUserKeyWithPin(mockPin, mockUserId);

          // Assert
          expect(result).toBeNull();
        });
      });
    });

    it(`should return null when pin is disabled`, async () => {
      // Arrange
      await setupDecryptUserKeyWithPinMocks("DISABLED");

      // Act
      const result = await sut.decryptUserKeyWithPin(mockPin, mockUserId);

      // Assert
      expect(result).toBeNull();
    });
  });
});

// Test helpers
function randomBytes(length: number): Uint8Array {
  return new Uint8Array(Array.from({ length }, (_, k) => k % 255));
}
