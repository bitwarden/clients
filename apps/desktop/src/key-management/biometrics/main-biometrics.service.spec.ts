import { mock, MockProxy } from "jest-mock-extended";

import { CryptoFunctionService } from "@bitwarden/common/key-management/crypto/abstractions/crypto-function.service";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { EncryptionType } from "@bitwarden/common/platform/enums";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { UserId } from "@bitwarden/common/types/guid";
import { newGuid } from "@bitwarden/guid";
import {
  BiometricsService,
  BiometricsStatus,
  BiometricStateService,
} from "@bitwarden/key-management";

import { WindowMain } from "../../main/window.main";

import { MainBiometricsService } from "./main-biometrics.service";
import { WindowsBiometricsSystem } from "./native-v2";
import OsBiometricsServiceLinux from "./os-biometrics-linux.service";
import OsBiometricsServiceMac from "./os-biometrics-mac.service";
import { OsBiometricService } from "./os-biometrics.service";

jest.mock("@bitwarden/desktop-napi", () => {
  return {
    biometrics: jest.fn(),
    passwords: jest.fn(),
  };
});

jest.mock("./native-v2", () => ({
  WindowsBiometricsSystem: jest.fn(),
  biometrics_v2: {
    initBiometricSystem: jest.fn(),
  },
}));

const unlockKey = new SymmetricCryptoKey(new Uint8Array(64));

describe("MainBiometricsService", function () {
  const i18nService = mock<I18nService>();
  const windowMain = mock<WindowMain>();
  const logService = mock<LogService>();
  const biometricStateService = mock<BiometricStateService>();
  const cryptoFunctionService = mock<CryptoFunctionService>();
  const encryptService = mock<EncryptService>();

  describe("Should create a platform specific service", function () {
    it("Should create a biometrics service specific for Windows", () => {
      const sut = new MainBiometricsService(
        i18nService,
        windowMain,
        logService,
        "win32",
        biometricStateService,
        encryptService,
        cryptoFunctionService,
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
        encryptService,
        cryptoFunctionService,
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
        encryptService,
        cryptoFunctionService,
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
        process.platform,
        biometricStateService,
        encryptService,
        cryptoFunctionService,
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
        encryptService,
        cryptoFunctionService,
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
        encryptService,
        cryptoFunctionService,
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
        encryptService,
        cryptoFunctionService,
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
        encryptService,
        cryptoFunctionService,
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
