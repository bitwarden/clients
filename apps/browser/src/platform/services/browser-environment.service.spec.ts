import { mock, MockProxy } from "jest-mock-extended";
import { firstValueFrom } from "rxjs";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import {
  FakeAccountService,
  FakeStateProvider,
  mockAccountServiceWith,
} from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { ManagedSettingsService } from "@bitwarden/managed-settings";

import { devFlagEnabled, devFlagValue } from "../flags";

import { BrowserEnvironmentService } from "./browser-environment.service";

jest.mock("../flags", () => ({
  ...jest.requireActual("../flags"),
  devFlagEnabled: jest.fn(),
  devFlagValue: jest.fn(),
}));

const devFlagEnabledMock = devFlagEnabled as jest.Mock;
const devFlagValueMock = devFlagValue as jest.Mock;

describe("BrowserEnvironmentService", () => {
  let managedSettingsService: MockProxy<ManagedSettingsService>;
  let accountService: FakeAccountService;
  let stateProvider: FakeStateProvider;
  let service: BrowserEnvironmentService;

  /** Makes `get` answer from `settings`, keyed by dotted key, as the real profile would. */
  function managed(settings: Record<string, string>) {
    managedSettingsService.get.mockImplementation((key) => settings[key]);
  }

  beforeEach(() => {
    devFlagEnabledMock.mockReturnValue(false);
    managedSettingsService = mock<ManagedSettingsService>();
    managedSettingsService.get.mockReturnValue(undefined);
    accountService = mockAccountServiceWith(Utils.newGuid() as UserId);
    stateProvider = new FakeStateProvider(accountService);

    service = new BrowserEnvironmentService(
      mock<LogService>(),
      stateProvider,
      accountService,
      managedSettingsService,
    );
  });

  describe("getManagedEnvironment", () => {
    it("decodes every managed environment leaf into the matching field", async () => {
      managed({
        "environment.base": '"https://vault.example.com"',
        "environment.webVault": '"https://web.example.com"',
        "environment.api": '"https://api.example.com"',
        "environment.identity": '"https://identity.example.com"',
        "environment.icons": '"https://icons.example.com"',
        "environment.notifications": '"https://notifications.example.com"',
        "environment.events": '"https://events.example.com"',
      });

      await expect(service.getManagedEnvironment()).resolves.toEqual({
        base: "https://vault.example.com",
        webVault: "https://web.example.com",
        api: "https://api.example.com",
        identity: "https://identity.example.com",
        icons: "https://icons.example.com",
        notifications: "https://notifications.example.com",
        events: "https://events.example.com",
      });
    });

    it("returns only the fields the profile carries", async () => {
      managed({ "environment.base": '"https://vault.example.com"' });

      await expect(service.getManagedEnvironment()).resolves.toEqual({
        base: "https://vault.example.com",
      });
    });

    it("keeps an empty string, because presence in the profile means the value is forced", async () => {
      managed({ "environment.base": '""' });

      await expect(service.getManagedEnvironment()).resolves.toEqual({ base: "" });
    });

    it("ignores a managed key outside the environment namespace", async () => {
      managed({ "generator.password.length": "20" });

      await expect(service.getManagedEnvironment()).resolves.toBeNull();
    });

    it("resolves null when no environment key is managed", async () => {
      await expect(service.getManagedEnvironment()).resolves.toBeNull();
    });

    it("returns the dev flag value unchanged when managedEnvironment is enabled", async () => {
      const devEnvironment = { base: "https://localhost:8080" };
      devFlagEnabledMock.mockReturnValue(true);
      devFlagValueMock.mockReturnValue(devEnvironment);

      await expect(service.getManagedEnvironment()).resolves.toBe(devEnvironment);
      expect(managedSettingsService.get).not.toHaveBeenCalled();
    });
  });

  describe("hasManagedEnvironment", () => {
    it("is true when an environment key is managed", async () => {
      managed({ "environment.base": '"https://vault.example.com"' });

      await expect(service.hasManagedEnvironment()).resolves.toBe(true);
    });

    it("is false when no environment key is managed", async () => {
      await expect(service.hasManagedEnvironment()).resolves.toBe(false);
    });
  });

  describe("setUrlsToManagedEnvironment", () => {
    it("applies the decoded urls as the self-hosted environment", async () => {
      managed({
        "environment.base": '"https://vault.example.com"',
        "environment.api": '"https://api.example.com"',
      });

      await service.setUrlsToManagedEnvironment();

      const environment = await firstValueFrom(service.environment$);
      expect(environment.getUrls()).toMatchObject({
        base: "https://vault.example.com",
        api: "https://api.example.com",
      });
    });
  });
});
