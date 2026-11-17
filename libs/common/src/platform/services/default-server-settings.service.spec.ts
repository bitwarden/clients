import { of } from "rxjs";

import { ConfigService } from "../abstractions/config/config.service";
import { ServerSettings } from "../models/domain/server-settings";

import { DefaultServerSettingsService } from "./default-server-settings.service";

describe("DefaultServerSettingsService", () => {
  let service: DefaultServerSettingsService;
  let configServiceMock: { serverSettings$: any };

  beforeEach(() => {
    configServiceMock = { serverSettings$: of() };
    service = new DefaultServerSettingsService(configServiceMock as ConfigService);
  });

  describe("getSettings$", () => {
    it("returns server settings", () => {
      const mockSettings = new ServerSettings({ disableUserRegistration: true });
      configServiceMock.serverSettings$ = of(mockSettings);

      service.getSettings$().subscribe((settings) => {
        expect(settings).toEqual(mockSettings);
      });
    });
  });

  describe("isUserRegistrationDisabled$", () => {
    it("returns true when user registration is disabled", () => {
      const mockSettings = new ServerSettings({ disableUserRegistration: true });
      configServiceMock.serverSettings$ = of(mockSettings);

      service.isUserRegistrationDisabled$.subscribe((isDisabled: boolean) => {
        expect(isDisabled).toBe(true);
      });
    });

    it("returns false when user registration is enabled", () => {
      const mockSettings = new ServerSettings({ disableUserRegistration: false });
      configServiceMock.serverSettings$ = of(mockSettings);

      service.isUserRegistrationDisabled$.subscribe((isDisabled: boolean) => {
        expect(isDisabled).toBe(false);
      });
    });
  });

  describe("isOpenInviteLinkEmailVerificationDisabled$", () => {
    it("returns true when open invite link email verification is disabled", () => {
      const mockSettings = new ServerSettings({ disableOpenInviteLinkEmailVerification: true });
      configServiceMock.serverSettings$ = of(mockSettings);

      service.isOpenInviteLinkEmailVerificationDisabled$.subscribe((isDisabled: boolean) => {
        expect(isDisabled).toBe(true);
      });
    });

    it("returns false when open invite link email verification is enabled", () => {
      const mockSettings = new ServerSettings({ disableOpenInviteLinkEmailVerification: false });
      configServiceMock.serverSettings$ = of(mockSettings);

      service.isOpenInviteLinkEmailVerificationDisabled$.subscribe((isDisabled: boolean) => {
        expect(isDisabled).toBe(false);
      });
    });
  });
});
