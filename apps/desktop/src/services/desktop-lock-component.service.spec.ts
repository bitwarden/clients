import { TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { firstValueFrom, of } from "rxjs";

import { BiometricsDisableReason, UnlockOptions } from "@bitwarden/auth/angular";
import {
  PinServiceAbstraction,
  UserDecryptionOptionsServiceAbstraction,
} from "@bitwarden/auth/common";
import { VaultTimeoutSettingsService } from "@bitwarden/common/abstractions/vault-timeout/vault-timeout-settings.service";
import { DeviceType } from "@bitwarden/common/enums";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { UserId } from "@bitwarden/common/types/guid";
import { KeyService, BiometricsService } from "@bitwarden/key-management";

import { DesktopLockComponentService } from "./desktop-lock-component.service";

// ipc mock global
const isWindowVisibleMock = jest.fn();
const biometricEnabledMock = jest.fn();
(global as any).ipc = {
  keyManagement: {
    biometric: {
      enabled: biometricEnabledMock,
    },
  },
  platform: {
    isWindowVisible: isWindowVisibleMock,
  },
};

describe("DesktopLockComponentService", () => {
  let service: DesktopLockComponentService;

  let userDecryptionOptionsService: MockProxy<UserDecryptionOptionsServiceAbstraction>;
  let platformUtilsService: MockProxy<PlatformUtilsService>;
  let biometricsService: MockProxy<BiometricsService>;
  let pinService: MockProxy<PinServiceAbstraction>;
  let vaultTimeoutSettingsService: MockProxy<VaultTimeoutSettingsService>;
  let keyService: MockProxy<KeyService>;

  beforeEach(() => {
    userDecryptionOptionsService = mock<UserDecryptionOptionsServiceAbstraction>();
    platformUtilsService = mock<PlatformUtilsService>();
    biometricsService = mock<BiometricsService>();
    pinService = mock<PinServiceAbstraction>();
    vaultTimeoutSettingsService = mock<VaultTimeoutSettingsService>();
    keyService = mock<KeyService>();

    TestBed.configureTestingModule({
      providers: [
        DesktopLockComponentService,
        {
          provide: UserDecryptionOptionsServiceAbstraction,
          useValue: userDecryptionOptionsService,
        },
        {
          provide: PlatformUtilsService,
          useValue: platformUtilsService,
        },
        {
          provide: BiometricsService,
          useValue: biometricsService,
        },
        {
          provide: PinServiceAbstraction,
          useValue: pinService,
        },
        {
          provide: VaultTimeoutSettingsService,
          useValue: vaultTimeoutSettingsService,
        },
        {
          provide: KeyService,
          useValue: keyService,
        },
      ],
    });

    service = TestBed.inject(DesktopLockComponentService);
  });

  it("instantiates", () => {
    expect(service).not.toBeFalsy();
  });

  // getBiometricsError
  describe("getBiometricsError", () => {
    it("returns null when given null", () => {
      const result = service.getBiometricsError(null);
      expect(result).toBeNull();
    });

    it("returns null when given an unknown error", () => {
      const result = service.getBiometricsError({ message: "unknown" });
      expect(result).toBeNull();
    });
  });

  describe("getPreviousUrl", () => {
    it("returns null", () => {
      const result = service.getPreviousUrl();
      expect(result).toBeNull();
    });
  });

  describe("isWindowVisible", () => {
    it("returns the window visibility", async () => {
      isWindowVisibleMock.mockReturnValue(true);
      const result = await service.isWindowVisible();
      expect(result).toBe(true);
    });
  });

  describe("getBiometricsUnlockBtnText", () => {
    it("returns the correct text for Mac OS", () => {
      platformUtilsService.getDevice.mockReturnValue(DeviceType.MacOsDesktop);
      const result = service.getBiometricsUnlockBtnText();
      expect(result).toBe("unlockWithTouchId");
    });

    it("returns the correct text for Windows", () => {
      platformUtilsService.getDevice.mockReturnValue(DeviceType.WindowsDesktop);
      const result = service.getBiometricsUnlockBtnText();
      expect(result).toBe("unlockWithWindowsHello");
    });

    it("returns the correct text for Linux", () => {
      platformUtilsService.getDevice.mockReturnValue(DeviceType.LinuxDesktop);
      const result = service.getBiometricsUnlockBtnText();
      expect(result).toBe("unlockWithPolkit");
    });

    it("throws an error for an unsupported platform", () => {
      platformUtilsService.getDevice.mockReturnValue("unsupported" as any);
      expect(() => service.getBiometricsUnlockBtnText()).toThrowError("Unsupported platform");
    });
  });

  describe("getAvailableUnlockOptions$", () => {
    interface MockInputs {
      hasMasterPassword: boolean;
      osSupportsBiometric: boolean;
      biometricLockSet: boolean;
      biometricReady: boolean;
      hasBiometricEncryptedUserKeyStored: boolean;
      platformSupportsSecureStorage: boolean;
      pinDecryptionAvailable: boolean;
    }

    const table: [MockInputs, UnlockOptions][] = [
      [
        // MP + PIN + Biometrics available
        {
          hasMasterPassword: true,
          osSupportsBiometric: true,
          biometricLockSet: true,
          hasBiometricEncryptedUserKeyStored: true,
          biometricReady: true,
          platformSupportsSecureStorage: true,
          pinDecryptionAvailable: true,
        },
        {
          masterPassword: {
            enabled: true,
          },
          pin: {
            enabled: true,
          },
          biometrics: {
            enabled: true,
            disableReason: null,
          },
        },
      ],
      [
        // PIN + Biometrics available
        {
          hasMasterPassword: false,
          osSupportsBiometric: true,
          biometricLockSet: true,
          hasBiometricEncryptedUserKeyStored: true,
          biometricReady: true,
          platformSupportsSecureStorage: true,
          pinDecryptionAvailable: true,
        },
        {
          masterPassword: {
            enabled: false,
          },
          pin: {
            enabled: true,
          },
          biometrics: {
            enabled: true,
            disableReason: null,
          },
        },
      ],
      [
        // Biometrics available: user key stored with no secure storage
        {
          hasMasterPassword: false,
          osSupportsBiometric: true,
          biometricLockSet: true,
          hasBiometricEncryptedUserKeyStored: true,
          biometricReady: true,
          platformSupportsSecureStorage: false,
          pinDecryptionAvailable: false,
        },
        {
          masterPassword: {
            enabled: false,
          },
          pin: {
            enabled: false,
          },
          biometrics: {
            enabled: true,
            disableReason: null,
          },
        },
      ],
      [
        // Biometrics available: no user key stored with no secure storage
        {
          hasMasterPassword: false,
          osSupportsBiometric: true,
          biometricLockSet: true,
          hasBiometricEncryptedUserKeyStored: false,
          biometricReady: true,
          platformSupportsSecureStorage: false,
          pinDecryptionAvailable: false,
        },
        {
          masterPassword: {
            enabled: false,
          },
          pin: {
            enabled: false,
          },
          biometrics: {
            enabled: true,
            disableReason: null,
          },
        },
      ],
      [
        // Biometrics not available: biometric not ready
        {
          hasMasterPassword: false,
          osSupportsBiometric: true,
          biometricLockSet: true,
          hasBiometricEncryptedUserKeyStored: true,
          biometricReady: false,
          platformSupportsSecureStorage: true,
          pinDecryptionAvailable: false,
        },
        {
          masterPassword: {
            enabled: false,
          },
          pin: {
            enabled: false,
          },
          biometrics: {
            enabled: false,
            disableReason: BiometricsDisableReason.SystemBiometricsUnavailable,
          },
        },
      ],
      [
        // Biometrics not available: biometric lock not set
        {
          hasMasterPassword: false,
          osSupportsBiometric: true,
          biometricLockSet: false,
          hasBiometricEncryptedUserKeyStored: true,
          biometricReady: true,
          platformSupportsSecureStorage: true,
          pinDecryptionAvailable: false,
        },
        {
          masterPassword: {
            enabled: false,
          },
          pin: {
            enabled: false,
          },
          biometrics: {
            enabled: false,
            disableReason: BiometricsDisableReason.EncryptedKeysUnavailable,
          },
        },
      ],
      [
        // Biometrics not available: user key not stored
        {
          hasMasterPassword: false,
          osSupportsBiometric: true,
          biometricLockSet: true,
          hasBiometricEncryptedUserKeyStored: false,
          biometricReady: true,
          platformSupportsSecureStorage: true,
          pinDecryptionAvailable: false,
        },
        {
          masterPassword: {
            enabled: false,
          },
          pin: {
            enabled: false,
          },
          biometrics: {
            enabled: false,
            disableReason: BiometricsDisableReason.EncryptedKeysUnavailable,
          },
        },
      ],
      [
        // Biometrics not available: OS doesn't support
        {
          hasMasterPassword: false,
          osSupportsBiometric: false,
          biometricLockSet: true,
          hasBiometricEncryptedUserKeyStored: true,
          biometricReady: true,
          platformSupportsSecureStorage: true,
          pinDecryptionAvailable: false,
        },
        {
          masterPassword: {
            enabled: false,
          },
          pin: {
            enabled: false,
          },
          biometrics: {
            enabled: false,
            disableReason: BiometricsDisableReason.NotSupportedOnOperatingSystem,
          },
        },
      ],
    ];

    test.each(table)("returns unlock options", async (mockInputs, expectedOutput) => {
      const userId = "userId" as UserId;
      const userDecryptionOptions = {
        hasMasterPassword: mockInputs.hasMasterPassword,
      };

      // MP
      userDecryptionOptionsService.userDecryptionOptionsById$.mockReturnValue(
        of(userDecryptionOptions),
      );

      // Biometrics
      biometricsService.supportsBiometric.mockResolvedValue(mockInputs.osSupportsBiometric);
      vaultTimeoutSettingsService.isBiometricLockSet.mockResolvedValue(mockInputs.biometricLockSet);
      keyService.hasUserKeyStored.mockResolvedValue(mockInputs.hasBiometricEncryptedUserKeyStored);
      platformUtilsService.supportsSecureStorage.mockReturnValue(
        mockInputs.platformSupportsSecureStorage,
      );
      biometricEnabledMock.mockResolvedValue(mockInputs.biometricReady);

      //  PIN
      pinService.isPinDecryptionAvailable.mockResolvedValue(mockInputs.pinDecryptionAvailable);

      const unlockOptions = await firstValueFrom(service.getAvailableUnlockOptions$(userId));

      expect(unlockOptions).toEqual(expectedOutput);
    });
  });
});
