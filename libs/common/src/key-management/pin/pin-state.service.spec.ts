import { firstValueFrom } from "rxjs";

import { PasswordProtectedKeyEnvelope } from "@bitwarden/sdk-internal";

import { FakeAccountService, FakeStateProvider, mockAccountServiceWith } from "../../../spec";
import { Utils } from "../../platform/misc/utils";
import { UserId } from "../../types/guid";
import { EncryptedString } from "../crypto/models/enc-string";

import { PinLockType } from "./pin-lock-type";
import { PinStateService } from "./pin-state.service.implementation";
import {
  USER_KEY_ENCRYPTED_PIN,
  PIN_PROTECTED_USER_KEY_ENVELOPE_EPHEMERAL,
  PIN_PROTECTED_USER_KEY_ENVELOPE_PERSISTENT,
  PIN_KEY_ENCRYPTED_USER_KEY_PERSISTENT,
} from "./pin.state";

describe("PinStateService", () => {
  let sut: PinStateService;

  let accountService: FakeAccountService;
  let stateProvider: FakeStateProvider;

  const mockUserId = Utils.newGuid() as UserId;
  const mockUserEmail = "user@example.com";
  const mockUserKeyEncryptedPin = "userKeyEncryptedPin" as EncryptedString;
  const mockEphemeralEnvelope = "mock-ephemeral-envelope" as PasswordProtectedKeyEnvelope;
  const mockPersistentEnvelope = "mock-persistent-envelope" as PasswordProtectedKeyEnvelope;

  beforeEach(() => {
    accountService = mockAccountServiceWith(mockUserId, { email: mockUserEmail });
    stateProvider = new FakeStateProvider(accountService);

    sut = new PinStateService(stateProvider);
  });

  it("should instantiate the PinStateService", () => {
    expect(sut).not.toBeFalsy();
  });

  describe("getUserKeyWrappedPin$", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test.each([null, undefined])("throws if userId is %p", async (userId) => {
      // Arrange
      await sut.setPinState(
        mockUserId,
        mockPersistentEnvelope,
        mockUserKeyEncryptedPin,
        "PERSISTENT",
      );

      // Act & Assert
      expect(() => sut.getUserKeyWrappedPin$(userId as any)).toThrow(
        "userId is null or undefined.",
      );
    });

    test.each([null, undefined])("emits null if userKeyEncryptedPin is nullish", async (value) => {
      // Arrange
      await stateProvider.setUserState(USER_KEY_ENCRYPTED_PIN, value, mockUserId);

      // Act
      const result = await firstValueFrom(sut.getUserKeyWrappedPin$(mockUserId));

      // Assert
      expect(result).toBe(null);
    });

    it("emits the userKeyEncryptedPin when available", async () => {
      // Arrange
      await sut.setPinState(
        mockUserId,
        mockPersistentEnvelope,
        mockUserKeyEncryptedPin,
        "PERSISTENT",
      );

      // Act
      const result = await firstValueFrom(sut.getUserKeyWrappedPin$(mockUserId));

      // Assert
      expect(result?.encryptedString).toEqual(mockUserKeyEncryptedPin);
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
      await sut.setPinState(
        mockUserId,
        mockPersistentEnvelope,
        mockUserKeyEncryptedPin,
        "PERSISTENT",
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
        mockUserKeyEncryptedPin,
        mockUserId,
      );

      // Act
      const result = await sut.getPinLockType(mockUserId);

      // Assert
      expect(result).toBe("PERSISTENT");
    });

    it("should return 'PERSISTENT' even if user key encrypted pin is also set", async () => {
      // Arrange - set both persistent envelope and user key encrypted pin
      await sut.setPinState(
        mockUserId,
        mockPersistentEnvelope,
        mockUserKeyEncryptedPin,
        "PERSISTENT",
      );

      // Act
      const result = await sut.getPinLockType(mockUserId);

      // Assert
      expect(result).toBe("PERSISTENT");
    });

    it("should return 'EPHEMERAL' if only user key encrypted pin is found", async () => {
      // Arrange
      await stateProvider.setUserState(USER_KEY_ENCRYPTED_PIN, mockUserKeyEncryptedPin, mockUserId);

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

  describe("getPinProtectedUserKeyEnvelope()", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test.each([
      [null, "PERSISTENT" as PinLockType],
      [undefined, "PERSISTENT" as PinLockType],
      [null, "EPHEMERAL" as PinLockType],
      [undefined, "EPHEMERAL" as PinLockType],
      [null, "DISABLED" as PinLockType],
      [undefined, "DISABLED" as PinLockType],
    ])("throws if userId is %p with pinLockType %s", async (userId, pinLockType: PinLockType) => {
      // Using unnecesary switch so we can have exhaustive check on PinLockType
      switch (pinLockType) {
        case "PERSISTENT":
          return await expect(
            sut.getPinProtectedUserKeyEnvelope(userId as any, pinLockType),
          ).rejects.toThrow("userId is null or undefined.");
        case "EPHEMERAL":
          return await expect(
            sut.getPinProtectedUserKeyEnvelope(userId as any, pinLockType),
          ).rejects.toThrow("userId is null or undefined.");
        case "DISABLED":
          return await expect(
            sut.getPinProtectedUserKeyEnvelope(userId as any, pinLockType),
          ).rejects.toThrow("userId is null or undefined.");
        default: {
          // This is the exhaustive check, will cause a compile error if a PinLockType is not handled above
          const _exhaustiveCheck: never = pinLockType;
          return _exhaustiveCheck;
        }
      }
    });

    it("should throw error for unsupported pinLockType", async () => {
      // Act & Assert
      await expect(
        sut.getPinProtectedUserKeyEnvelope(mockUserId, "DISABLED" as any),
      ).rejects.toThrow("Unsupported PinLockType: DISABLED");
    });

    test.each([["PERSISTENT" as PinLockType], ["EPHEMERAL" as PinLockType]])(
      "should return %s envelope when pinLockType is %s",
      async (pinLockType: PinLockType) => {
        // Arrange
        const mockEnvelope =
          pinLockType === "PERSISTENT" ? mockPersistentEnvelope : mockEphemeralEnvelope;

        await sut.setPinState(mockUserId, mockEnvelope, mockUserKeyEncryptedPin, pinLockType);

        // Act
        const result = await sut.getPinProtectedUserKeyEnvelope(mockUserId, pinLockType);

        // Assert
        expect(result).toBe(mockEnvelope);
      },
    );

    test.each([["PERSISTENT" as PinLockType], ["EPHEMERAL" as PinLockType]])(
      "should return null when %s envelope is not set",
      async (pinLockType: PinLockType) => {
        // Arrange - don't set any state

        // Act
        const result = await sut.getPinProtectedUserKeyEnvelope(mockUserId, pinLockType);

        // Assert
        expect(result).toBeNull();
      },
    );

    test.each([
      ["PERSISTENT" as PinLockType, PIN_PROTECTED_USER_KEY_ENVELOPE_PERSISTENT],
      ["EPHEMERAL" as PinLockType, PIN_PROTECTED_USER_KEY_ENVELOPE_EPHEMERAL],
    ])(
      "should return null when %s envelope is explicitly set to null",
      async (pinLockType, keyDefinition) => {
        // Arrange
        await stateProvider.setUserState(keyDefinition, null, mockUserId);

        // Act
        const result = await sut.getPinProtectedUserKeyEnvelope(mockUserId, pinLockType);

        // Assert
        expect(result).toBeNull();
      },
    );

    it("should not cross-contaminate PERSISTENT and EPHEMERAL envelopes", async () => {
      // Arrange - set both envelopes to different values
      await sut.setPinState(
        mockUserId,
        mockPersistentEnvelope,
        mockUserKeyEncryptedPin,
        "PERSISTENT",
      );
      await sut.setPinState(
        mockUserId,
        mockEphemeralEnvelope,
        mockUserKeyEncryptedPin,
        "EPHEMERAL",
      );

      // Act
      const persistentResult = await sut.getPinProtectedUserKeyEnvelope(mockUserId, "PERSISTENT");
      const ephemeralResult = await sut.getPinProtectedUserKeyEnvelope(mockUserId, "EPHEMERAL");

      // Assert
      expect(persistentResult).toBe(mockPersistentEnvelope);
      expect(ephemeralResult).toBe(mockEphemeralEnvelope);
      expect(persistentResult).not.toBe(ephemeralResult);
    });
  });

  describe("getLegacyPinKeyEncryptedUserKeyPersistent()", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test.each([null, undefined])("throws if userId is %p", async (userId) => {
      // Act & Assert
      await expect(() =>
        sut.getLegacyPinKeyEncryptedUserKeyPersistent(userId as any),
      ).rejects.toThrow("userId is null or undefined.");
    });

    it("should return EncString when legacy key is set", async () => {
      // Arrange
      await stateProvider.setUserState(
        PIN_KEY_ENCRYPTED_USER_KEY_PERSISTENT,
        mockUserKeyEncryptedPin,
        mockUserId,
      );

      // Act
      const result = await sut.getLegacyPinKeyEncryptedUserKeyPersistent(mockUserId);

      // Assert
      expect(result?.encryptedString).toEqual(mockUserKeyEncryptedPin);
    });

    test.each([null, undefined])("should return null when legacy key is %p", async (value) => {
      // Arrange
      await stateProvider.setUserState(PIN_KEY_ENCRYPTED_USER_KEY_PERSISTENT, value, mockUserId);

      // Act
      const result = await sut.getLegacyPinKeyEncryptedUserKeyPersistent(mockUserId);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe("setPinState()", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test.each([[null], [undefined]])("throws if userId is %p", async (userId) => {
      // Act & Assert
      await expect(
        sut.setPinState(
          userId as any,
          mockPersistentEnvelope,
          mockUserKeyEncryptedPin,
          "PERSISTENT",
        ),
      ).rejects.toThrow(`userId is null or undefined.`);
    });

    test.each([[null], [undefined]])(
      "throws if pinProtectedUserKeyEnvelope is %p",
      async (envelope) => {
        // Act & Assert
        await expect(
          sut.setPinState(mockUserId, envelope as any, mockUserKeyEncryptedPin, "PERSISTENT"),
        ).rejects.toThrow(`pinProtectedUserKeyEnvelope is null or undefined.`);
      },
    );

    test.each([[null], [undefined]])("throws if pinLockType is %p", async (pinLockType) => {
      // Act & Assert
      await expect(
        sut.setPinState(
          mockUserId,
          mockPersistentEnvelope,
          mockUserKeyEncryptedPin,
          pinLockType as any,
        ),
      ).rejects.toThrow(`pinLockType is null or undefined.`);
    });

    it("should throw error for unsupported pinLockType", async () => {
      // Act & Assert
      await expect(
        sut.setPinState(
          mockUserId,
          mockPersistentEnvelope,
          mockUserKeyEncryptedPin,
          "DISABLED" as PinLockType,
        ),
      ).rejects.toThrow("Cannot set up PIN with pin lock type DISABLED");
    });

    test.each([["PERSISTENT" as PinLockType], ["EPHEMERAL" as PinLockType]])(
      "should set %s PIN state correctly",
      async (pinLockType: PinLockType) => {
        // Arrange
        const mockEnvelope =
          pinLockType === "PERSISTENT" ? mockPersistentEnvelope : mockEphemeralEnvelope;

        // Act
        await sut.setPinState(mockUserId, mockEnvelope, mockUserKeyEncryptedPin, pinLockType);

        // Assert - verify the correct envelope was set
        const envelopeResult = await sut.getPinProtectedUserKeyEnvelope(mockUserId, pinLockType);
        expect(envelopeResult).toBe(mockEnvelope);

        // Assert - verify the user key encrypted PIN was set
        const pinResult = await firstValueFrom(sut.getUserKeyWrappedPin$(mockUserId));
        expect(pinResult?.encryptedString).toEqual(mockUserKeyEncryptedPin);
      },
    );
  });

  describe("clearPinState", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test.each([null, undefined])("throws if userId is %p", async (userId) => {
      // Act & Assert
      await expect(sut.clearPinState(userId as any)).rejects.toThrow(
        `userId is null or undefined.`,
      );
    });

    it("clears UserKey encrypted PIN", async () => {
      // Arrange
      await sut.setPinState(
        mockUserId,
        mockPersistentEnvelope,
        mockUserKeyEncryptedPin,
        "PERSISTENT",
      );

      // Act
      await sut.clearPinState(mockUserId);

      // Assert
      const result = await firstValueFrom(sut.getUserKeyWrappedPin$(mockUserId));
      expect(result).toBeNull();
    });
  });
});
