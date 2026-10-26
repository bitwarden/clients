import { app } from "electron";
import { mock, MockProxy } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { UserId } from "@bitwarden/common/types/guid";
import { newGuid } from "@bitwarden/guid";
import {
  BiometricsService,
  BiometricsStatus,
  BiometricStateService,
} from "@bitwarden/key-management";
// eslint-disable-next-line no-restricted-imports
import { EncryptionType, SymmetricCryptoKey } from "@bitwarden/legacy-crypto";

import { WindowMain } from "../../main/window.main";
import { isDev } from "../../utils";

import { MainBiometricsService } from "./main-biometrics.service";
import { LinuxBiometricsSystem, WindowsBiometricsSystem } from "./native-v2";
import OsBiometricsServiceMac from "./os-biometrics-mac.service";
import { OsBiometricService } from "./os-biometrics.service";

jest.mock("electron", () => ({
  app: {
    getName: jest.fn().mockReturnValue("Bitwarden"),
    on: jest.fn(),
  },
  systemPreferences: {
    canPromptTouchID: jest.fn(),
    promptTouchID: jest.fn(),
  },
}));

jest.mock("@bitwarden/desktop-napi", () => {
  return {
    passwords: jest.fn(),
  };
});

jest.mock("../../utils", () => ({
  ...jest.requireActual("../../utils"),
  isDev: jest.fn().mockReturnValue(false),
}));

jest.mock("./automation-biometrics-ipc.listener", () => ({
  AutomationBiometricsIPCListener: jest.fn().mockImplementation(() => ({ init: jest.fn() })),
}));

jest.mock("./native-v2", () => ({
  LinuxBiometricsSystem: jest.fn(),
  WindowsBiometricsSystem: jest.fn(),
  biometrics: {
    initBiometricSystem: jest.fn(),
  },
}));

const unlockKey = new SymmetricCryptoKey(new Uint8Array(64));

