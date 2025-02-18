import { TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { firstValueFrom, of } from "rxjs";

import {
  PinServiceAbstraction,
  UserDecryptionOptionsServiceAbstraction,
} from "@bitwarden/auth/common";
import { VaultTimeoutSettingsService } from "@bitwarden/common/key-management/vault-timeout";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { UserId } from "@bitwarden/common/types/guid";
import {
  KeyService,
  BiometricsService,
  BiometricsStatus,
  BiometricStateService,
} from "@bitwarden/key-management";
import { UnlockOptions } from "@bitwarden/key-management-ui";

import { BrowserRouterService } from "../../../platform/popup/services/browser-router.service";

import { ExtensionLockComponentService } from "./extension-lock-component.service";

describe("ExtensionLockComponentService", () => {
  let service: ExtensionLockComponentService;

  let userDecryptionOptionsService: MockProxy<UserDecryptionOptionsServiceAbstraction>;
  let platformUtilsService: MockProxy<PlatformUtilsService>;
  let biometricsService: MockProxy<BiometricsService>;
  let pinService: MockProxy<PinServiceAbstraction>;
  let vaultTimeoutSettingsService: MockProxy<VaultTimeoutSettingsService>;
  let keyService: MockProxy<KeyService>;
  let routerService: MockProxy<BrowserRouterService>;
  let biometricStateService: MockProxy<BiometricStateService>;

  beforeEach(() => {
    userDecryptionOptionsService = mock<UserDecryptionOptionsServiceAbstraction>();
    platformUtilsService = mock<PlatformUtilsService>();
    biometricsService = mock<BiometricsService>();
    pinService = mock<PinServiceAbstraction>();
    vaultTimeoutSettingsService = mock<VaultTimeoutSettingsService>();
    keyService = mock<KeyService>();
    routerService = mock<BrowserRouterService>();
    biometricStateService = mock<BiometricStateService>();

    TestBed.configureTestingModule({
      providers: [
        ExtensionLockComponentService,
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
        {
          provide: BrowserRouterService,
          useValue: routerService,
        },
        {
          provide: BiometricStateService,
          useValue: biometricStateService,
        },
      ],
    });

    service = TestBed.inject(ExtensionLockComponentService);
  });

  it("instantiates", () => {
    expect(service).not.toBeFalsy();
  });

  describe("getPreviousUrl", () => {
    it("returns the previous URL", () => {
      routerService.getPreviousUrl.mockReturnValue("previousUrl");
      expect(service.getPreviousUrl()).toBe("previousUrl");
    });
  });

  describe("getBiometricsError", () => {
    it("returns a biometric error description when given a valid error type", () => {
      expect(
        service.getBiometricsError({
          message: "startDesktop",
        }),
      ).toBe("startDesktopDesc");
    });

    it("returns null when given an invalid error type", () => {
      expect(
        service.getBiometricsError({
          message: "invalidError",
        }),
      ).toBeNull();
    });

    it("returns null when given a null input", () => {
      expect(service.getBiometricsError(null)).toBeNull();
    });
  });

  describe("isWindowVisible", () => {
    it("throws an error", async () => {
      await expect(service.isWindowVisible()).rejects.toThrow("Method not implemented.");
    });
  });

  describe("getBiometricsUnlockBtnText", () => {
    it("returns the biometric unlock button text", () => {
      expect(service.getBiometricsUnlockBtnText()).toBe("unlockWithBiometrics");
    });
  });

  describe("getAvailableUnlockOptions$", () => {
    interface MockInputs {
      hasMasterPassword: boolean;
      biometricsStatusForUser: BiometricsStatus;
      hasBiometricEncryptedUserKeyStored: boolean;
      platformSupportsSecureStorage: boolean;
      pinDecryptionAvailable: boolean;
    }

    const table: [MockInputs, UnlockOptions][] = [
      [
        // MP + PIN + Biometrics available
        {
          hasMasterPassword: true,
          biometricsStatusForUser: BiometricsStatus.Available,
          hasBiometricEncryptedUserKeyStored: true,
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
            biometricsStatus: BiometricsStatus.Available,
          },
        },
      ],
      [
        // PIN + Biometrics available
        {
          hasMasterPassword: false,
          biometricsStatusForUser: BiometricsStatus.Available,
          hasBiometricEncryptedUserKeyStored: true,
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
            biometricsStatus: BiometricsStatus.Available,
          },
        },
      ],
      [
        // Biometrics available: user key stored with no secure storage
        {
          hasMasterPassword: false,
          biometricsStatusForUser: BiometricsStatus.Available,
          hasBiometricEncryptedUserKeyStored: true,
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
            biometricsStatus: BiometricsStatus.Available,
          },
        },
      ],
      [
        // Biometrics available: no user key stored with no secure storage
        {
          hasMasterPassword: false,
          biometricsStatusForUser: BiometricsStatus.Available,
          hasBiometricEncryptedUserKeyStored: false,
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
            biometricsStatus: BiometricsStatus.Available,
          },
        },
      ],
      [
        // Biometrics not available: biometric lock not set
        {
          hasMasterPassword: false,
          biometricsStatusForUser: BiometricsStatus.UnlockNeeded,
          hasBiometricEncryptedUserKeyStored: true,
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
            biometricsStatus: BiometricsStatus.UnlockNeeded,
          },
        },
      ],
      [
        // Biometrics not available: user key not stored
        {
          hasMasterPassword: false,
          biometricsStatusForUser: BiometricsStatus.NotEnabledInConnectedDesktopApp,
          hasBiometricEncryptedUserKeyStored: false,
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
            biometricsStatus: BiometricsStatus.NotEnabledInConnectedDesktopApp,
          },
        },
      ],
      [
        // Biometrics not available: OS doesn't support
        {
          hasMasterPassword: false,
          biometricsStatusForUser: BiometricsStatus.HardwareUnavailable,
          hasBiometricEncryptedUserKeyStored: true,
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
            biometricsStatus: BiometricsStatus.HardwareUnavailable,
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
      biometricsService.getBiometricsStatusForUser.mockResolvedValue(
        mockInputs.biometricsStatusForUser,
      );
      vaultTimeoutSettingsService.isBiometricLockSet.mockResolvedValue(
        mockInputs.hasBiometricEncryptedUserKeyStored,
      );
      keyService.hasUserKeyStored.mockResolvedValue(mockInputs.hasBiometricEncryptedUserKeyStored);
      platformUtilsService.supportsSecureStorage.mockReturnValue(
        mockInputs.platformSupportsSecureStorage,
      );
      biometricStateService.biometricUnlockEnabled$ = of(true);

      //  PIN
      pinService.isPinDecryptionAvailable.mockResolvedValue(mockInputs.pinDecryptionAvailable);

      const unlockOptions = await firstValueFrom(service.getAvailableUnlockOptions$(userId));

      expect(unlockOptions).toEqual(expectedOutput);
    });
  });
});
