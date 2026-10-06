import { mock } from "jest-mock-extended";

import { VaultTimeoutSettingsService } from "@bitwarden/common/key-management/vault-timeout";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { IpcService } from "@bitwarden/common/platform/ipc";
import { makeSymmetricCryptoKey } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { UserKey } from "@bitwarden/common/types/key";
import {
  KeyService,
  BiometricStateService,
  BiometricsCommands,
  BiometricsStatus,
} from "@bitwarden/key-management";
import {
  BiometricsStatus as SdkBiometricsStatus,
  ipcRequestAuthenticateBiometrics,
  ipcRequestGetBiometricsStatus,
  ipcRequestUnlockBiometrics,
} from "@bitwarden/sdk-internal";
import { UnlockMethod, UnlockService } from "@bitwarden/unlock";

import { NativeMessagingBackground } from "../../background/nativeMessaging.background";
import { BrowserApi } from "../../platform/browser/browser-api";

import { BackgroundBrowserBiometricsService } from "./background-browser-biometrics.service";

jest.mock("@bitwarden/sdk-internal", () => ({
  ...jest.requireActual("@bitwarden/sdk-internal"),
  ipcRequestAuthenticateBiometrics: jest.fn(),
  ipcRequestGetBiometricsStatus: jest.fn(),
  ipcRequestUnlockBiometrics: jest.fn(),
}));

const userId = "bc205928-7552-491a-b4c4-b4a9015cf4e0" as UserId;
const userKey = makeSymmetricCryptoKey<UserKey>();

