import { mock } from "jest-mock-extended";
import { BehaviorSubject, filter } from "rxjs";

// eslint-disable-next-line no-restricted-imports
import { DEFAULT_KDF_CONFIG, KdfConfigService, KeyService } from "@bitwarden/key-management";
import { PasswordProtectedKeyEnvelope } from "@bitwarden/sdk-internal";

import { MockSdkService } from "../..//platform/spec/mock-sdk.service";
import { FakeAccountService, mockAccountServiceWith } from "../../../spec";
import { LogService } from "../../platform/abstractions/log.service";
import { Utils } from "../../platform/misc/utils";
import { SymmetricCryptoKey } from "../../platform/models/domain/symmetric-crypto-key";
import { UserId } from "../../types/guid";
import { PinKey, UserKey } from "../../types/key";
import { KeyGenerationService } from "../crypto";
import { EncryptService } from "../crypto/abstractions/encrypt.service";
import { EncryptedString, EncString } from "../crypto/models/enc-string";

import { PinStateServiceAbstraction } from "./pin-state.service.abstraction";
import { PinService } from "./pin.service.implementation";

describe("PinService", () => {
  let sut: PinService;

  let accountService: FakeAccountService;

  const encryptService = mock<EncryptService>();
  const kdfConfigService = mock<KdfConfigService>();
  const keyGenerationService = mock<KeyGenerationService>();
  const logService = mock<LogService>();
  const mockUserId = Utils.newGuid() as UserId;
  const mockUserKey = new SymmetricCryptoKey(new Uint8Array(64)) as UserKey;
  const mockPinKey = new SymmetricCryptoKey(randomBytes(32)) as PinKey;
  const mockUserEmail = "user@example.com";
  const mockPin = "1234";
  const mockUserKeyEncryptedPin = new EncString("userKeyEncryptedPin");
  const mockEphemeralEnvelope = "mock-ephemeral-envelope" as PasswordProtectedKeyEnvelope;
  const mockPersistentEnvelope = "mock-persistent-envelope" as PasswordProtectedKeyEnvelope;
  const keyService = mock<KeyService>();
  const sdkService = new MockSdkService();
  const pinStateService = mock<PinStateServiceAbstraction>();
  const behaviorSubject = new BehaviorSubject<{ userId: UserId; userKey: UserKey }>(null);

  beforeEach(() => {
    accountService = mockAccountServiceWith(mockUserId, { email: mockUserEmail });
    (keyService as any)["unlockedUserKeys$"] = behaviorSubject
      .asObservable()
      .pipe(filter((x) => x != null));
    sdkService.client.crypto
      .mockDeep()
      .unseal_password_protected_key_envelope.mockReturnValue(new Uint8Array(64));

    sut = new PinService(
      accountService,
      encryptService,
      kdfConfigService,
      keyGenerationService,
      logService,
      keyService,
      sdkService,
      pinStateService,
    );
  });

  it("should instantiate the PinService", () => {
    expect(sut).not.toBeFalsy();
  });

  describe("userUnlocked()", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("should set up ephemeral PIN on first unlock if needed", async () => {
      // Arrange
      jest.spyOn(sut, "getPinLockType").mockResolvedValue("EPHEMERAL");
      jest.spyOn(sut, "isPinDecryptionAvailable").mockResolvedValue(false);
      const getPinSpy = jest.spyOn(sut, "getPin").mockResolvedValue(mockPin);
      const setPinSpy = jest.spyOn(sut, "setPin").mockResolvedValue();

      // Act
      await sut.userUnlocked(mockUserId);

      // Assert
      expect(getPinSpy).toHaveBeenCalledWith(mockUserId);
      expect(setPinSpy).toHaveBeenCalledWith(mockPin, "EPHEMERAL", mockUserId);
      expect(logService.info).toHaveBeenCalledWith(
        "[Pin Service] On first unlock: Setting up ephemeral PIN",
      );
    });

    it("should migrate legacy persistent PIN if needed", async () => {
      // Arrange
      jest.spyOn(sut, "getPinLockType").mockResolvedValue("PERSISTENT");
      jest
        .spyOn(sut as any, "getLegacyPinKeyEncryptedUserKeyPersistent")
        .mockResolvedValue("legacy-key");
      const getPinSpy = jest.spyOn(sut, "getPin").mockResolvedValue(mockPin);
      const setPinSpy = jest.spyOn(sut, "setPin").mockResolvedValue();

      // Act
      await sut.userUnlocked(mockUserId);

      // Assert
      expect(getPinSpy).toHaveBeenCalledWith(mockUserId);
      expect(setPinSpy).toHaveBeenCalledWith(mockPin, "PERSISTENT", mockUserId);
      expect(logService.info).toHaveBeenCalledWith(
        "[Pin Service] Migrating legacy PIN key to PinProtectedUserKeyEnvelope",
      );
    });

    it("should do nothing if no migration or setup is needed", async () => {
      // Arrange
      jest.spyOn(sut, "getPinLockType").mockResolvedValue("DISABLED");
      const getPinSpy = jest.spyOn(sut, "getPin");
      const setPinSpy = jest.spyOn(sut, "setPin");

      // Act
      await sut.userUnlocked(mockUserId);

      // Assert
      expect(getPinSpy).not.toHaveBeenCalled();
      expect(setPinSpy).not.toHaveBeenCalled();
    });
  });

  describe("makePinKey()", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("should make a PinKey", async () => {
      // Arrange
      keyGenerationService.deriveKeyFromPassword.mockResolvedValue(mockPinKey);

      // Act
      await sut.makePinKey(mockPin, mockUserEmail, DEFAULT_KDF_CONFIG);

      // Assert
      expect(keyGenerationService.deriveKeyFromPassword).toHaveBeenCalledWith(
        mockPin,
        mockUserEmail,
        DEFAULT_KDF_CONFIG,
      );
      expect(keyGenerationService.stretchKey).toHaveBeenCalledWith(mockPinKey);
    });
  });

  describe("getPin()", () => {
    beforeEach(() => {
      jest.clearAllMocks();
      keyService.userKey$.mockReturnValue(new BehaviorSubject(mockUserKey).asObservable());
    });

    it("should successfully decrypt and return the PIN", async () => {
      const expectedPin = "1234";
      pinStateService.userKeyEncryptedPin$.mockReturnValue(
        new BehaviorSubject(mockUserKeyEncryptedPin).asObservable(),
      );
      encryptService.decryptString.mockResolvedValue(expectedPin);

      const result = await sut.getPin(mockUserId);

      expect(result).toBe(expectedPin);
      expect(encryptService.decryptString).toHaveBeenCalledWith(
        mockUserKeyEncryptedPin,
        mockUserKey,
      );
    });

    it("should throw an error if userId is null", async () => {
      await expect(sut.getPin(null as any)).rejects.toThrow("userId");
    });

    it("should throw an error if userKey is not available", async () => {
      keyService.userKey$.mockReturnValue(new BehaviorSubject(null).asObservable());
      await expect(sut.getPin(mockUserId)).rejects.toThrow("userKey");
    });

    it("should throw an error if userKeyEncryptedPin is not available", async () => {
      // don't set the USER_KEY_ENCRYPTED_PIN state
      await expect(sut.getPin(mockUserId)).rejects.toThrow("userKeyEncryptedPin");
    });
  });

  describe("unsetPin()", () => {
    beforeEach(async () => {
      jest.clearAllMocks();
    });

    it("should throw an error if userId is null", async () => {
      await expect(sut.unsetPin(null as any)).rejects.toThrow("userId");
    });

    it("should call pinStateService.clearPinState with the correct userId", async () => {
      await sut.unsetPin(mockUserId);
      expect(pinStateService.clearPinState).toHaveBeenCalledWith(mockUserId);
    });
  });

  describe("setPin()", () => {
    const mockPinProtectedUserKeyEnvelope = "mock-envelope" as PasswordProtectedKeyEnvelope;
    const mockUserKeyEncryptedPinFromSdk = "sdk-encrypted-pin";

    beforeEach(() => {});

    it("should throw an error if pin is null", async () => {
      // Act & Assert
      await expect(sut.setPin(null as any, "EPHEMERAL", mockUserId)).rejects.toThrow("pin");
    });

    it("should throw an error if pinLockType is null", async () => {
      // Act & Assert
      await expect(sut.setPin(mockPin, null as any, mockUserId)).rejects.toThrow("pinLockType");
    });

    it("should throw an error if userId is null", async () => {
      // Act & Assert
      await expect(sut.setPin(mockPin, "EPHEMERAL", null as any)).rejects.toThrow("userId");
    });

    it("should successfully set an EPHEMERAL pin", async () => {
      sdkService.simulate
        .userLogin(mockUserId)
        .crypto.mockDeep()
        .enroll_pin.mockReturnValue({
          pinProtectedUserKeyEnvelope: mockPinProtectedUserKeyEnvelope,
          userKeyEncryptedPin: mockUserKeyEncryptedPinFromSdk as EncryptedString,
        });

      await sut.setPin(mockPin, "EPHEMERAL", mockUserId);

      expect(pinStateService.setPinState).toHaveBeenCalledWith(
        mockUserId,
        mockPinProtectedUserKeyEnvelope,
        mockUserKeyEncryptedPin,
        "EPHEMERAL",
      );
    });

    it("should successfully set a PERSISTENT pin", async () => {
      sdkService.simulate
        .userLogin(mockUserId)
        .crypto.mockDeep()
        .enroll_pin.mockReturnValue({
          pinProtectedUserKeyEnvelope: mockPinProtectedUserKeyEnvelope,
          userKeyEncryptedPin: mockUserKeyEncryptedPinFromSdk as EncryptedString,
        });

      await sut.setPin(mockPin, "PERSISTENT", mockUserId);

      expect(pinStateService.setPinState).toHaveBeenCalledWith(
        mockUserId,
        mockPinProtectedUserKeyEnvelope,
        mockUserKeyEncryptedPinFromSdk,
        "PERSISTENT",
      );
    });
  });

  describe("getPinLockType()", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("should throw an error if userId is null", async () => {
      // Act & Assert
      await expect(sut.getPinLockType(null as any)).rejects.toThrow("userId");
    });

    it("should call pinStateService.getPinLockType with the correct userId", async () => {
      pinStateService.getPinLockType.mockResolvedValue("EPHEMERAL");
      const result = await sut.getPinLockType(mockUserId);
      expect(pinStateService.getPinLockType).toHaveBeenCalledWith(mockUserId);
      expect(result).toBe("EPHEMERAL");
    });
  });

  describe("isPinDecryptionAvailable()", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("should throw an error if userId is null", async () => {
      // Act & Assert
      await expect(sut.isPinDecryptionAvailable(null as any)).rejects.toThrow("userId");
    });

    it("should return false if pinLockType is DISABLED", async () => {
      // Arrange - don't set any PIN-related state (will result in DISABLED)

      // Act
      const result = await sut.isPinDecryptionAvailable(mockUserId);

      // Assert
      expect(result).toBe(false);
    });

    it("should return true if pinLockType is PERSISTENT", async () => {
      // Arrange - mock lock type
      pinStateService.getPinLockType.mockResolvedValue("PERSISTENT");

      // Act
      const result = await sut.isPinDecryptionAvailable(mockUserId);

      // Assert
      expect(result).toBe(true);
    });

    it("should return true if pinLockType is EPHEMERAL and ephemeral envelope is available", async () => {
      // Arrange - mock lock type and set ephemeral envelope
      pinStateService.getPinLockType.mockResolvedValue("EPHEMERAL");
      pinStateService.getPinProtectedUserKeyEnvelope.mockResolvedValue(mockEphemeralEnvelope);

      // Act
      const result = await sut.isPinDecryptionAvailable(mockUserId);

      // Assert
      expect(result).toBe(true);
    });

    it("should return false if pinLockType is EPHEMERAL but ephemeral envelope is not available", async () => {
      // Arrange - set only user key encrypted pin (EPHEMERAL) but no ephemeral envelope
      pinStateService.getPinLockType.mockResolvedValue("EPHEMERAL");
      pinStateService.getPinProtectedUserKeyEnvelope.mockResolvedValue(null);

      // Act
      const result = await sut.isPinDecryptionAvailable(mockUserId);

      // Assert
      expect(result).toBe(false);
    });

    it("should handle unexpected pinLockType and throw error", async () => {
      // Arrange - mock getPinLockType to return an unexpected value
      jest.spyOn(sut, "getPinLockType").mockResolvedValue("UNKNOWN" as any);

      // Act & Assert
      await expect(sut.isPinDecryptionAvailable(mockUserId)).rejects.toThrow(
        "Unexpected pinLockType: UNKNOWN",
      );
    });
  });

  describe("isPinSet()", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it.each(["PERSISTENT", "EPHEMERAL"])(
      "should return true if the user PinLockType is '%s'",
      async () => {
        // Arrange
        sut.getPinLockType = jest.fn().mockResolvedValue("PERSISTENT");

        // Act
        const result = await sut.isPinSet(mockUserId);

        // Assert
        expect(result).toEqual(true);
      },
    );

    it("should return false if the user PinLockType is 'DISABLED'", async () => {
      // Arrange
      sut.getPinLockType = jest.fn().mockResolvedValue("DISABLED");

      // Act
      const result = await sut.isPinSet(mockUserId);

      // Assert
      expect(result).toEqual(false);
    });
  });

  describe("logout", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("should throw when userId is null", async () => {
      await expect(sut.logout(null as any)).rejects.toThrow("userId");
    });

    it("should call pinStateService.clearPinState", async () => {
      await sut.logout(mockUserId);
      expect(pinStateService.clearPinState).toHaveBeenCalledWith(mockUserId);
    });
  });

  describe("decryptUserKeyWithPin", () => {
    beforeEach(() => {
      jest.clearAllMocks();
      pinStateService.userKeyEncryptedPin$.mockReset();
      pinStateService.getPinProtectedUserKeyEnvelope.mockReset();
      pinStateService.getLegacyPinKeyEncryptedUserKeyPersistent.mockReset();
    });

    it("should throw an error if userId is null", async () => {
      await expect(sut.decryptUserKeyWithPin("1234", null as any)).rejects.toThrow("userId");
    });

    it("should throw an error if pin is null", async () => {
      await expect(sut.decryptUserKeyWithPin(null as any, mockUserId)).rejects.toThrow("pin");
    });

    it("should return userkey with new pin EPHEMERAL", async () => {
      // Arrange
      const mockPin = "1234";
      pinStateService.userKeyEncryptedPin$.mockReturnValueOnce(
        new BehaviorSubject(mockUserKeyEncryptedPin),
      );
      pinStateService.getPinProtectedUserKeyEnvelope.mockResolvedValueOnce(mockEphemeralEnvelope);

      // Act
      const result = await sut.decryptUserKeyWithPin(mockPin, mockUserId);

      // Assert
      expect(result).toEqual(mockUserKey);
    });

    it("should return userkey with new pin PERSISTENT", async () => {
      // Arrange
      const mockPin = "1234";
      pinStateService.userKeyEncryptedPin$.mockReturnValueOnce(
        new BehaviorSubject(mockUserKeyEncryptedPin),
      );
      pinStateService.getPinProtectedUserKeyEnvelope.mockResolvedValueOnce(mockPersistentEnvelope);

      // Act
      const result = await sut.decryptUserKeyWithPin(mockPin, mockUserId);

      // Assert
      expect(result).toEqual(mockUserKey);
    });

    it("should return userkey with legacy pin PERSISTENT", async () => {
      keyGenerationService.deriveKeyFromPassword.mockResolvedValue(mockPinKey);
      keyGenerationService.stretchKey.mockResolvedValue(mockPinKey);
      kdfConfigService.getKdfConfig.mockResolvedValue(DEFAULT_KDF_CONFIG);
      encryptService.unwrapSymmetricKey.mockResolvedValue(mockUserKey);

      // Arrange
      const mockPin = "1234";
      pinStateService.userKeyEncryptedPin$.mockReturnValueOnce(
        new BehaviorSubject(mockUserKeyEncryptedPin),
      );
      pinStateService.getLegacyPinKeyEncryptedUserKeyPersistent.mockResolvedValueOnce(
        mockUserKeyEncryptedPin,
      );

      // Act
      const result = await sut.decryptUserKeyWithPin(mockPin, mockUserId);

      // Assert
      expect(result).toEqual(mockUserKey);
    });
  });
});

// Test helpers
function randomBytes(length: number): Uint8Array {
  return new Uint8Array(Array.from({ length }, (_, k) => k % 255));
}
