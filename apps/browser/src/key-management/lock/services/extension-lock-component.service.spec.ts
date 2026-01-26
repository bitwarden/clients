// FIXME (PM-22628): angular imports are forbidden in background
// eslint-disable-next-line no-restricted-imports
import { TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { firstValueFrom, of } from "rxjs";

import { UserDecryptionOptionsServiceAbstraction } from "@bitwarden/auth/common";
import { PinServiceAbstraction } from "@bitwarden/common/key-management/pin/pin.service.abstraction";
import { VaultTimeoutSettingsService } from "@bitwarden/common/key-management/vault-timeout";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { UserId } from "@bitwarden/common/types/guid";
import {
  BiometricsService,
  BiometricsStatus,
  BiometricStateService,
} from "@bitwarden/key-management";
import { UnlockOptions, WebAuthnPrfUnlockService } from "@bitwarden/key-management-ui";

import { BrowserApi } from "../../../platform/browser/browser-api";
import BrowserPopupUtils from "../../../platform/browser/browser-popup-utils";
// FIXME (PM-22628): Popup imports are forbidden in background
// eslint-disable-next-line no-restricted-imports
import { BrowserRouterService } from "../../../platform/popup/services/browser-router.service";

import { ExtensionLockComponentService } from "./extension-lock-component.service";

describe("ExtensionLockComponentService", () => {
  let service: ExtensionLockComponentService;

  let userDecryptionOptionsService: MockProxy<UserDecryptionOptionsServiceAbstraction>;
  let platformUtilsService: MockProxy<PlatformUtilsService>;
  let biometricsService: MockProxy<BiometricsService>;
  let pinService: MockProxy<PinServiceAbstraction>;
  let vaultTimeoutSettingsService: MockProxy<VaultTimeoutSettingsService>;
  let routerService: MockProxy<BrowserRouterService>;
  let biometricStateService: MockProxy<BiometricStateService>;
  let webAuthnPrfUnlockService: MockProxy<WebAuthnPrfUnlockService>;

  beforeEach(() => {
    userDecryptionOptionsService = mock<UserDecryptionOptionsServiceAbstraction>();
    platformUtilsService = mock<PlatformUtilsService>();
    biometricsService = mock<BiometricsService>();
    pinService = mock<PinServiceAbstraction>();
    vaultTimeoutSettingsService = mock<VaultTimeoutSettingsService>();
    routerService = mock<BrowserRouterService>();
    biometricStateService = mock<BiometricStateService>();
    webAuthnPrfUnlockService = mock<WebAuthnPrfUnlockService>();

    TestBed.configureTestingModule({
      providers: [
        {
          provide: ExtensionLockComponentService,
          useFactory: () =>
            new ExtensionLockComponentService(
              userDecryptionOptionsService,
              biometricsService,
              pinService,
              biometricStateService,
              routerService,
              webAuthnPrfUnlockService,
            ),
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

  describe("popOutBrowserExtension", () => {
    let openPopoutSpy: jest.SpyInstance;
    beforeEach(() => {
      jest.resetAllMocks();
      openPopoutSpy = jest
        .spyOn(BrowserPopupUtils, "openCurrentPagePopout")
        .mockResolvedValue(undefined);
    });

    it("opens pop-out when the current window is neither a pop-out nor a sidebar", async () => {
      jest.spyOn(BrowserPopupUtils, "inPopout").mockReturnValue(false);
      jest.spyOn(BrowserPopupUtils, "inSidebar").mockReturnValue(false);

      await service.popOutBrowserExtension();

      expect(openPopoutSpy).toHaveBeenCalledWith(global.window);
    });

    test.each([
      [true, false],
      [false, true],
      [true, true],
    ])("should not open pop-out under other conditions.", async (inPopout, inSidebar) => {
      jest.spyOn(BrowserPopupUtils, "inPopout").mockReturnValue(inPopout);
      jest.spyOn(BrowserPopupUtils, "inSidebar").mockReturnValue(inSidebar);

      await service.popOutBrowserExtension();

      expect(openPopoutSpy).not.toHaveBeenCalled();
    });
  });

  describe("closeBrowserExtensionPopout", () => {
    let closePopupSpy: jest.SpyInstance;
    beforeEach(() => {
      jest.resetAllMocks();
      closePopupSpy = jest.spyOn(BrowserApi, "closePopup").mockReturnValue();
    });

    it("closes pop-out when in pop-out", () => {
      jest.spyOn(BrowserPopupUtils, "inPopout").mockReturnValue(true);

      service.closeBrowserExtensionPopout();

      expect(closePopupSpy).toHaveBeenCalledWith(global.window);
    });

    it("doesn't close pop-out when not in pop-out", () => {
      jest.spyOn(BrowserPopupUtils, "inPopout").mockReturnValue(false);

      service.closeBrowserExtensionPopout();

      expect(closePopupSpy).not.toHaveBeenCalled();
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
          prf: {
            enabled: false,
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
          prf: {
            enabled: false,
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
          prf: {
            enabled: false,
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
          prf: {
            enabled: false,
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
          prf: {
            enabled: false,
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
          prf: {
            enabled: false,
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
          prf: {
            enabled: false,
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
      platformUtilsService.supportsSecureStorage.mockReturnValue(
        mockInputs.platformSupportsSecureStorage,
      );
      biometricStateService.biometricUnlockEnabled$ = of(true);

      //  PIN
      pinService.isPinDecryptionAvailable.mockResolvedValue(mockInputs.pinDecryptionAvailable);

      // PRF
      webAuthnPrfUnlockService.isPrfUnlockAvailable.mockResolvedValue(false);

      const unlockOptions = await firstValueFrom(service.getAvailableUnlockOptions$(userId));

      expect(unlockOptions).toEqual(expectedOutput);
    });
  });
});