describe("background browser biometrics service tests", function () {
  let service: BackgroundBrowserBiometricsService;

  const nativeMessagingBackground = mock<NativeMessagingBackground>();
  const logService = mock<LogService>();
  const keyService = mock<KeyService>();
  const biometricStateService = mock<BiometricStateService>();
  const messagingService = mock<MessagingService>();
  const vaultTimeoutSettingsService = mock<VaultTimeoutSettingsService>();
  const mockConfigService = mock<ConfigService>();
  const ipcService = mock<IpcService>();
  const platformUtilsService = mock<PlatformUtilsService>();
  const unlockService = mock<UnlockService>();

  beforeEach(async () => {
    jest.resetAllMocks();
    jest.useFakeTimers();
    // jsdom has no `AbortSignal.timeout`, which the SDK IPC path uses.
    AbortSignal.timeout = jest.fn(() => new AbortController().signal);
    nativeMessagingBackground.connected = true;
    service = new BackgroundBrowserBiometricsService(
      () => nativeMessagingBackground,
      () => mockConfigService,
      logService,
      () => keyService,
      biometricStateService,
      messagingService,
      () => vaultTimeoutSettingsService,
      () => ipcService,
      platformUtilsService,
    );
    await service.setUnlockService(unlockService);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe("authenticateWithBiometrics", () => {
    it.each([
      [true, true],
      [true, false],
      [false, false],
    ])(
      "returns the native messaging result when isSafari is %s and the SDK IPC flag is %s",
      async (isSafari, biometricsSdkIpcFlag) => {
        platformUtilsService.isSafari.mockReturnValue(isSafari);
        mockConfigService.getFeatureFlag.mockResolvedValue(biometricsSdkIpcFlag);
        nativeMessagingBackground.callCommand.mockResolvedValue({ response: true });

        const result = await service.authenticateWithBiometrics();

        expect(result).toBe(true);
        expect(nativeMessagingBackground.callCommand).toHaveBeenCalledWith({
          command: BiometricsCommands.AuthenticateWithBiometrics,
        });
        expect(ipcRequestAuthenticateBiometrics).not.toHaveBeenCalled();
      },
    );

    it("returns the SDK IPC result when not on Safari and the SDK IPC flag is on", async () => {
      platformUtilsService.isSafari.mockReturnValue(false);
      mockConfigService.getFeatureFlag.mockResolvedValue(true);
      jest.mocked(ipcRequestAuthenticateBiometrics).mockResolvedValue(true);

      const result = await service.authenticateWithBiometrics();

      expect(result).toBe(true);
      expect(ipcRequestAuthenticateBiometrics).toHaveBeenCalled();
      expect(nativeMessagingBackground.callCommand).not.toHaveBeenCalled();
    });
  });

  describe("getBiometricsStatus", () => {
    beforeEach(() => {
      jest.spyOn(BrowserApi, "permissionsGranted").mockResolvedValue(true);
    });

    it.each([
      [true, true],
      [true, false],
      [false, false],
    ])(
      "returns the native messaging status when isSafari is %s and the SDK IPC flag is %s",
      async (isSafari, biometricsSdkIpcFlag) => {
        platformUtilsService.isSafari.mockReturnValue(isSafari);
        mockConfigService.getFeatureFlag.mockResolvedValue(biometricsSdkIpcFlag);
        nativeMessagingBackground.callCommand.mockResolvedValue({
          response: BiometricsStatus.HardwareUnavailable,
        });

        const result = await service.getBiometricsStatus();

        expect(result).toBe(BiometricsStatus.HardwareUnavailable);
        expect(nativeMessagingBackground.callCommand).toHaveBeenCalledWith({
          command: BiometricsCommands.GetBiometricsStatus,
        });
      },
    );

    it("returns Available without native messaging when not on Safari and the SDK IPC flag is on", async () => {
      platformUtilsService.isSafari.mockReturnValue(false);
      mockConfigService.getFeatureFlag.mockResolvedValue(true);

      const result = await service.getBiometricsStatus();

      expect(result).toBe(BiometricsStatus.Available);
      expect(nativeMessagingBackground.callCommand).not.toHaveBeenCalled();
    });
  });

  describe("unlockWithBiometricsForUser", () => {
    it.each([
      [true, true],
      [true, false],
      [false, false],
    ])(
      "unlocks with the native messaging user key when isSafari is %s and the SDK IPC flag is %s",
      async (isSafari, biometricsSdkIpcFlag) => {
        platformUtilsService.isSafari.mockReturnValue(isSafari);
        mockConfigService.getFeatureFlag.mockResolvedValue(biometricsSdkIpcFlag);
        nativeMessagingBackground.callCommand.mockResolvedValue({
          response: true,
          userKeyB64: userKey.keyB64,
        });

        const result = await service.unlockWithBiometricsForUser(userId);

        expect(result).toEqual(userKey);
        expect(nativeMessagingBackground.callCommand).toHaveBeenCalledWith({
          command: BiometricsCommands.UnlockWithBiometricsForUser,
          userId,
        });
        expect(unlockService.unlockWithDecryptedUserKey).toHaveBeenCalledWith(
          userId,
          userKey,
          UnlockMethod.Biometrics,
        );
        expect(biometricStateService.setBiometricUnlockEnabled).toHaveBeenCalledWith(true, userId);
        expect(ipcRequestUnlockBiometrics).not.toHaveBeenCalled();
      },
    );

    it("unlocks with the SDK IPC user key when not on Safari and the SDK IPC flag is on", async () => {
      platformUtilsService.isSafari.mockReturnValue(false);
      mockConfigService.getFeatureFlag.mockResolvedValue(true);
      jest.mocked(ipcRequestUnlockBiometrics).mockResolvedValue({ user_key: userKey.toSdk() });
      keyService.validateUserKey.mockResolvedValue(true);

      const result = await service.unlockWithBiometricsForUser(userId);

      expect(result).toEqual(userKey);
      expect(ipcRequestUnlockBiometrics).toHaveBeenCalled();
      expect(unlockService.unlockWithDecryptedUserKey).toHaveBeenCalledWith(
        userId,
        userKey,
        UnlockMethod.Biometrics,
      );
      expect(biometricStateService.setBiometricUnlockEnabled).toHaveBeenCalledWith(true, userId);
      expect(nativeMessagingBackground.callCommand).not.toHaveBeenCalled();
    });
  });

  describe("getBiometricsStatusForUser", () => {
    it.each([
      [true, true],
      [true, false],
      [false, false],
    ])(
      "returns the native messaging status when isSafari is %s and the SDK IPC flag is %s",
      async (isSafari, biometricsSdkIpcFlag) => {
        platformUtilsService.isSafari.mockReturnValue(isSafari);
        mockConfigService.getFeatureFlag.mockResolvedValue(biometricsSdkIpcFlag);
        nativeMessagingBackground.callCommand.mockResolvedValue({
          response: BiometricsStatus.NotEnabledInConnectedDesktopApp,
        });

        const result = await service.getBiometricsStatusForUser(userId);

        expect(result).toBe(BiometricsStatus.NotEnabledInConnectedDesktopApp);
        expect(nativeMessagingBackground.callCommand).toHaveBeenCalledWith({
          command: BiometricsCommands.GetBiometricsStatusForUser,
          userId,
        });
        expect(ipcRequestGetBiometricsStatus).not.toHaveBeenCalled();
      },
    );

    it("returns the SDK IPC status when not on Safari and the SDK IPC flag is on", async () => {
      platformUtilsService.isSafari.mockReturnValue(false);
      mockConfigService.getFeatureFlag.mockResolvedValue(true);
      jest
        .mocked(ipcRequestGetBiometricsStatus)
        .mockResolvedValue(SdkBiometricsStatus.UnlockNeeded);

      const result = await service.getBiometricsStatusForUser(userId);

      expect(result).toBe(BiometricsStatus.UnlockNeeded);
      expect(nativeMessagingBackground.callCommand).not.toHaveBeenCalled();
    });
  });

  describe("canEnableBiometricUnlock", () => {
    const table: [BiometricsStatus, boolean, boolean][] = [
      // status, already enabled, expected

      // if the setting is not already on, it should only be possible to enable it if biometrics are available
      [BiometricsStatus.Available, false, true],
      [BiometricsStatus.HardwareUnavailable, false, false],
      [BiometricsStatus.NotEnabledInConnectedDesktopApp, false, false],
      [BiometricsStatus.DesktopDisconnected, false, false],

      // if the setting is already on, it should always be possible to disable it
      [BiometricsStatus.Available, true, true],
      [BiometricsStatus.HardwareUnavailable, true, true],
      [BiometricsStatus.NotEnabledInConnectedDesktopApp, true, true],
      [BiometricsStatus.DesktopDisconnected, true, true],
    ];
    test.each(table)(
      "status: %s, already enabled: %s, expected: %s",
      async (status, alreadyEnabled, expected) => {
        service.getBiometricsStatus = jest.fn().mockResolvedValue(status);
        vaultTimeoutSettingsService.isBiometricLockSet.mockResolvedValue(alreadyEnabled);
        const result = await service.canEnableBiometricUnlock();

        expect(result).toBe(expected);
      },
    );
  });
});