describe("MainBiometricsService", function () {
  const i18nService = mock<I18nService>();
  const windowMain = mock<WindowMain>();
  const logService = mock<LogService>();
  const biometricStateService = mock<BiometricStateService>();

  describe("Should create a platform specific service", function () {
    it("Should create a biometrics service specific for Windows", () => {
      const sut = new MainBiometricsService(
        i18nService,
        windowMain,
        logService,
        "win32",
        biometricStateService,
      );

      const internalService = (sut as any).osBiometricsService;
      expect(internalService).not.toBeNull();
      expect(internalService).toBeInstanceOf(WindowsBiometricsSystem);
    });

    it("Should create a biometrics service specific for MacOs", () => {
      const sut = new MainBiometricsService(
        i18nService,
        windowMain,
        logService,
        "darwin",
        biometricStateService,
      );
      const internalService = (sut as any).osBiometricsService;
      expect(internalService).not.toBeNull();
      expect(internalService).toBeInstanceOf(OsBiometricsServiceMac);
    });

    it("Should create a biometrics service specific for Linux", () => {
      const sut = new MainBiometricsService(
        i18nService,
        windowMain,
        logService,
        "linux",
        biometricStateService,
      );

      const internalService = (sut as any).osBiometricsService;
      expect(internalService).not.toBeNull();
      expect(internalService).toBeInstanceOf(LinuxBiometricsSystem);
    });
  });

  describe("can auth biometric", () => {
    let sut: BiometricsService;
    let innerService: MockProxy<OsBiometricService>;

    beforeEach(() => {
      sut = new MainBiometricsService(
        i18nService,
        windowMain,
        logService,
        process.platform,
        biometricStateService,
      );

      innerService = mock();
      (sut as any).osBiometricsService = innerService;
    });

    it("should return the correct biometric status for system status", async () => {
      const testCases = [
        // happy path
        [true, false, false, BiometricsStatus.Available],
        [false, true, true, BiometricsStatus.HardwareUnavailable],
        [true, true, true, BiometricsStatus.AutoSetupNeeded],
        [true, true, false, BiometricsStatus.ManualSetupNeeded],

        // should not happen
        [false, false, true, BiometricsStatus.HardwareUnavailable],
        [true, false, true, BiometricsStatus.Available],
        [false, true, false, BiometricsStatus.HardwareUnavailable],
        [false, false, false, BiometricsStatus.HardwareUnavailable],
      ];

      for (const [supportsBiometric, needsSetup, canAutoSetup, expected] of testCases) {
        innerService.supportsBiometrics.mockResolvedValue(supportsBiometric as boolean);
        innerService.needsSetup.mockResolvedValue(needsSetup as boolean);
        innerService.canAutoSetup.mockResolvedValue(canAutoSetup as boolean);
        (sut as any).clearCachedBiometricsStatus();

        const actual = await sut.getBiometricsStatus();
        expect(actual).toBe(expected);
      }
    });

    it("should return the correct biometric status for user status", async () => {
      const testCases = [
        // system status, biometric unlock enabled, require password on start, has key half, result
        [BiometricsStatus.Available, false, false, false, BiometricsStatus.NotEnabledLocally],
        [BiometricsStatus.Available, false, true, false, BiometricsStatus.NotEnabledLocally],
        [BiometricsStatus.Available, false, false, true, BiometricsStatus.NotEnabledLocally],
        [BiometricsStatus.Available, false, true, true, BiometricsStatus.NotEnabledLocally],

        [
          BiometricsStatus.PlatformUnsupported,
          true,
          true,
          true,
          BiometricsStatus.PlatformUnsupported,
        ],
        [BiometricsStatus.ManualSetupNeeded, true, true, true, BiometricsStatus.ManualSetupNeeded],
        [BiometricsStatus.AutoSetupNeeded, true, true, true, BiometricsStatus.AutoSetupNeeded],

        [BiometricsStatus.Available, true, false, true, BiometricsStatus.Available],
        [BiometricsStatus.Available, true, true, false, BiometricsStatus.UnlockNeeded],
        [BiometricsStatus.Available, true, false, true, BiometricsStatus.Available],
      ];

      for (const [
        systemStatus,
        unlockEnabled,
        requirePasswordOnStart,
        hasKeyHalf,
        expected,
      ] of testCases) {
        sut.getBiometricsStatus = jest.fn().mockResolvedValue(systemStatus as BiometricsStatus);
        biometricStateService.getBiometricUnlockEnabled.mockResolvedValue(unlockEnabled as boolean);
        biometricStateService.getRequirePasswordOnStart.mockResolvedValue(
          requirePasswordOnStart as boolean,
        );
        if (!requirePasswordOnStart) {
          (sut as any).osBiometricsService.getBiometricsFirstUnlockStatusForUser = jest
            .fn()
            .mockResolvedValue(BiometricsStatus.Available);
        } else {
          if (hasKeyHalf) {
            (sut as any).osBiometricsService.getBiometricsFirstUnlockStatusForUser = jest
              .fn()
              .mockResolvedValue(BiometricsStatus.Available);
          } else {
            (sut as any).osBiometricsService.getBiometricsFirstUnlockStatusForUser = jest
              .fn()
              .mockResolvedValue(BiometricsStatus.UnlockNeeded);
          }
        }

        const userId = "test" as UserId;
        const actual = await sut.getBiometricsStatusForUser(userId);
        expect(actual).toBe(expected);
      }
    });
  });

  describe("platform biometrics status caching", () => {
    let sut: MainBiometricsService;
    let innerService: MockProxy<OsBiometricService>;
    let onWindowFocus: () => void;

    beforeEach(() => {
      jest.useFakeTimers();
      jest.mocked(app.on).mockClear();
      sut = new MainBiometricsService(
        i18nService,
        windowMain,
        logService,
        process.platform,
        biometricStateService,
      );
      onWindowFocus = jest
        .mocked(app.on)
        .mock.calls.find(([event]) => event === "browser-window-focus")![1] as () => void;

      innerService = mock<OsBiometricService>();
      innerService.supportsBiometrics.mockResolvedValue(true);
      innerService.needsSetup.mockResolvedValue(false);
      (sut as any).osBiometricsService = innerService;
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("reuses the platform status instead of asking the OS on every call", async () => {
      expect(await sut.getBiometricsStatus()).toBe(BiometricsStatus.Available);
      innerService.supportsBiometrics.mockResolvedValue(false);
      jest.advanceTimersByTime(29_000);

      expect(await sut.getBiometricsStatus()).toBe(BiometricsStatus.Available);
      expect(innerService.supportsBiometrics).toHaveBeenCalledTimes(1);
    });

    it("asks the OS again once the cached status expires", async () => {
      await sut.getBiometricsStatus();
      innerService.supportsBiometrics.mockResolvedValue(false);
      jest.advanceTimersByTime(30_000);

      expect(await sut.getBiometricsStatus()).toBe(BiometricsStatus.HardwareUnavailable);
      expect(innerService.supportsBiometrics).toHaveBeenCalledTimes(2);
    });

    it("asks the OS again after an app window gains focus", async () => {
      await sut.getBiometricsStatus();
      innerService.supportsBiometrics.mockResolvedValue(false);

      onWindowFocus();

      expect(await sut.getBiometricsStatus()).toBe(BiometricsStatus.HardwareUnavailable);
    });

    it("asks the OS again after running biometrics setup", async () => {
      innerService.needsSetup.mockResolvedValue(true);
      innerService.canAutoSetup.mockResolvedValue(true);
      expect(await sut.getBiometricsStatus()).toBe(BiometricsStatus.AutoSetupNeeded);
      innerService.needsSetup.mockResolvedValue(false);

      await sut.setupBiometrics();

      expect(await sut.getBiometricsStatus()).toBe(BiometricsStatus.Available);
    });

    it("asks the OS again after biometrics setup fails", async () => {
      await sut.getBiometricsStatus();
      innerService.runSetup.mockRejectedValue(new Error("Failed to set up polkit policy"));
      innerService.supportsBiometrics.mockResolvedValue(false);

      await expect(sut.setupBiometrics()).rejects.toThrow("Failed to set up polkit policy");

      expect(await sut.getBiometricsStatus()).toBe(BiometricsStatus.HardwareUnavailable);
    });

    it("shares one OS check between calls that arrive while it is still running", async () => {
      let finishCheck!: (supported: boolean) => void;
      innerService.supportsBiometrics.mockReturnValueOnce(
        new Promise((resolve) => (finishCheck = resolve)),
      );

      const first = sut.getBiometricsStatus();
      jest.advanceTimersByTime(1_000);
      const second = sut.getBiometricsStatus();
      finishCheck(true);

      expect(await Promise.all([first, second])).toEqual([
        BiometricsStatus.Available,
        BiometricsStatus.Available,
      ]);
      expect(innerService.supportsBiometrics).toHaveBeenCalledTimes(1);
    });

    it("does not keep a status that was still being checked when an app window gained focus", async () => {
      let finishStaleCheck!: (supported: boolean) => void;
      innerService.supportsBiometrics.mockReturnValueOnce(
        new Promise((resolve) => (finishStaleCheck = resolve)),
      );
      const staleCheck = sut.getBiometricsStatus();

      onWindowFocus();
      innerService.supportsBiometrics.mockResolvedValue(false);
      expect(await sut.getBiometricsStatus()).toBe(BiometricsStatus.HardwareUnavailable);
      finishStaleCheck(true);
      await staleCheck;

      expect(await sut.getBiometricsStatus()).toBe(BiometricsStatus.HardwareUnavailable);
      expect(innerService.supportsBiometrics).toHaveBeenCalledTimes(2);
    });

    it("asks the OS again after a status check fails", async () => {
      innerService.supportsBiometrics.mockRejectedValueOnce(
        new Error("Secret Service unavailable"),
      );

      await expect(sut.getBiometricsStatus()).rejects.toThrow("Secret Service unavailable");

      expect(await sut.getBiometricsStatus()).toBe(BiometricsStatus.Available);
      expect(innerService.supportsBiometrics).toHaveBeenCalledTimes(2);
    });

    it("does not cache the status reported by automation biometrics", async () => {
      const originalEnv = process.env;
      process.env = { ...originalEnv, USE_AUTOMATION_BIOMETRICS: "true" };
      jest.mocked(isDev).mockReturnValue(true);
      try {
        const automationSut = new MainBiometricsService(
          i18nService,
          windowMain,
          logService,
          process.platform,
          biometricStateService,
        );
        const automationService = (automationSut as any).osBiometricsService;
        automationService.setMockStatus(BiometricsStatus.Available);
        expect(await automationSut.getBiometricsStatus()).toBe(BiometricsStatus.Available);

        automationService.setMockStatus(BiometricsStatus.HardwareUnavailable);

        expect(await automationSut.getBiometricsStatus()).toBe(
          BiometricsStatus.HardwareUnavailable,
        );
      } finally {
        process.env = originalEnv;
        jest.mocked(isDev).mockReturnValue(false);
      }
    });

    it("uses the cached platform status when checking a user's status", async () => {
      const userId = newGuid() as UserId;
      biometricStateService.getBiometricUnlockEnabled.mockResolvedValue(true);
      innerService.getBiometricsFirstUnlockStatusForUser.mockResolvedValue(
        BiometricsStatus.Available,
      );

      await sut.getBiometricsStatusForUser(userId);
      await sut.getBiometricsStatusForUser(userId);

      expect(innerService.supportsBiometrics).toHaveBeenCalledTimes(1);
      expect(innerService.getBiometricsFirstUnlockStatusForUser).toHaveBeenCalledTimes(2);
    });
  });

  describe("unlockWithBiometricsForUser", () => {
    let sut: MainBiometricsService;
    let osBiometricsService: MockProxy<OsBiometricService>;

    beforeEach(() => {
      sut = new MainBiometricsService(
        i18nService,
        windowMain,
        logService,
        process.platform,
        biometricStateService,
      );
      osBiometricsService = mock<OsBiometricService>();
      (sut as any).osBiometricsService = osBiometricsService;
    });

    it("should return null if no biometric key is returned ", async () => {
      const userId = "test" as UserId;
      osBiometricsService.getBiometricKey.mockResolvedValue(null);
      const userKey = await sut.unlockWithBiometricsForUser(userId);

      expect(userKey).toBeNull();
      expect(osBiometricsService.getBiometricKey).toHaveBeenCalledWith(userId);
    });

    it("should return the biometric key if a valid key is returned", async () => {
      const userId = "test" as UserId;
      const biometricKey = new SymmetricCryptoKey(new Uint8Array(64));
      osBiometricsService.getBiometricKey.mockResolvedValue(biometricKey);

      const userKey = await sut.unlockWithBiometricsForUser(userId);

      expect(userKey).not.toBeNull();
      expect(userKey!.keyB64).toBe(biometricKey.toBase64());
      expect(userKey!.inner().type).toBe(EncryptionType.AesCbc256_HmacSha256_B64);
      expect(osBiometricsService.getBiometricKey).toHaveBeenCalledWith(userId);
    });
  });

  describe("setShouldAutopromptNow", () => {
    let sut: MainBiometricsService;

    beforeEach(() => {
      sut = new MainBiometricsService(
        i18nService,
        windowMain,
        logService,
        process.platform,
        biometricStateService,
      );
    });

    it("should set shouldAutopromptNow to false", async () => {
      await sut.setShouldAutopromptNow(false);

      const shouldAutoPrompt = await sut.getShouldAutopromptNow();

      expect(shouldAutoPrompt).toBe(false);
    });

    it("should set shouldAutopromptNow to true", async () => {
      await sut.setShouldAutopromptNow(true);

      const shouldAutoPrompt = await sut.getShouldAutopromptNow();

      expect(shouldAutoPrompt).toBe(true);
    });
  });

  describe("getShouldAutopromptNow", () => {
    it("defaults shouldAutoPrompt is true", async () => {
      const sut = new MainBiometricsService(
        i18nService,
        windowMain,
        logService,
        process.platform,
        biometricStateService,
      );

      const shouldAutoPrompt = await sut.getShouldAutopromptNow();

      expect(shouldAutoPrompt).toBe(true);
    });
  });

  describe("pass through methods that call platform specific osBiometricsService methods", () => {
    const userId = newGuid() as UserId;
    let sut: MainBiometricsService;
    let osBiometricsService: MockProxy<OsBiometricService>;

    beforeEach(() => {
      sut = new MainBiometricsService(
        i18nService,
        windowMain,
        logService,
        process.platform,
        biometricStateService,
      );
      osBiometricsService = mock<OsBiometricService>();
      (sut as any).osBiometricsService = osBiometricsService;
    });

    it("calls the platform specific setBiometricKey method", async () => {
      await sut.setBiometricProtectedUnlockKeyForUser(userId, unlockKey);

      expect(osBiometricsService.setBiometricKey).toHaveBeenCalledWith(userId, unlockKey);
    });

    it("calls the platform specific enrollPersistent method", async () => {
      await sut.enrollPersistent(userId, unlockKey);

      expect(osBiometricsService.enrollPersistent).toHaveBeenCalledWith(userId, unlockKey);
    });

    it("calls the platform specific hasPersistentKey method", async () => {
      await sut.hasPersistentKey(userId);

      expect(osBiometricsService.hasPersistentKey).toHaveBeenCalledWith(userId);
    });

    it("calls the platform specific deleteBiometricUnlockKeyForUser method", async () => {
      await sut.deleteBiometricUnlockKeyForUser(userId);

      expect(osBiometricsService.deleteBiometricKey).toHaveBeenCalledWith(userId);
    });

    it("calls the platform specific authenticateWithBiometrics method", async () => {
      await sut.authenticateWithBiometrics();

      expect(osBiometricsService.authenticateBiometric).toHaveBeenCalled();
    });

    it("calls the platform specific authenticateBiometric method", async () => {
      await sut.authenticateBiometric();

      expect(osBiometricsService.authenticateBiometric).toHaveBeenCalled();
    });

    it("calls the platform specific setupBiometrics method", async () => {
      await sut.setupBiometrics();

      expect(osBiometricsService.runSetup).toHaveBeenCalled();
    });
  });
});
