import { TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { WINDOW } from "@bitwarden/angular/services/injection-tokens";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { ClientType } from "@bitwarden/common/enums";
import {
  EnvironmentService,
  Environment,
} from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";

import { BrowserApi } from "../../../platform/browser/browser-api";

import { ExtensionSsoComponentService } from "./extension-sso-component.service";

describe("ExtensionSsoComponentService", () => {
  let service: ExtensionSsoComponentService;
  const baseUrl = "https://vault.bitwarden.com";

  let syncService: MockProxy<SyncService>;
  let authService: MockProxy<AuthService>;
  let environmentService: MockProxy<EnvironmentService>;
  let i18nService: MockProxy<I18nService>;
  let windowMock: MockProxy<Window>;
  let logService: MockProxy<LogService>;
  beforeEach(() => {
    syncService = mock<SyncService>();
    authService = mock<AuthService>();
    environmentService = mock<EnvironmentService>();
    i18nService = mock<I18nService>();
    windowMock = mock<Window>();
    logService = mock<LogService>();
    environmentService.environment$ = new BehaviorSubject<Environment>({
      getWebVaultUrl: () => baseUrl,
    } as Environment);

    TestBed.configureTestingModule({
      providers: [
        { provide: SyncService, useValue: syncService },
        { provide: AuthService, useValue: authService },
        { provide: EnvironmentService, useValue: environmentService },
        { provide: WINDOW, useValue: windowMock },
        { provide: I18nService, useValue: i18nService },
        { provide: LogService, useValue: logService },
        ExtensionSsoComponentService,
      ],
    });

    service = TestBed.inject(ExtensionSsoComponentService);

    jest.spyOn(BrowserApi, "reloadOpenWindows").mockImplementation();
  });

  it("sets clientId to browser", () => {
    expect(service.clientId).toBe(ClientType.Browser);
  });

  describe("closeWindow", () => {
    it("closes window", async () => {
      await service.closeWindow();

      expect(windowMock.close).toHaveBeenCalled();
    });
  });
});
