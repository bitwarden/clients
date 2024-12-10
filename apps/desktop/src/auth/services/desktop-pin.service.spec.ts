import { mock } from "jest-mock-extended";

import { FakeMasterPasswordService } from "@bitwarden/common/auth/services/master-password/fake-master-password.service";
import { CryptoFunctionService } from "@bitwarden/common/platform/abstractions/crypto-function.service";
import { EncryptService } from "@bitwarden/common/platform/abstractions/encrypt.service";
import { KeyGenerationService } from "@bitwarden/common/platform/abstractions/key-generation.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { EncString } from "@bitwarden/common/platform/models/domain/enc-string";
import {
  FakeAccountService,
  FakeStateProvider,
  mockAccountServiceWith,
} from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { KdfConfigService } from "@bitwarden/key-management";

import { DesktopPinService } from "./desktop-pin.service";

describe("DesktopPinService", () => {
  let sut: DesktopPinService;

  let accountService: FakeAccountService;
  let masterPasswordService: FakeMasterPasswordService;
  let stateProvider: FakeStateProvider;

  const cryptoFunctionService = mock<CryptoFunctionService>();
  const encryptService = mock<EncryptService>();
  const kdfConfigService = mock<KdfConfigService>();
  const keyGenerationService = mock<KeyGenerationService>();
  const logService = mock<LogService>();
  const stateService = mock<StateService>();

  const mockUserId = Utils.newGuid() as UserId;
  const mockUserEmail = "user@example.com";

  (global as any).ipc = {
    platform: {
      ephemeralStore: {
        getEphemeralValue: jest.fn(),
        setEphemeralValue: jest.fn(),
        removeEphemeralValue: jest.fn(),
      },
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();

    accountService = mockAccountServiceWith(mockUserId, { email: mockUserEmail });
    masterPasswordService = new FakeMasterPasswordService();
    stateProvider = new FakeStateProvider(accountService);

    sut = new DesktopPinService(
      accountService,
      cryptoFunctionService,
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
      await expect(sut.getPinKeyEncryptedUserKeyEphemeral(undefined)).rejects.toThrow(
        "Cannot get pin key encrypted user key ephemeral without a user ID.",
      );
      await expect(sut.clearPinKeyEncryptedUserKeyEphemeral(undefined)).rejects.toThrow(
        "Cannot delete pin key encrypted user key ephemeral without a user ID.",
      );
      await expect(
        sut.setPinKeyEncryptedUserKeyEphemeral(new EncString("value"), undefined),
      ).rejects.toThrow("Cannot set pin key encrypted user key ephemeral without a user ID.");
    });
  });

  describe("getPinKeyEncryptedUserKeyEphemeral", () => {
    it("should return null if the ephemeral value is not found", async () => {
      (global as any).ipc.platform.ephemeralStore.getEphemeralValue.mockResolvedValue(null);

      const result = await sut.getPinKeyEncryptedUserKeyEphemeral(mockUserId);

      expect(result).toBeNull();
    });

    it("should return the EncString if the ephemeral value is found", async () => {
      const mockValue = "mock-value";
      (global as any).ipc.platform.ephemeralStore.getEphemeralValue.mockResolvedValue(mockValue);

      const result = await sut.getPinKeyEncryptedUserKeyEphemeral(mockUserId);

      expect(result).toEqual(new EncString(mockValue));
    });

    it("should call the ephemeral store with the correct key", async () => {
      (global as any).ipc.platform.ephemeralStore.getEphemeralValue.mockResolvedValue(null);

      await sut.getPinKeyEncryptedUserKeyEphemeral(mockUserId);

      expect((global as any).ipc.platform.ephemeralStore.getEphemeralValue).toHaveBeenCalledWith(
        `pinKeyEncryptedUserKeyEphemeral-${mockUserId}`,
      );
    });
  });

  describe("setPinKeyEncryptedUserKeyEphemeral", () => {
    it("should call the ephemeral store with the correct key and value", async () => {
      const mockValue = new EncString("mock-value");

      await sut.setPinKeyEncryptedUserKeyEphemeral(mockValue, mockUserId);

      expect((global as any).ipc.platform.ephemeralStore.setEphemeralValue).toHaveBeenCalledWith(
        `pinKeyEncryptedUserKeyEphemeral-${mockUserId}`,
        mockValue.encryptedString,
      );
    });
  });

  describe("clearPinKeyEncryptedUserKeyEphemeral", () => {
    it("should call the ephemeral store with the correct key", async () => {
      await sut.clearPinKeyEncryptedUserKeyEphemeral(mockUserId);

      expect((global as any).ipc.platform.ephemeralStore.removeEphemeralValue).toHaveBeenCalledWith(
        `pinKeyEncryptedUserKeyEphemeral-${mockUserId}`,
      );
    });
  });
});
