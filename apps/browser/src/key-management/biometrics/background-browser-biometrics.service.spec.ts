import { mock } from "jest-mock-extended";

import { VaultTimeoutSettingsService } from "@bitwarden/common/key-management/vault-timeout";
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

import { SafariApp } from "../../browser/safariApp";
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

  const logService = mock<LogService>();
  const keyService = mock<KeyService>();
  const biometricStateService = mock<BiometricStateService>();
  const messagingService = mock<MessagingService>();
  const vaultTimeoutSettingsService = mock<VaultTimeoutSettingsService>();
  const ipcService = mock<IpcService>();
  const platformUtilsService = mock<PlatformUtilsService>();
  const unlockService = mock<UnlockService>();
  let safariCommand: jest.SpyInstance;

  beforeEach(async () => {
    jest.resetAllMocks();
    jest.useFakeTimers();
    // jsdom has no `AbortSignal.timeout`, which the SDK IPC path uses.
    AbortSignal.timeout = jest.fn(() => new AbortController().signal);
    safariCommand = jest.spyOn(SafariApp, "sendBiometricsCommand");
    service = new BackgroundBrowserBiometricsService(
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
    it("asks the Safari app extension on Safari", async () => {
      platformUtilsService.isSafari.mockReturnValue(true);
      safariCommand.mockResolvedValue({ command: "", response: true });

      const result = await service.authenticateWithBiometrics();

      expect(result).toBe(true);
      expect(safariCommand).toHaveBeenCalledWith(BiometricsCommands.AuthenticateWithBiometrics);
      expect(ipcRequestAuthenticateBiometrics).not.toHaveBeenCalled();
    });

    it("asks the desktop app over SDK IPC on other browsers", async () => {
      platformUtilsService.isSafari.mockReturnValue(false);
      jest.mocked(ipcRequestAuthenticateBiometrics).mockResolvedValue(true);

      const result = await service.authenticateWithBiometrics();

      expect(result).toBe(true);
      expect(ipcRequestAuthenticateBiometrics).toHaveBeenCalled();
      expect(safariCommand).not.toHaveBeenCalled();
    });

    it("returns false when SDK IPC fails", async () => {
      platformUtilsService.isSafari.mockReturnValue(false);
      jest.mocked(ipcRequestAuthenticateBiometrics).mockRejectedValue(new Error("timeout"));

      expect(await service.authenticateWithBiometrics()).toBe(false);
    });
  });

  describe("getBiometricsStatus", () => {
    beforeEach(() => {
      jest.spyOn(BrowserApi, "permissionsGranted").mockResolvedValue(true);
    });

    it("returns the Safari app extension's status on Safari", async () => {
      platformUtilsService.isSafari.mockReturnValue(true);
      safariCommand.mockResolvedValue({
        command: "",
        response: BiometricsStatus.HardwareUnavailable,
      });

      const result = await service.getBiometricsStatus();

      expect(result).toBe(BiometricsStatus.HardwareUnavailable);
      expect(safariCommand).toHaveBeenCalledWith(BiometricsCommands.GetBiometricsStatus);
    });

    it("returns DesktopDisconnected when the Safari app extension does not answer", async () => {
      platformUtilsService.isSafari.mockReturnValue(true);
      safariCommand.mockResolvedValue(null);

      expect(await service.getBiometricsStatus()).toBe(BiometricsStatus.DesktopDisconnected);
    });

    it("returns Available on other browsers", async () => {
      platformUtilsService.isSafari.mockReturnValue(false);

      const result = await service.getBiometricsStatus();

      expect(result).toBe(BiometricsStatus.Available);
      expect(safariCommand).not.toHaveBeenCalled();
    });
  });

  describe("unlockWithBiometricsForUser", () => {
    it("unlocks with the Safari app extension's user key on Safari", async () => {
      platformUtilsService.isSafari.mockReturnValue(true);
      safariCommand.mockResolvedValue({
        command: "",
        response: true,
        userKeyB64: userKey.keyB64,
      });

      const result = await service.unlockWithBiometricsForUser(userId);

      expect(result).toEqual(userKey);
      expect(safariCommand).toHaveBeenCalledWith(
        BiometricsCommands.UnlockWithBiometricsForUser,
        userId,
      );
      expect(unlockService.unlockWithDecryptedUserKey).toHaveBeenCalledWith(
        userId,
        userKey,
        UnlockMethod.Biometrics,
      );
      expect(biometricStateService.setBiometricUnlockEnabled).toHaveBeenCalledWith(true, userId);
      expect(ipcRequestUnlockBiometrics).not.toHaveBeenCalled();
    });

    it("returns null when the Safari app extension refuses", async () => {
      platformUtilsService.isSafari.mockReturnValue(true);
      safariCommand.mockResolvedValue({ command: "", response: false });

      expect(await service.unlockWithBiometricsForUser(userId)).toBeNull();
      expect(unlockService.unlockWithDecryptedUserKey).not.toHaveBeenCalled();
    });

    it("unlocks with the SDK IPC user key on other browsers", async () => {
      platformUtilsService.isSafari.mockReturnValue(false);
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
      expect(safariCommand).not.toHaveBeenCalled();
    });

    it("rejects an SDK IPC user key that is not this user's", async () => {
      platformUtilsService.isSafari.mockReturnValue(false);
      jest.mocked(ipcRequestUnlockBiometrics).mockResolvedValue({ user_key: userKey.toSdk() });
      keyService.validateUserKey.mockResolvedValue(false);

      expect(await service.unlockWithBiometricsForUser(userId)).toBeNull();
      expect(unlockService.unlockWithDecryptedUserKey).not.toHaveBeenCalled();
    });
  });

  describe("getBiometricsStatusForUser", () => {
    it("returns the Safari app extension's status on Safari", async () => {
      platformUtilsService.isSafari.mockReturnValue(true);
      safariCommand.mockResolvedValue({
        command: "",
        response: BiometricsStatus.NotEnabledInConnectedDesktopApp,
      });

      const result = await service.getBiometricsStatusForUser(userId);

      expect(result).toBe(BiometricsStatus.NotEnabledInConnectedDesktopApp);
      expect(safariCommand).toHaveBeenCalledWith(
        BiometricsCommands.GetBiometricsStatusForUser,
        userId,
      );
      expect(ipcRequestGetBiometricsStatus).not.toHaveBeenCalled();
    });

    it("returns the SDK IPC status on other browsers", async () => {
      platformUtilsService.isSafari.mockReturnValue(false);
      jest
        .mocked(ipcRequestGetBiometricsStatus)
        .mockResolvedValue(SdkBiometricsStatus.UnlockNeeded);

      const result = await service.getBiometricsStatusForUser(userId);

      expect(result).toBe(BiometricsStatus.UnlockNeeded);
      expect(safariCommand).not.toHaveBeenCalled();
    });

    it("returns NotEnabledInConnectedDesktopApp when the desktop app reports NotEnabled over SDK IPC", async () => {
      platformUtilsService.isSafari.mockReturnValue(false);
      jest.mocked(ipcRequestGetBiometricsStatus).mockResolvedValue(SdkBiometricsStatus.NotEnabled);

      const result = await service.getBiometricsStatusForUser(userId);

      expect(result).toBe(BiometricsStatus.NotEnabledInConnectedDesktopApp);
    });

    it("returns DesktopDisconnected when SDK IPC fails", async () => {
      platformUtilsService.isSafari.mockReturnValue(false);
      jest.mocked(ipcRequestGetBiometricsStatus).mockRejectedValue(new Error("timeout"));

      expect(await service.getBiometricsStatusForUser(userId)).toBe(
        BiometricsStatus.DesktopDisconnected,
      );
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
