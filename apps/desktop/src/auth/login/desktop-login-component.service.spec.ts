import { TestBed } from "@angular/core/testing";
import { MockProxy } from "jest-mock-extended";

import { DefaultLoginComponentService } from "@bitwarden/auth/angular";
import { SsoLoginServiceAbstraction } from "@bitwarden/common/auth/abstractions/sso-login.service.abstraction";
import { CryptoFunctionService } from "@bitwarden/common/platform/abstractions/crypto-function.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ToastService } from "@bitwarden/components";
import { PasswordGenerationServiceAbstraction } from "@bitwarden/generator-legacy";

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
  let i18nService: MockProxy<I18nService>;
  let toastService: MockProxy<ToastService>;
  let ssoLoginService: MockProxy<SsoLoginServiceAbstraction>;
  let passwordGenerationService: MockProxy<PasswordGenerationServiceAbstraction>;
  let cryptoFunctionService: MockProxy<CryptoFunctionService>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        DesktopLoginComponentService,
        { provide: DefaultLoginComponentService, useClass: DesktopLoginComponentService },
        { provide: I18nService, useValue: i18nService },
        { provide: ToastService, useValue: toastService },
        { provide: SsoLoginServiceAbstraction, useValue: ssoLoginService },
        { provide: PasswordGenerationServiceAbstraction, useValue: passwordGenerationService },
        { provide: CryptoFunctionService, useValue: cryptoFunctionService },
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
