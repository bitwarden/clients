import { mock, MockProxy } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { EncryptionType } from "@bitwarden/common/platform/enums";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { UserId } from "@bitwarden/common/types/guid";
import {
  BiometricsService,
  BiometricsStatus,
  BiometricStateService,
} from "@bitwarden/key-management";

import { WindowMain } from "../../main/window.main";

import { MainBiometricsService } from "./main-biometrics.service";
import OsBiometricsServiceLinux from "./os-biometrics-linux.service";
import OsBiometricsServiceMac from "./os-biometrics-mac.service";
import OsBiometricsServiceWindows from "./os-biometrics-windows.service";
import { OsBiometricService } from "./os-biometrics.service";

jest.mock("@bitwarden/desktop-napi", () => {
  return {
    biometrics: jest.fn(),
    passwords: jest.fn(),
  };
});

describe("MainBiometricsService", function () {
  const i18nService = mock<I18nService>();
  const windowMain = mock<WindowMain>();
  const logService = mock<LogService>();
  const messagingService = mock<MessagingService>();
  const biometricStateService = mock<BiometricStateService>();

  it("Should call the platformspecific methods", async () => {
    const sut = new MainBiometricsService(
      i18nService,
      windowMain,
      logService,
      messagingService,
      process.platform,
      biometricStateService,
    );

    const mockService = mock<OsBiometricService>();
    (sut as any).osBiometricsService = mockService;

    await sut.authenticateBiometric();
    expect(mockService.authenticateBiometric).toBeCalled();
  });

  describe("Should create a platform specific service", function () {
    it("Should create a biometrics service specific for Windows", () => {
      const sut = new MainBiometricsService(
        i18nService,
        windowMain,
        logService,
        messagingService,
        "win32",
        biometricStateService,
      );

      const internalService = (sut as any).osBiometricsService;
      expect(internalService).not.toBeNull();
      expect(internalService).toBeInstanceOf(OsBiometricsServiceWindows);
    });

    it("Should create a biometrics service specific for MacOs", () => {
      const sut = new MainBiometricsService(
        i18nService,
        windowMain,
        logService,
        messagingService,
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
        messagingService,
        "linux",
        biometricStateService,
      );

      const internalService = (sut as any).osBiometricsService;
      expect(internalService).not.toBeNull();
      expect(internalService).toBeInstanceOf(OsBiometricsServiceLinux);
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
        messagingService,
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
        innerService.osSupportsBiometric.mockResolvedValue(supportsBiometric as boolean);
        innerService.osBiometricsNeedsSetup.mockResolvedValue(needsSetup as boolean);
        innerService.osBiometricsCanAutoSetup.mockResolvedValue(canAutoSetup as boolean);

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
        (sut as any).clientKeyHalves = new Map();
        const userId = "test" as UserId;
        if (hasKeyHalf) {
          (sut as any).clientKeyHalves.set(userId, "test");
        }

        const actual = await sut.getBiometricsStatusForUser(userId);
        expect(actual).toBe(expected);
      }
    });
  });

  describe("setupBiometrics", () => {
    it("should call the platform specific setup method", async () => {
      const sut = new MainBiometricsService(
        i18nService,
        windowMain,
        logService,
        messagingService,
        process.platform,
        biometricStateService,
      );
      const osBiometricsService = mock<OsBiometricService>();
      (sut as any).osBiometricsService = osBiometricsService;

      await sut.setupBiometrics();

      expect(osBiometricsService.osBiometricsSetup).toHaveBeenCalled();
    });
  });

  describe("setClientKeyHalfForUser", () => {
    let sut: MainBiometricsService;

    beforeEach(() => {
      sut = new MainBiometricsService(
        i18nService,
        windowMain,
        logService,
        messagingService,
        process.platform,
        biometricStateService,
      );
    });

    it("should set the client key half for the user", async () => {
      const userId = "test" as UserId;
      const keyHalf = "testKeyHalf";

      await sut.setClientKeyHalfForUser(userId, keyHalf);

      expect((sut as any).clientKeyHalves.has(userId)).toBe(true);
      expect((sut as any).clientKeyHalves.get(userId)).toBe(keyHalf);
    });

    it("should reset the client key half for the user", async () => {
      const userId = "test" as UserId;

      await sut.setClientKeyHalfForUser(userId, null);

      expect((sut as any).clientKeyHalves.has(userId)).toBe(true);
      expect((sut as any).clientKeyHalves.get(userId)).toBe(null);
    });
  });

  describe("authenticateWithBiometrics", () => {
    it("should call the platform specific authenticate method", async () => {
      const sut = new MainBiometricsService(
        i18nService,
        windowMain,
        logService,
        messagingService,
        process.platform,
        biometricStateService,
      );
      const osBiometricsService = mock<OsBiometricService>();
      (sut as any).osBiometricsService = osBiometricsService;

      await sut.authenticateWithBiometrics();

      expect(osBiometricsService.authenticateBiometric).toHaveBeenCalled();
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
        messagingService,
        process.platform,
        biometricStateService,
      );
      osBiometricsService = mock<OsBiometricService>();
      (sut as any).osBiometricsService = osBiometricsService;
    });

    it("should return null if no biometric key is returned ", async () => {
      const userId = "test" as UserId;
      (sut as any).clientKeyHalves.set(userId, "testKeyHalf");

      const userKey = await sut.unlockWithBiometricsForUser(userId);

      expect(userKey).toBeNull();
      expect(osBiometricsService.getBiometricKey).toHaveBeenCalledWith(
        "Bitwarden_biometric",
        `${userId}_user_biometric`,
        "testKeyHalf",
      );
    });

    it("should return the biometric key if a valid key is returned", async () => {
      const userId = "test" as UserId;
      (sut as any).clientKeyHalves.set(userId, "testKeyHalf");
      const biometricKey = Utils.fromBufferToB64(new Uint8Array(64));
      osBiometricsService.getBiometricKey.mockResolvedValue(biometricKey);

      const userKey = await sut.unlockWithBiometricsForUser(userId);

      expect(userKey).not.toBeNull();
      expect(userKey!.keyB64).toBe(biometricKey);
      expect(userKey!.encType).toBe(EncryptionType.AesCbc256_HmacSha256_B64);
      expect(osBiometricsService.getBiometricKey).toHaveBeenCalledWith(
        "Bitwarden_biometric",
        `${userId}_user_biometric`,
        "testKeyHalf",
      );
    });
  });

  describe("setBiometricProtectedUnlockKeyForUser", () => {
    let sut: MainBiometricsService;
    let osBiometricsService: MockProxy<OsBiometricService>;

    beforeEach(() => {
      sut = new MainBiometricsService(
        i18nService,
        windowMain,
        logService,
        messagingService,
        process.platform,
        biometricStateService,
      );
      osBiometricsService = mock<OsBiometricService>();
      (sut as any).osBiometricsService = osBiometricsService;
    });

    it("should throw an error if no client key half is provided", async () => {
      const userId = "test" as UserId;
      const unlockKey = "testUnlockKey";

      await expect(sut.setBiometricProtectedUnlockKeyForUser(userId, unlockKey)).rejects.toThrow(
        "No client key half provided for user",
      );
    });

    it("should call the platform specific setBiometricKey method", async () => {
      const userId = "test" as UserId;
      const unlockKey = "testUnlockKey";

      (sut as any).clientKeyHalves.set(userId, "testKeyHalf");

      await sut.setBiometricProtectedUnlockKeyForUser(userId, unlockKey);

      expect(osBiometricsService.setBiometricKey).toHaveBeenCalledWith(
        "Bitwarden_biometric",
        `${userId}_user_biometric`,
        unlockKey,
        "testKeyHalf",
      );
    });
  });

  describe("deleteBiometricUnlockKeyForUser", () => {
    it("should call the platform specific deleteBiometricKey method", async () => {
      const sut = new MainBiometricsService(
        i18nService,
        windowMain,
        logService,
        messagingService,
        process.platform,
        biometricStateService,
      );
      const osBiometricsService = mock<OsBiometricService>();
      (sut as any).osBiometricsService = osBiometricsService;

      const userId = "test" as UserId;

      await sut.deleteBiometricUnlockKeyForUser(userId);

      expect(osBiometricsService.deleteBiometricKey).toHaveBeenCalledWith(
        "Bitwarden_biometric",
        `${userId}_user_biometric`,
      );
    });
  });

  describe("setShouldAutopromptNow", () => {
    let sut: MainBiometricsService;

    beforeEach(() => {
      sut = new MainBiometricsService(
        i18nService,
        windowMain,
        logService,
        messagingService,
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
        messagingService,
        process.platform,
        biometricStateService,
      );

      const shouldAutoPrompt = await sut.getShouldAutopromptNow();

      expect(shouldAutoPrompt).toBe(true);
    });
  });
});
