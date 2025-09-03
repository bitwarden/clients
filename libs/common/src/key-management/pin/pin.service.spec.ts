import { mock } from "jest-mock-extended";
import { BehaviorSubject, filter, firstValueFrom, of } from "rxjs";

// eslint-disable-next-line no-restricted-imports
import { DEFAULT_KDF_CONFIG, KdfConfigService, KeyService } from "@bitwarden/key-management";
import { PasswordProtectedKeyEnvelope } from "@bitwarden/sdk-internal";

import { MockSdkService } from "../..//platform/spec/mock-sdk.service";
import { FakeAccountService, FakeStateProvider, mockAccountServiceWith } from "../../../spec";
import { LogService } from "../../platform/abstractions/log.service";
import { Utils } from "../../platform/misc/utils";
import { SymmetricCryptoKey } from "../../platform/models/domain/symmetric-crypto-key";
import { UserId } from "../../types/guid";
import { PinKey, UserKey } from "../../types/key";
import { KeyGenerationService } from "../crypto";
import { EncryptService } from "../crypto/abstractions/encrypt.service";
import { EncString } from "../crypto/models/enc-string";

import { PinService } from "./pin.service.implementation";
import {
  USER_KEY_ENCRYPTED_PIN,
  PIN_PROTECTED_USER_KEY_ENVELOPE_EPHEMERAL,
  PIN_PROTECTED_USER_KEY_ENVELOPE_PERSISTENT,
  PIN_KEY_ENCRYPTED_USER_KEY_PERSISTENT,
} from "./pin.state";

