import { TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { firstValueFrom, of } from "rxjs";

import { UserDecryptionOptionsServiceAbstraction } from "@bitwarden/auth/common";
import { UserId } from "@bitwarden/common/types/guid";
import { BiometricsStatus, WebAuthnPrfUnlockServiceAbstraction } from "@bitwarden/key-management";

import { WebLockComponentService } from "./web-lock-component.service";

describe("WebLockComponentService", () => {
  let service: WebLockComponentService;

  let userDecryptionOptionsService: MockProxy<UserDecryptionOptionsServiceAbstraction>;
  let webAuthnPrfUnlockService: MockProxy<WebAuthnPrfUnlockServiceAbstraction>;

  beforeEach(() => {
    userDecryptionOptionsService = mock<UserDecryptionOptionsServiceAbstraction>();
    webAuthnPrfUnlockService = mock<WebAuthnPrfUnlockServiceAbstraction>();

    TestBed.configureTestingModule({
      providers: [
        WebLockComponentService,
        {
          provide: UserDecryptionOptionsServiceAbstraction,
          useValue: userDecryptionOptionsService,
        },
        {
          provide: WebAuthnPrfUnlockServiceAbstraction,
          useValue: webAuthnPrfUnlockService,
        },
      ],
    });

    service = TestBed.inject(WebLockComponentService);
  });

  it("instantiates", () => {
    expect(service).not.toBeFalsy();
  });

  describe("getBiometricsError", () => {
    it("throws an error when given a null input", () => {
      expect(() => service.getBiometricsError(null)).toThrow(
        "Biometric unlock is not supported in the web app. See getAvailableUnlockOptions$",
      );
    });
    it("throws an error when given a non-null input", () => {
      expect(() => service.getBiometricsError("error")).toThrow(
        "Biometric unlock is not supported in the web app. See getAvailableUnlockOptions$",
      );
    });
  });

  describe("getPreviousUrl", () => {
    it("returns null", () => {
      expect(service.getPreviousUrl()).toBeNull();
    });
  });

  describe("popOutBrowserExtension", () => {
    it("throws platform not supported error", () => {
      expect(() => service.popOutBrowserExtension()).toThrow(
        "Method not supported on this platform.",
      );
    });
  });

  describe("closeBrowserExtensionPopout", () => {
    it("throws platform not supported error", () => {
      expect(() => service.closeBrowserExtensionPopout()).toThrow(
        "Method not supported on this platform.",
      );
    });
  });

  describe("isWindowVisible", () => {
    it("throws an error", async () => {
      await expect(service.isWindowVisible()).rejects.toThrow("Method not implemented.");
    });
  });

  describe("getBiometricsUnlockBtnText", () => {
    it("throws an error", () => {
      expect(() => service.getBiometricsUnlockBtnText()).toThrow(
        "Biometric unlock is not supported in the web app. See getAvailableUnlockOptions$",
      );
    });
  });

  describe("getAvailableUnlockOptions$", () => {
    it("returns an observable of unlock options", async () => {
      const userId = "user-id" as UserId;
      const userDecryptionOptions = {
        hasMasterPassword: true,
      };
      userDecryptionOptionsService.userDecryptionOptionsById$.mockReturnValueOnce(
        of(userDecryptionOptions),
      );
      webAuthnPrfUnlockService.isPrfUnlockAvailable.mockResolvedValue(false);

      const unlockOptions = await firstValueFrom(service.getAvailableUnlockOptions$(userId));

      expect(unlockOptions).toEqual({
        masterPassword: {
          enabled: true,
        },
        pin: {
          enabled: false,
        },
        biometrics: {
          enabled: false,
          biometricsStatus: BiometricsStatus.PlatformUnsupported,
        },
        prf: {
          enabled: false,
        },
      });
    });
  });
});
