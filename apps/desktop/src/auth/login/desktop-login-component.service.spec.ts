import { TestBed } from "@angular/core/testing";
import { MockProxy, mock } from "jest-mock-extended";
import { of } from "rxjs";

import { DefaultLoginComponentService } from "@bitwarden/auth/angular";
import { SsoLoginServiceAbstraction } from "@bitwarden/common/auth/abstractions/sso-login.service.abstraction";
import { CryptoFunctionService } from "@bitwarden/common/platform/abstractions/crypto-function.service";
import {
  Environment,
  EnvironmentService,
} from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { ToastService } from "@bitwarden/components";
import { PasswordGenerationServiceAbstraction } from "@bitwarden/generator-legacy";

import { ElectronPlatformUtilsService } from "../../platform/services/electron-platform-utils.service";

import { DesktopLoginComponentService } from "./desktop-login-component.service";

const defaultIpc = {
  platform: {
    isAppImage: false,
    isSnapStore: false,
    isDev: false,
    localhostCallbackService: {
      openSsoPrompt: jest.fn(),
    },
  },
};

(global as any).ipc = defaultIpc;

describe("DesktopLoginComponentService", () => {
  let service: DesktopLoginComponentService;
  let cryptoFunctionService: MockProxy<CryptoFunctionService>;
  let environmentService: MockProxy<EnvironmentService>;
  let passwordGenerationService: MockProxy<PasswordGenerationServiceAbstraction>;
  let platformUtilsService: MockProxy<ElectronPlatformUtilsService>;
  let ssoLoginService: MockProxy<SsoLoginServiceAbstraction>;
  let i18nService: MockProxy<I18nService>;
  let toastService: MockProxy<ToastService>;

  let superLaunchSsoBrowserWindowSpy: jest.SpyInstance;

  beforeEach(() => {
    cryptoFunctionService = mock<CryptoFunctionService>();
    environmentService = mock<EnvironmentService>();
    environmentService.environment$ = of({
      getWebVaultUrl: () => "https://webvault.bitwarden.com",
      getRegion: () => "US",
      getUrls: () => ({}),
      isCloud: () => true,
      getApiUrl: () => "https://api.bitwarden.com",
    } as Environment);

    passwordGenerationService = mock<PasswordGenerationServiceAbstraction>();
    platformUtilsService = mock<ElectronPlatformUtilsService>();
    ssoLoginService = mock<SsoLoginServiceAbstraction>();
    i18nService = mock<I18nService>();
    toastService = mock<ToastService>();

    TestBed.configureTestingModule({
      providers: [
        {
          provide: DesktopLoginComponentService,
          useFactory: () =>
            new DesktopLoginComponentService(
              cryptoFunctionService,
              environmentService,
              passwordGenerationService,
              platformUtilsService,
              ssoLoginService,
              i18nService,
              toastService,
            ),
        },
        { provide: DefaultLoginComponentService, useExisting: DesktopLoginComponentService },
        { provide: CryptoFunctionService, useValue: cryptoFunctionService },
        { provide: EnvironmentService, useValue: environmentService },
        { provide: PasswordGenerationServiceAbstraction, useValue: passwordGenerationService },
        { provide: PlatformUtilsService, useValue: platformUtilsService },
        { provide: SsoLoginServiceAbstraction, useValue: ssoLoginService },
        { provide: I18nService, useValue: i18nService },
        { provide: ToastService, useValue: toastService },
      ],
    });

    service = TestBed.inject(DesktopLoginComponentService);

    superLaunchSsoBrowserWindowSpy = jest.spyOn(
      DefaultLoginComponentService.prototype,
      "launchSsoBrowserWindow",
    );
  });

  afterEach(() => {
    // Restore the original ipc object after each test
    (global as any).ipc = { ...defaultIpc };

    jest.clearAllMocks();
  });

  it("creates the service", () => {
    expect(service).toBeTruthy();
  });

  describe("launchSsoBrowserWindow", () => {
    // Array of all permutations of isAppImage, isSnapStore, and isDev
    const permutations = [
      [true, false, false], // Case 1: isAppImage true
      [false, true, false], // Case 2: isSnapStore true
      [false, false, true], // Case 3: isDev true
      [true, true, false], // Case 4: isAppImage and isSnapStore true
      [true, false, true], // Case 5: isAppImage and isDev true
      [false, true, true], // Case 6: isSnapStore and isDev true
      [true, true, true], // Case 7: all true
      [false, false, false], // Case 8: all false
    ];

    permutations.forEach(([isAppImage, isSnapStore, isDev]) => {
      it(`executes correct logic for isAppImage=${isAppImage}, isSnapStore=${isSnapStore}, isDev=${isDev}`, async () => {
        (global as any).ipc.platform.isAppImage = isAppImage;
        (global as any).ipc.platform.isSnapStore = isSnapStore;
        (global as any).ipc.platform.isDev = isDev;

        const email = "user@example.com";
        const clientId = "desktop";
        const codeChallenge = "testCodeChallenge";
        const codeVerifier = "testCodeVerifier";
        const state = "testState";
        const codeVerifierHash = new Uint8Array(64);

        passwordGenerationService.generatePassword.mockResolvedValueOnce(state);
        passwordGenerationService.generatePassword.mockResolvedValueOnce(codeVerifier);
        cryptoFunctionService.hash.mockResolvedValueOnce(codeVerifierHash);
        jest.spyOn(Utils, "fromBufferToUrlB64").mockReturnValue(codeChallenge);

        await service.launchSsoBrowserWindow(email, clientId);

        if (isAppImage || isSnapStore || isDev) {
          expect(superLaunchSsoBrowserWindowSpy).not.toHaveBeenCalled();

          // Assert that the standard logic is executed
          expect(ssoLoginService.setSsoEmail).toHaveBeenCalledWith(email);
          expect(passwordGenerationService.generatePassword).toHaveBeenCalledTimes(2);
          expect(cryptoFunctionService.hash).toHaveBeenCalledWith(codeVerifier, "sha256");
          expect(ssoLoginService.setSsoState).toHaveBeenCalledWith(state);
          expect(ssoLoginService.setCodeVerifier).toHaveBeenCalledWith(codeVerifier);
          expect(ipc.platform.localhostCallbackService.openSsoPrompt).toHaveBeenCalledWith(
            codeChallenge,
            state,
          );
        } else {
          // If all values are false, expect the super method to be called
          expect(superLaunchSsoBrowserWindowSpy).toHaveBeenCalledWith(email, clientId);
        }
      });
    });
  });
});
