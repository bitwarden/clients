import { mock } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { VaultTimeoutSettingsService } from "@bitwarden/common/key-management/vault-timeout";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { UserId } from "@bitwarden/common/types/guid";
import { KeyService, BiometricStateService, BiometricsStatus } from "@bitwarden/key-management";

import { NativeMessagingBackground } from "../../background/nativeMessaging.background";

import { BackgroundBrowserBiometricsService } from "./background-browser-biometrics.service";

describe("background browser biometrics service tests", function () {
  let service: BackgroundBrowserBiometricsService;

  const userId = "userId" as UserId;
  const nativeMessagingBackground = mock<NativeMessagingBackground>();
  const logService = mock<LogService>();
  const keyService = mock<KeyService>();
  const biometricStateService = mock<BiometricStateService>();
  const messagingService = mock<MessagingService>();
  const vaultTimeoutSettingsService = mock<VaultTimeoutSettingsService>();
  const mockConfigService = mock<ConfigService>();
  mockConfigService.getFeatureFlag.mockResolvedValue(false);

  beforeEach(() => {
    jest.resetAllMocks();
    jest.useFakeTimers();
    service = new BackgroundBrowserBiometricsService(
      () => nativeMessagingBackground,
      () => mockConfigService,
      logService,
      keyService,
      biometricStateService,
      messagingService,
      vaultTimeoutSettingsService,
      () => null as any,
    );
  });

  afterEach(() => {
    service.stopPolling();
    jest.useRealTimers();
  });

  describe("startPolling", () => {
    it("connects to native messaging when biometrics are enabled", () => {
      const biometricEnabled$ = new BehaviorSubject<boolean>(true);
      biometricStateService.biometricUnlockEnabled$.mockReturnValue(biometricEnabled$);
      nativeMessagingBackground.connected = false;
      nativeMessagingBackground.connect.mockResolvedValue();

      service.startPolling(userId);
      jest.advanceTimersByTime(0);

      expect(biometricStateService.biometricUnlockEnabled$).toHaveBeenCalledWith(userId);
      expect(nativeMessagingBackground.connect).toHaveBeenCalled();
    });

    it("does not connect when biometrics are disabled", () => {
      const biometricEnabled$ = new BehaviorSubject<boolean>(false);
      biometricStateService.biometricUnlockEnabled$.mockReturnValue(biometricEnabled$);
      nativeMessagingBackground.connected = false;

      service.startPolling(userId);
      jest.advanceTimersByTime(0);

      expect(nativeMessagingBackground.connect).not.toHaveBeenCalled();
    });

    it("does not connect when already connected", () => {
      const biometricEnabled$ = new BehaviorSubject<boolean>(true);
      biometricStateService.biometricUnlockEnabled$.mockReturnValue(biometricEnabled$);
      nativeMessagingBackground.connected = true;

      service.startPolling(userId);
      jest.advanceTimersByTime(0);

      expect(nativeMessagingBackground.connect).not.toHaveBeenCalled();
    });
  });

  describe("stopPolling", () => {
    it("stops connecting after stopPolling is called", () => {
      const biometricEnabled$ = new BehaviorSubject<boolean>(true);
      biometricStateService.biometricUnlockEnabled$.mockReturnValue(biometricEnabled$);
      nativeMessagingBackground.connected = false;
      nativeMessagingBackground.connect.mockResolvedValue();

      service.startPolling(userId);
      jest.advanceTimersByTime(0);
      expect(nativeMessagingBackground.connect).toHaveBeenCalledTimes(1);

      nativeMessagingBackground.connect.mockClear();
      service.stopPolling();
      jest.advanceTimersByTime(service.BACKGROUND_POLLING_INTERVAL);

      expect(nativeMessagingBackground.connect).not.toHaveBeenCalled();
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
