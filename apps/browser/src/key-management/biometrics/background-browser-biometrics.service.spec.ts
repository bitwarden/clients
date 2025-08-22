import { mock } from "jest-mock-extended";

import { VaultTimeoutSettingsService } from "@bitwarden/common/key-management/vault-timeout";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { KeyService, BiometricStateService, BiometricsStatus } from "@bitwarden/key-management";

import { NativeMessagingBackground } from "../../background/nativeMessaging.background";

import { BackgroundBrowserBiometricsService } from "./background-browser-biometrics.service";

describe("background browser biometrics service tests", function () {
  let service: BackgroundBrowserBiometricsService;

  const nativeMessagingBackground = mock<NativeMessagingBackground>();
  const logService = mock<LogService>();
  const keyService = mock<KeyService>();
  const biometricStateService = mock<BiometricStateService>();
  const messagingService = mock<MessagingService>();
  const vaultTimeoutSettingsService = mock<VaultTimeoutSettingsService>();

  beforeEach(() => {
    jest.resetAllMocks();
    service = new BackgroundBrowserBiometricsService(
      () => nativeMessagingBackground,
      logService,
      keyService,
      biometricStateService,
      messagingService,
      vaultTimeoutSettingsService,
    );
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
