import { TestBed } from "@angular/core/testing";
import { MockProxy, mock } from "jest-mock-extended";
import { of } from "rxjs";

import { DefaultLoginComponentService } from "@bitwarden/auth/angular";
import { SsoUrlService } from "@bitwarden/auth/common";
import { SsoLoginServiceAbstraction } from "@bitwarden/common/auth/abstractions/sso-login.service.abstraction";
import { ClientType } from "@bitwarden/common/enums";
import { CryptoFunctionService } from "@bitwarden/common/key-management/crypto/abstractions/crypto-function.service";
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
import { ServerCommunicationConfigService } from "../../platform/services/server-communication-config/server-communication-config.service";

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
  let ssoUrlService: MockProxy<SsoUrlService>;
  let serverCommunicationConfigService: MockProxy<ServerCommunicationConfigService>;

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
    platformUtilsService.getClientType.mockReturnValue(ClientType.Desktop);
    ssoUrlService = mock<SsoUrlService>();
    serverCommunicationConfigService = mock<ServerCommunicationConfigService>();
    // Default to a non-proxied server so SSO uses the direct fragment URL.
    serverCommunicationConfigService.needsBootstrap$.mockReturnValue(of(false));

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
              ssoUrlService,
              serverCommunicationConfigService,
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
        { provide: SsoUrlService, useValue: ssoUrlService },
        {
          provide: ServerCommunicationConfigService,
          useValue: serverCommunicationConfigService,
        },
      ],
    });

    service = TestBed.inject(DesktopLoginComponentService);
  });

  afterEach(() => {
    // Restore the original ipc object after each test
    (global as any).ipc = { ...defaultIpc };

    jest.clearAllMocks();
  });

  it("creates the service", () => {
    expect(service).toBeTruthy();
  });

  describe("redirectToSso", () => {
    // Array of all permutations of isAppImage and isDev
    const permutations = [
      [true, false], // Case 1: isAppImage true
      [false, true], // Case 2: isDev true
      [true, true], // Case 3: all true
      [false, false], // Case 4: all false
    ];

    permutations.forEach(([isAppImage, isDev]) => {
      it(`executes correct logic for isAppImage=${isAppImage}, isDev=${isDev}`, async () => {
        (global as any).ipc.platform.isAppImage = isAppImage;
        (global as any).ipc.platform.isDev = isDev;

        const email = "test@bitwarden.com";
        const state = "testState";
        const codeVerifier = "testCodeVerifier";
        const codeChallenge = "testCodeChallenge";

        passwordGenerationService.generatePassword.mockResolvedValueOnce(state);
        passwordGenerationService.generatePassword.mockResolvedValueOnce(codeVerifier);
        jest.spyOn(Utils, "fromArrayToUrlB64").mockReturnValue(codeChallenge);

        await service.redirectToSsoLogin(email);

        if (isAppImage || isDev) {
          expect(ipc.platform.localhostCallbackService.openSsoPrompt).toHaveBeenCalledWith(
            codeChallenge,
            state,
            email,
            false,
            undefined,
          );
        } else {
          expect(ssoLoginService.setSsoState).toHaveBeenCalledWith(state);
          expect(ssoLoginService.setCodeVerifier).toHaveBeenCalledWith(codeVerifier);
          expect(platformUtilsService.launchUri).toHaveBeenCalled();
        }
      });
    });

    describe("pre-auth proxy launch URL selection (packaged app)", () => {
      beforeEach(() => {
        (global as any).ipc.platform.isAppImage = false;
        (global as any).ipc.platform.isDev = false;

        passwordGenerationService.generatePassword.mockResolvedValueOnce("testState");
        passwordGenerationService.generatePassword.mockResolvedValueOnce("testCodeVerifier");
        jest.spyOn(Utils, "fromArrayToUrlB64").mockReturnValue("testCodeChallenge");
      });

      it("uses the direct SSO URL when the server is not behind a pre-auth proxy", async () => {
        serverCommunicationConfigService.needsBootstrap$.mockReturnValue(of(false));

        await service.redirectToSsoLogin("test@bitwarden.com");

        expect(ssoUrlService.buildSsoUrl).toHaveBeenCalled();
        expect(ssoUrlService.buildSsoLaunchConnectorUrl).not.toHaveBeenCalled();
        expect(platformUtilsService.launchUri).toHaveBeenCalled();
      });

      it("uses the launch connector URL when the server needs bootstrap (pre-auth proxy)", async () => {
        serverCommunicationConfigService.needsBootstrap$.mockReturnValue(of(true));

        await service.redirectToSsoLogin("test@bitwarden.com");

        expect(serverCommunicationConfigService.needsBootstrap$).toHaveBeenCalledWith(
          "webvault.bitwarden.com",
        );
        expect(ssoUrlService.buildSsoLaunchConnectorUrl).toHaveBeenCalled();
        expect(ssoUrlService.buildSsoUrl).not.toHaveBeenCalled();
        expect(platformUtilsService.launchUri).toHaveBeenCalled();
      });

      it("forwards useSsoLaunchConnector to the localhost callback for AppImage/dev builds", async () => {
        (global as any).ipc.platform.isAppImage = true;
        serverCommunicationConfigService.needsBootstrap$.mockReturnValue(of(true));

        await service.redirectToSsoLogin("test@bitwarden.com");

        expect(ipc.platform.localhostCallbackService.openSsoPrompt).toHaveBeenCalledWith(
          "testCodeChallenge",
          "testState",
          "test@bitwarden.com",
          true,
          undefined,
        );
        expect(platformUtilsService.launchUri).not.toHaveBeenCalled();
      });
    });
  });

  describe("redirectToSsoLoginWithOrganizationSsoIdentifier", () => {
    // Array of all permutations of isAppImage and isDev
    const permutations = [
      [true, false], // Case 1: isAppImage true
      [false, true], // Case 2: isDev true
      [true, true], // Case 3: all true
      [false, false], // Case 4: all false
    ];

    permutations.forEach(([isAppImage, isDev]) => {
      it("calls redirectToSso with orgSsoIdentifier", async () => {
        (global as any).ipc.platform.isAppImage = isAppImage;
        (global as any).ipc.platform.isDev = isDev;

        const email = "test@bitwarden.com";
        const state = "testState";
        const codeVerifier = "testCodeVerifier";
        const codeChallenge = "testCodeChallenge";
        const orgSsoIdentifier = "orgSsoId";

        passwordGenerationService.generatePassword.mockResolvedValueOnce(state);
        passwordGenerationService.generatePassword.mockResolvedValueOnce(codeVerifier);
        jest.spyOn(Utils, "fromBufferToUrlB64").mockReturnValue(codeChallenge);

        await service.redirectToSsoLoginWithOrganizationSsoIdentifier(email, orgSsoIdentifier);

        if (isAppImage || isDev) {
          expect(ipc.platform.localhostCallbackService.openSsoPrompt).toHaveBeenCalledWith(
            codeChallenge,
            state,
            email,
            false,
            orgSsoIdentifier,
          );
        } else {
          expect(ssoUrlService.buildSsoUrl).toHaveBeenCalledWith(
            expect.any(String),
            expect.any(String),
            expect.any(String),
            expect.any(String),
            expect.any(String),
            email,
            orgSsoIdentifier,
          );
          expect(ssoLoginService.setSsoState).toHaveBeenCalledWith(state);
          expect(ssoLoginService.setCodeVerifier).toHaveBeenCalledWith(codeVerifier);
          expect(platformUtilsService.launchUri).toHaveBeenCalled();
        }
      });
    });
  });
});
