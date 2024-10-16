import { TestBed } from "@angular/core/testing";
import { MockProxy, mock } from "jest-mock-extended";

import { DefaultLoginComponentService } from "@bitwarden/auth/angular";
import { SsoLoginServiceAbstraction } from "@bitwarden/common/auth/abstractions/sso-login.service.abstraction";
import { CryptoFunctionService } from "@bitwarden/common/platform/abstractions/crypto-function.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ToastService } from "@bitwarden/components";
import { PasswordGenerationServiceAbstraction } from "@bitwarden/generator-legacy";

import { ElectronPlatformUtilsService } from "../../platform/services/electron-platform-utils.service";

import { DesktopLoginComponentService } from "./desktop-login-component.service";

(global as any).ipc = {
  platform: {
    isAppImage: jest.fn(),
    isSnapStore: jest.fn(),
    isDev: jest.fn(),
    localhostCallbackService: {
      openSsoPrompt: jest.fn(),
    },
  },
};

describe("DesktopLoginComponentService", () => {
  let service: DesktopLoginComponentService;
  let cryptoFunctionService: MockProxy<CryptoFunctionService>;
  let environmentService: MockProxy<EnvironmentService>;
  let passwordGenerationService: MockProxy<PasswordGenerationServiceAbstraction>;
  let platformUtilsService: MockProxy<ElectronPlatformUtilsService>;
  let ssoLoginService: MockProxy<SsoLoginServiceAbstraction>;
  let i18nService: MockProxy<I18nService>;
  let toastService: MockProxy<ToastService>;

  beforeEach(() => {
    cryptoFunctionService = mock<CryptoFunctionService>();
    environmentService = mock<EnvironmentService>();
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

    jest.spyOn(service, "launchSsoBrowserWindow").mockImplementation(async () => {});
  });

  it("creates the service", () => {
    expect(service).toBeTruthy();
  });

  it("calls launchSsoBrowserWindow if isAppImage, isSnapStore, and isDev are false", async () => {
    (global as any).ipc.platform.isAppImage.mockReturnValue(false);
    (global as any).ipc.platform.isSnapStore.mockReturnValue(false);
    (global as any).ipc.platform.isDev.mockReturnValue(false);

    await service.launchSsoBrowserWindow("user@example.com", "desktop");

    expect(service.launchSsoBrowserWindow).toHaveBeenCalledWith("user@example.com", "desktop");
  });
});