describe("PinService", () => {
  let sut: PinService;

  let accountService: FakeAccountService;
  let stateProvider: FakeStateProvider;

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
  const behaviorSubject = new BehaviorSubject<{ userId: UserId; userKey: UserKey }>(null);

  const enroll_pin = jest.fn();
  const unseal_password_protected_key_envelope = jest.fn().mockResolvedValue(new Uint8Array(64));
  const mockSdkClient = {
    crypto: jest.fn().mockReturnValue({
      enroll_pin: enroll_pin,
      get_pin: jest.fn(),
      unset_pin: jest.fn(),
      unseal_password_protected_key_envelope: unseal_password_protected_key_envelope,
    }),
  };
  const mockRef = {
    value: mockSdkClient,
    [Symbol.dispose]: jest.fn(),
  };
  const mockSdk = {
    take: jest.fn().mockReturnValue(mockRef),
  };

  beforeEach(() => {
    accountService = mockAccountServiceWith(mockUserId, { email: mockUserEmail });
    stateProvider = new FakeStateProvider(accountService);
    (keyService as any)["unlockedUserKeys$"] = behaviorSubject
      .asObservable()
      .pipe(filter((x) => x != null));
    sdkService.userClient$ = jest.fn((userId: UserId) => of(mockSdk)) as any;
    sdkService.client$ = jest.fn(() => of(mockSdk)) as any;

    sut = new PinService(
      accountService,
      encryptService,
      kdfConfigService,
      keyGenerationService,
      logService,
      stateProvider,
      keyService,
      sdkService,
    );
  });

  it("should instantiate the PinService", () => {
    expect(sut).not.toBeFalsy();
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
      await stateProvider.setUserState(
        USER_KEY_ENCRYPTED_PIN,
        mockUserKeyEncryptedPin.encryptedString,
        mockUserId,
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
      // Set up some initial state to verify it gets cleared
      await stateProvider.setUserState(
        USER_KEY_ENCRYPTED_PIN,
        mockUserKeyEncryptedPin.encryptedString,
        mockUserId,
      );
      await stateProvider.setUserState(
        PIN_PROTECTED_USER_KEY_ENVELOPE_EPHEMERAL,
        mockEphemeralEnvelope,
        mockUserId,
      );
      await stateProvider.setUserState(
        PIN_PROTECTED_USER_KEY_ENVELOPE_PERSISTENT,
        mockPersistentEnvelope,
        mockUserId,
      );
      await stateProvider.setUserState(
        PIN_KEY_ENCRYPTED_USER_KEY_PERSISTENT,
        mockUserKeyEncryptedPin.encryptedString,
        mockUserId,
      );
    });

    it("should clear all PIN-related state for the user", async () => {
      // Act
      await sut.unsetPin(mockUserId);

      // Assert - verify all PIN-related state is cleared
      const userKeyEncryptedPin = await firstValueFrom(
        stateProvider.getUserState$(USER_KEY_ENCRYPTED_PIN, mockUserId),
      );
      const ephemeralEnvelope = await firstValueFrom(
        stateProvider.getUserState$(PIN_PROTECTED_USER_KEY_ENVELOPE_EPHEMERAL, mockUserId),
      );
      const persistentEnvelope = await firstValueFrom(
        stateProvider.getUserState$(PIN_PROTECTED_USER_KEY_ENVELOPE_PERSISTENT, mockUserId),
      );
      const legacyKey = await firstValueFrom(
        stateProvider.getUserState$(PIN_KEY_ENCRYPTED_USER_KEY_PERSISTENT, mockUserId),
      );

      expect(userKeyEncryptedPin).toBeNull();
      expect(ephemeralEnvelope).toBeNull();
      expect(persistentEnvelope).toBeNull();
      expect(legacyKey).toBeNull();
    });

    it("should throw an error if userId is null", async () => {
      // Act & Assert
      await expect(sut.unsetPin(null as any)).rejects.toThrow("userId");
    });

    it("should handle clearing state that is already null", async () => {
      // Arrange - clear all state first
      await stateProvider.setUserState(USER_KEY_ENCRYPTED_PIN, null, mockUserId);
      await stateProvider.setUserState(PIN_PROTECTED_USER_KEY_ENVELOPE_EPHEMERAL, null, mockUserId);
      await stateProvider.setUserState(
        PIN_PROTECTED_USER_KEY_ENVELOPE_PERSISTENT,
        null,
        mockUserId,
      );
      await stateProvider.setUserState(PIN_KEY_ENCRYPTED_USER_KEY_PERSISTENT, null, mockUserId);

      // Act - should not throw
      await expect(sut.unsetPin(mockUserId)).resolves.not.toThrow();

      // Assert - verify state remains null
      const userKeyEncryptedPin = await firstValueFrom(
        stateProvider.getUserState$(USER_KEY_ENCRYPTED_PIN, mockUserId),
      );
      expect(userKeyEncryptedPin).toBeNull();
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
      enroll_pin.mockReturnValue({
        pinProtectedUserKeyEnvelope: mockPinProtectedUserKeyEnvelope,
        userKeyEncryptedPin: mockUserKeyEncryptedPinFromSdk,
      });

      await sut.setPin(mockPin, "EPHEMERAL", mockUserId);

      const ephemeralPin = await firstValueFrom(
        stateProvider.getUserState$(PIN_PROTECTED_USER_KEY_ENVELOPE_EPHEMERAL, mockUserId),
      );
      expect(ephemeralPin).toBe(mockPinProtectedUserKeyEnvelope);
      const persistentPin = await firstValueFrom(
        stateProvider.getUserState$(PIN_PROTECTED_USER_KEY_ENVELOPE_PERSISTENT, mockUserId),
      );
      expect(persistentPin).toBeNull();
      const userKeyEncryptedPin = await firstValueFrom(
        stateProvider.getUserState$(USER_KEY_ENCRYPTED_PIN, mockUserId),
      );
      expect(userKeyEncryptedPin).toBe(mockUserKeyEncryptedPinFromSdk);
    });

    it("should successfully set a PERSISTENT pin", async () => {
      enroll_pin.mockReturnValue({
        pinProtectedUserKeyEnvelope: mockPinProtectedUserKeyEnvelope,
        userKeyEncryptedPin: mockUserKeyEncryptedPinFromSdk,
      });

      await sut.setPin(mockPin, "PERSISTENT", mockUserId);

      const persistentPin = await firstValueFrom(
        stateProvider.getUserState$(PIN_PROTECTED_USER_KEY_ENVELOPE_PERSISTENT, mockUserId),
      );
      expect(persistentPin).toBe(mockPinProtectedUserKeyEnvelope);
      const ephemeralPin = await firstValueFrom(
        stateProvider.getUserState$(PIN_PROTECTED_USER_KEY_ENVELOPE_EPHEMERAL, mockUserId),
      );
      expect(ephemeralPin).toBeNull();
      const userKeyEncryptedPin = await firstValueFrom(
        stateProvider.getUserState$(USER_KEY_ENCRYPTED_PIN, mockUserId),
      );
      expect(userKeyEncryptedPin).toBe(mockUserKeyEncryptedPinFromSdk);
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

    it("should return 'PERSISTENT' if a pin protected user key (persistent) is found", async () => {
      // Arrange
      await stateProvider.setUserState(
        PIN_PROTECTED_USER_KEY_ENVELOPE_PERSISTENT,
        mockPersistentEnvelope,
        mockUserId,
      );

      // Act
      const result = await sut.getPinLockType(mockUserId);

      // Assert
      expect(result).toBe("PERSISTENT");
    });

    it("should return 'PERSISTENT' if a legacy pin key encrypted user key (persistent) is found", async () => {
      // Arrange
      await stateProvider.setUserState(
        PIN_KEY_ENCRYPTED_USER_KEY_PERSISTENT,
        mockUserKeyEncryptedPin.encryptedString,
        mockUserId,
      );

      // Act
      const result = await sut.getPinLockType(mockUserId);

      // Assert
      expect(result).toBe("PERSISTENT");
    });

    it("should return 'PERSISTENT' even if user key encrypted pin is also set", async () => {
      // Arrange - set both persistent envelope and user key encrypted pin
      await stateProvider.setUserState(
        PIN_PROTECTED_USER_KEY_ENVELOPE_PERSISTENT,
        mockPersistentEnvelope,
        mockUserId,
      );
      await stateProvider.setUserState(
        USER_KEY_ENCRYPTED_PIN,
        mockUserKeyEncryptedPin.encryptedString,
        mockUserId,
      );

      // Act
      const result = await sut.getPinLockType(mockUserId);

      // Assert
      expect(result).toBe("PERSISTENT");
    });

    it("should return 'EPHEMERAL' if only user key encrypted pin is found", async () => {
      // Arrange
      await stateProvider.setUserState(
        USER_KEY_ENCRYPTED_PIN,
        mockUserKeyEncryptedPin.encryptedString,
        mockUserId,
      );

      // Act
      const result = await sut.getPinLockType(mockUserId);

      // Assert
      expect(result).toBe("EPHEMERAL");
    });

    it("should return 'DISABLED' if no PIN-related state is found", async () => {
      // Arrange - don't set any PIN-related state

      // Act
      const result = await sut.getPinLockType(mockUserId);

      // Assert
      expect(result).toBe("DISABLED");
    });

    it("should return 'DISABLED' if all PIN-related state is null", async () => {
      // Arrange - explicitly set all state to null
      await stateProvider.setUserState(
        PIN_PROTECTED_USER_KEY_ENVELOPE_PERSISTENT,
        null,
        mockUserId,
      );
      await stateProvider.setUserState(PIN_KEY_ENCRYPTED_USER_KEY_PERSISTENT, null, mockUserId);
      await stateProvider.setUserState(USER_KEY_ENCRYPTED_PIN, null, mockUserId);

      // Act
      const result = await sut.getPinLockType(mockUserId);

      // Assert
      expect(result).toBe("DISABLED");
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
      // Arrange - set persistent envelope
      await stateProvider.setUserState(
        PIN_PROTECTED_USER_KEY_ENVELOPE_PERSISTENT,
        mockPersistentEnvelope,
        mockUserId,
      );

      // Act
      const result = await sut.isPinDecryptionAvailable(mockUserId);

      // Assert
      expect(result).toBe(true);
    });

    it("should return true if pinLockType is PERSISTENT with legacy key", async () => {
      // Arrange - set legacy persistent key
      await stateProvider.setUserState(
        PIN_KEY_ENCRYPTED_USER_KEY_PERSISTENT,
        mockUserKeyEncryptedPin.encryptedString,
        mockUserId,
      );

      // Act
      const result = await sut.isPinDecryptionAvailable(mockUserId);

      // Assert
      expect(result).toBe(true);
    });

    it("should return true if pinLockType is EPHEMERAL and ephemeral envelope is available", async () => {
      // Arrange - set both ephemeral state (for EPHEMERAL lock type) and ephemeral envelope (for decryption availability)
      await stateProvider.setUserState(
        USER_KEY_ENCRYPTED_PIN,
        mockUserKeyEncryptedPin.encryptedString,
        mockUserId,
      );
      await stateProvider.setUserState(
        PIN_PROTECTED_USER_KEY_ENVELOPE_EPHEMERAL,
        mockEphemeralEnvelope,
        mockUserId,
      );

      // Act
      const result = await sut.isPinDecryptionAvailable(mockUserId);

      // Assert
      expect(result).toBe(true);
    });

    it("should return false if pinLockType is EPHEMERAL but ephemeral envelope is not available", async () => {
      // Arrange - set only user key encrypted pin (EPHEMERAL) but no ephemeral envelope
      await stateProvider.setUserState(
        USER_KEY_ENCRYPTED_PIN,
        mockUserKeyEncryptedPin.encryptedString,
        mockUserId,
      );
      // Don't set PIN_PROTECTED_USER_KEY_ENVELOPE_EPHEMERAL

      // Act
      const result = await sut.isPinDecryptionAvailable(mockUserId);

      // Assert
      expect(result).toBe(false);
    });

    it("should return false if pinLockType is EPHEMERAL and ephemeral envelope is null", async () => {
      // Arrange - set ephemeral state but explicitly set ephemeral envelope to null
      await stateProvider.setUserState(
        USER_KEY_ENCRYPTED_PIN,
        mockUserKeyEncryptedPin.encryptedString,
        mockUserId,
      );
      await stateProvider.setUserState(PIN_PROTECTED_USER_KEY_ENVELOPE_EPHEMERAL, null, mockUserId);

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

    it("should prioritize PERSISTENT over EPHEMERAL even when both are set", async () => {
      // Arrange - set both persistent and ephemeral state
      await stateProvider.setUserState(
        PIN_PROTECTED_USER_KEY_ENVELOPE_PERSISTENT,
        mockPersistentEnvelope,
        mockUserId,
      );
      await stateProvider.setUserState(
        USER_KEY_ENCRYPTED_PIN,
        mockUserKeyEncryptedPin.encryptedString,
        mockUserId,
      );
      // Don't set ephemeral envelope to test that persistent takes priority

      // Act
      const result = await sut.isPinDecryptionAvailable(mockUserId);

      // Assert
      expect(result).toBe(true); // Should be true because of PERSISTENT, not affected by missing ephemeral envelope
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

  describe("constructor subscription", () => {
    let mockGetPin: jest.SpyInstance;
    let mockSetPin: jest.SpyInstance;
    let mockGetPinLockType: jest.SpyInstance;
    let mockIsPinDecryptionAvailable: jest.SpyInstance;

    beforeEach(() => {
      jest.clearAllMocks();
      // Mock the methods that will be called in the subscription
      mockGetPin = jest.spyOn(sut, "getPin");
      mockSetPin = jest.spyOn(sut, "setPin");
      mockGetPinLockType = jest.spyOn(sut, "getPinLockType");
      mockIsPinDecryptionAvailable = jest.spyOn(sut, "isPinDecryptionAvailable");
    });

    it("should set up ephemeral PIN after first unlock when PIN lock type is EPHEMERAL and decryption is not available", async () => {
      // Arrange
      const mockPin = "1234";
      mockGetPinLockType.mockResolvedValue("EPHEMERAL");
      mockIsPinDecryptionAvailable.mockResolvedValue(false);
      mockGetPin.mockResolvedValue(mockPin);
      mockSetPin.mockResolvedValue(undefined);

      // Act - emit a user key unlock event
      behaviorSubject.next({ userId: mockUserId, userKey: mockUserKey });

      // Wait for the async operations to complete
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Assert
      expect(mockGetPinLockType).toHaveBeenCalledWith(mockUserId);
      expect(mockIsPinDecryptionAvailable).toHaveBeenCalledWith(mockUserId);
      expect(mockGetPin).toHaveBeenCalledWith(mockUserId);
      expect(mockSetPin).toHaveBeenCalledWith(mockPin, "EPHEMERAL", mockUserId);
    });
  });

  describe("logout", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("should throw when userId is null", async () => {
      await expect(sut.logout(null as any)).rejects.toThrow("userId");
    });
    it("should clear the ephemeral user state", async () => {
      // Arrange
      await stateProvider.setUserState(
        PIN_PROTECTED_USER_KEY_ENVELOPE_EPHEMERAL,
        mockEphemeralEnvelope,
        mockUserId,
      );

      // Act
      await sut.logout(mockUserId);

      // Assert
      const ephemeralEnvelope = await firstValueFrom(
        stateProvider.getUserState$(PIN_PROTECTED_USER_KEY_ENVELOPE_EPHEMERAL, mockUserId),
      );
      expect(ephemeralEnvelope).toBeNull();
    });
  });

  describe("decryptUserKeyWithPin", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("should throw an error if userId is null", async () => {
      await expect(sut.decryptUserKeyWithPin("1234", null as any)).rejects.toThrow("userId");
    });

    it("should throw an error if pin is null", async () => {
      await expect(sut.decryptUserKeyWithPin(null as any, mockUserId)).rejects.toThrow("pin");
    });

    it("should return userkey with new pin EPHEMERAL", async () => {
      sdkService.client$ = of(mockSdkClient) as any; // Mock the client$ to return the mock SDK
      // Arrange
      const mockPin = "1234";
      await stateProvider.setUserState(
        USER_KEY_ENCRYPTED_PIN,
        mockUserKeyEncryptedPin.encryptedString,
        mockUserId,
      );
      await stateProvider.setUserState(
        PIN_PROTECTED_USER_KEY_ENVELOPE_EPHEMERAL,
        mockEphemeralEnvelope,
        mockUserId,
      );

      // Act
      const result = await sut.decryptUserKeyWithPin(mockPin, mockUserId);

      // Assert
      expect(result).toEqual(mockUserKey);
    });

    it("should return userkey with new pin PERSISTENT", async () => {
      sdkService.client$ = of(mockSdkClient) as any; // Mock the client$ to return the mock SDK
      // Arrange
      const mockPin = "1234";
      await stateProvider.setUserState(
        USER_KEY_ENCRYPTED_PIN,
        mockUserKeyEncryptedPin.encryptedString,
        mockUserId,
      );
      await stateProvider.setUserState(
        PIN_PROTECTED_USER_KEY_ENVELOPE_PERSISTENT,
        mockPersistentEnvelope,
        mockUserId,
      );

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
      await stateProvider.setUserState(
        USER_KEY_ENCRYPTED_PIN,
        mockUserKeyEncryptedPin.encryptedString,
        mockUserId,
      );
      await stateProvider.setUserState(
        PIN_KEY_ENCRYPTED_USER_KEY_PERSISTENT,
        mockUserKeyEncryptedPin.encryptedString,
        mockUserId,
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
