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
});
