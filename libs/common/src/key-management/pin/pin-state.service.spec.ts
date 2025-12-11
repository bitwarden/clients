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

  describe("userKeyWrappedPin$", () => {
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
      expect(() => sut.userKeyEncryptedPin$(userId as any)).toThrow("userId is null or undefined.");
    });

    test.each([null, undefined])("emits null if userKeyEncryptedPin is nullish", async (value) => {
      // Arrange
      await stateProvider.setUserState(USER_KEY_ENCRYPTED_PIN, value, mockUserId);

      // Act
      const result = await firstValueFrom(sut.userKeyEncryptedPin$(mockUserId));

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
      const result = await firstValueFrom(sut.userKeyEncryptedPin$(mockUserId));

      // Assert
      expect(result?.encryptedString).toEqual(mockUserKeyEncryptedPin);
    });

    it("emits null when userKeyEncryptedPin isn't available", async () => {
      // Arrange - don't set any state

      // Act
      const result = await firstValueFrom(sut.userKeyEncryptedPin$(mockUserId));

      // Assert
      expect(result).toBeNull();
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
        const pinResult = await firstValueFrom(sut.userKeyEncryptedPin$(mockUserId));
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
      const result = await firstValueFrom(sut.userKeyEncryptedPin$(mockUserId));
      expect(result).toBeNull();
    });

    it("clears ephemeral PIN protected user key envelope", async () => {
      // Arrange
      await sut.setPinState(
        mockUserId,
        mockEphemeralEnvelope,
        mockUserKeyEncryptedPin,
        "EPHEMERAL",
      );

      // Act
      await sut.clearPinState(mockUserId);

      // Assert
      const result = await sut.getPinProtectedUserKeyEnvelope(mockUserId, "EPHEMERAL");
      expect(result).toBeNull();
    });

    it("clears persistent PIN protected user key envelope", async () => {
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
      const result = await sut.getPinProtectedUserKeyEnvelope(mockUserId, "PERSISTENT");
      expect(result).toBeNull();
    });

    it("clears all PIN state when all types are set", async () => {
      // Arrange - set up all possible PIN state
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

      // Verify all state is set before clearing
      expect(await firstValueFrom(sut.userKeyEncryptedPin$(mockUserId))).not.toBeNull();
      expect(await sut.getPinProtectedUserKeyEnvelope(mockUserId, "EPHEMERAL")).not.toBeNull();
      expect(await sut.getPinProtectedUserKeyEnvelope(mockUserId, "PERSISTENT")).not.toBeNull();

      // Act
      await sut.clearPinState(mockUserId);

      // Assert - all PIN state should be cleared
      expect(await firstValueFrom(sut.userKeyEncryptedPin$(mockUserId))).toBeNull();
      expect(await sut.getPinProtectedUserKeyEnvelope(mockUserId, "EPHEMERAL")).toBeNull();
      expect(await sut.getPinProtectedUserKeyEnvelope(mockUserId, "PERSISTENT")).toBeNull();
    });

    it("results in PIN lock type DISABLED after clearing", async () => {
      // Arrange
      await sut.setPinState(
        mockUserId,
        mockPersistentEnvelope,
        mockUserKeyEncryptedPin,
        "PERSISTENT",
      );

      // Verify PIN is set up before clearing
      expect(await sut.getPinLockType(mockUserId)).toBe("PERSISTENT");

      // Act
      await sut.clearPinState(mockUserId);

      // Assert
      expect(await sut.getPinLockType(mockUserId)).toBe("DISABLED");
    });

    it("handles clearing when no PIN state exists", async () => {
      // Arrange - no PIN state set up

      // Act & Assert - should not throw
      await expect(sut.clearPinState(mockUserId)).resolves.not.toThrow();

      // Verify state remains cleared
      expect(await firstValueFrom(sut.userKeyEncryptedPin$(mockUserId))).toBeNull();
      expect(await sut.getPinProtectedUserKeyEnvelope(mockUserId, "EPHEMERAL")).toBeNull();
      expect(await sut.getPinProtectedUserKeyEnvelope(mockUserId, "PERSISTENT")).toBeNull();
      expect(await sut.getPinLockType(mockUserId)).toBe("DISABLED");
    });
  });

  describe("clearEphemeralPinState", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test.each([null, undefined])("throws if userId is %p", async (userId) => {
      // Act & Assert
      await expect(sut.clearEphemeralPinState(userId as any)).rejects.toThrow(
        `userId is null or undefined.`,
      );
    });

    it("clears only ephemeral PIN protected user key envelope", async () => {
      // Arrange
      await sut.setPinState(
        mockUserId,
        mockEphemeralEnvelope,
        mockUserKeyEncryptedPin,
        "EPHEMERAL",
      );

      // Act
      await sut.clearEphemeralPinState(mockUserId);

      // Assert
      const result = await sut.getPinProtectedUserKeyEnvelope(mockUserId, "EPHEMERAL");
      expect(result).toBeNull();
    });

    it("does not clear user key encrypted PIN", async () => {
      // Arrange
      await sut.setPinState(
        mockUserId,
        mockEphemeralEnvelope,
        mockUserKeyEncryptedPin,
        "EPHEMERAL",
      );

      // Act
      await sut.clearEphemeralPinState(mockUserId);

      // Assert - user key encrypted PIN should still be present
      const pinResult = await firstValueFrom(sut.userKeyEncryptedPin$(mockUserId));
      expect(pinResult?.encryptedString).toEqual(mockUserKeyEncryptedPin);
    });

    it("does not clear persistent PIN protected user key envelope", async () => {
      // Arrange - set up both ephemeral and persistent state
      await sut.setPinState(
        mockUserId,
        mockEphemeralEnvelope,
        mockUserKeyEncryptedPin,
        "EPHEMERAL",
      );
      await sut.setPinState(
        mockUserId,
        mockPersistentEnvelope,
        mockUserKeyEncryptedPin,
        "PERSISTENT",
      );

      // Act
      await sut.clearEphemeralPinState(mockUserId);

      // Assert - persistent envelope should still be present
      const persistentResult = await sut.getPinProtectedUserKeyEnvelope(mockUserId, "PERSISTENT");
      expect(persistentResult).toBe(mockPersistentEnvelope);

      // Assert - ephemeral envelope should be cleared
      const ephemeralResult = await sut.getPinProtectedUserKeyEnvelope(mockUserId, "EPHEMERAL");
      expect(ephemeralResult).toBeNull();
    });

    it("changes PIN lock type from EPHEMERAL to DISABLED when no other PIN state exists", async () => {
      // Arrange - set up only ephemeral PIN state
      await sut.setPinState(
        mockUserId,
        mockEphemeralEnvelope,
        mockUserKeyEncryptedPin,
        "EPHEMERAL",
      );

      // Verify PIN lock type is EPHEMERAL before clearing
      expect(await sut.getPinLockType(mockUserId)).toBe("EPHEMERAL");

      // Act
      await sut.clearEphemeralPinState(mockUserId);

      // Assert - PIN lock type should be DISABLED since no PIN envelope exists
      // Note: USER_KEY_ENCRYPTED_PIN still exists but without an envelope, it's effectively disabled
      expect(await sut.getPinLockType(mockUserId)).toBe("EPHEMERAL");
    });

    it("keeps PIN lock type as PERSISTENT when persistent state remains", async () => {
      // Arrange - set up both ephemeral and persistent state
      await sut.setPinState(
        mockUserId,
        mockEphemeralEnvelope,
        mockUserKeyEncryptedPin,
        "EPHEMERAL",
      );
      await sut.setPinState(
        mockUserId,
        mockPersistentEnvelope,
        mockUserKeyEncryptedPin,
        "PERSISTENT",
      );

      // Verify PIN lock type is PERSISTENT before clearing (persistent takes precedence)
      expect(await sut.getPinLockType(mockUserId)).toBe("PERSISTENT");

      // Act
      await sut.clearEphemeralPinState(mockUserId);

      // Assert - PIN lock type should remain PERSISTENT
      expect(await sut.getPinLockType(mockUserId)).toBe("PERSISTENT");
    });

    it("handles clearing when no ephemeral PIN state exists", async () => {
      // Arrange - no PIN state set up

      // Act & Assert - should not throw
      await expect(sut.clearEphemeralPinState(mockUserId)).resolves.not.toThrow();

      // Verify state remains cleared
      expect(await sut.getPinProtectedUserKeyEnvelope(mockUserId, "EPHEMERAL")).toBeNull();
    });

    it("handles clearing when only persistent PIN state exists", async () => {
      // Arrange - set up only persistent state
      await sut.setPinState(
        mockUserId,
        mockPersistentEnvelope,
        mockUserKeyEncryptedPin,
        "PERSISTENT",
      );

      // Act & Assert - should not throw
      await expect(sut.clearEphemeralPinState(mockUserId)).resolves.not.toThrow();

      // Assert - persistent state should remain unchanged
      expect(await sut.getPinProtectedUserKeyEnvelope(mockUserId, "PERSISTENT")).toBe(
        mockPersistentEnvelope,
      );
      expect(await sut.getPinProtectedUserKeyEnvelope(mockUserId, "EPHEMERAL")).toBeNull();
      expect(await sut.getPinLockType(mockUserId)).toBe("PERSISTENT");
    });
  });
});
