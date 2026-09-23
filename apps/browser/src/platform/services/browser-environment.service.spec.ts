import { mock, MockProxy } from "jest-mock-extended";
import { firstValueFrom, Subscription } from "rxjs";

import { Utils } from "@bitwarden/common/platform/misc/utils";
import {
  FakeAccountService,
  FakeStateProvider,
  mockAccountServiceWith,
} from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import {
  createManagementProfile,
  DefaultManagedSettingsService,
  ManagedSettingsService,
} from "@bitwarden/managed-settings";

import { GroupPolicyEnvironment } from "../../admin-console/types/group-policy-environment";
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

    service = new BrowserEnvironmentService(stateProvider, accountService, managedSettingsService);
  });

  describe("getManagedEnvironment", () => {
    it("decodes every managed environment leaf into the matching field", () => {
      managed({
        "environment.base": '"https://vault.example.com"',
        "environment.webVault": '"https://web.example.com"',
        "environment.api": '"https://api.example.com"',
        "environment.identity": '"https://identity.example.com"',
        "environment.icons": '"https://icons.example.com"',
        "environment.notifications": '"https://notifications.example.com"',
        "environment.events": '"https://events.example.com"',
      });

      expect(service.getManagedEnvironment()).toEqual({
        base: "https://vault.example.com",
        webVault: "https://web.example.com",
        api: "https://api.example.com",
        identity: "https://identity.example.com",
        icons: "https://icons.example.com",
        notifications: "https://notifications.example.com",
        events: "https://events.example.com",
      });
    });

    it("returns only the fields the profile carries", () => {
      managed({ "environment.base": '"https://vault.example.com"' });

      expect(service.getManagedEnvironment()).toEqual({
        base: "https://vault.example.com",
      });
    });

    it("keeps an empty string, because presence in the profile means the value is forced", () => {
      managed({ "environment.base": '""' });

      expect(service.getManagedEnvironment()).toEqual({ base: "" });
    });

    it("ignores a managed key outside the environment namespace", () => {
      managed({ "generator.password.length": "20" });

      expect(service.getManagedEnvironment()).toBeNull();
    });

    it("returns null when no environment key is managed", () => {
      expect(service.getManagedEnvironment()).toBeNull();
    });

    it("returns the dev flag value unchanged when managedEnvironment is enabled", () => {
      const devEnvironment = { base: "https://localhost:8080" };
      devFlagEnabledMock.mockReturnValue(true);
      devFlagValueMock.mockReturnValue(devEnvironment);

      expect(service.getManagedEnvironment()).toBe(devEnvironment);
      expect(managedSettingsService.get).not.toHaveBeenCalled();
    });
  });

  describe("setUrlsToManagedEnvironment", () => {
    it("applies the given urls as the self-hosted environment", async () => {
      await service.setUrlsToManagedEnvironment({
        base: "https://vault.example.com",
        api: "https://api.example.com",
      });

      const environment = await firstValueFrom(service.environment$);
      expect(environment.getUrls()).toMatchObject({
        base: "https://vault.example.com",
        api: "https://api.example.com",
      });
    });
  });

  describe("managedEnvironment$", () => {
    // The real service is used rather than a mock: `managedEnvironment$` is built on `get$`, and a
    // mocked `get$` returns undefined, which `combineLatest` cannot subscribe to.
    let realManagedSettingsService: DefaultManagedSettingsService;
    let emissions: (GroupPolicyEnvironment | null)[];
    let subscription: Subscription;

    /** Pushes a profile the way `BrowserManagedConfigReader` would. */
    function push(source: Record<string, unknown>) {
      realManagedSettingsService.updateProfile(createManagementProfile(source));
    }

    function subscribe() {
      subscription = service.managedEnvironment$.subscribe((e) => emissions.push(e));
    }

    beforeEach(() => {
      emissions = [];
      realManagedSettingsService = new DefaultManagedSettingsService(Promise.resolve());
      service = new BrowserEnvironmentService(
        stateProvider,
        accountService,
        realManagedSettingsService,
      );
    });

    afterEach(() => subscription?.unsubscribe());

    it("emits the administrator's environment already in the profile when subscribed", () => {
      push({ environment: { base: "https://vault.example.com" } });

      subscribe();

      expect(emissions).toEqual([{ base: "https://vault.example.com" }]);
    });

    it("emits a policy that arrives after subscribing", () => {
      subscribe();

      push({ environment: { base: "https://vault.example.com" } });

      expect(emissions).toEqual([null, { base: "https://vault.example.com" }]);
    });

    it("emits once for a policy that changes several urls at the same time", () => {
      push({ environment: { base: "https://vault.example.com" } });
      subscribe();
      emissions.length = 0;

      push({
        environment: {
          base: "https://new.example.com",
          api: "https://api.example.com",
          identity: "https://identity.example.com",
        },
      });

      expect(emissions).toEqual([
        {
          base: "https://new.example.com",
          api: "https://api.example.com",
          identity: "https://identity.example.com",
        },
      ]);
    });

    it("emits null when the profile carries no environment key", () => {
      push({ generator: { password: { length: 20 } } });

      subscribe();

      expect(emissions).toEqual([null]);
    });

    it("does not re-emit when a push changes only a key outside the environment namespace", () => {
      push({ environment: { base: "https://vault.example.com" } });
      subscribe();
      emissions.length = 0;

      push({
        environment: { base: "https://vault.example.com" },
        generator: { password: { length: 20 } },
      });

      expect(emissions).toEqual([]);
    });

    it("does not re-emit when the same policy is pushed twice", () => {
      push({ environment: { base: "https://vault.example.com" } });
      subscribe();
      emissions.length = 0;

      push({ environment: { base: "https://vault.example.com" } });

      expect(emissions).toEqual([]);
    });

    it("emits the dev flag environment even though the profile is empty", () => {
      const devEnvironment = { base: "https://localhost:8080" };
      devFlagEnabledMock.mockReturnValue(true);
      devFlagValueMock.mockReturnValue(devEnvironment);

      subscribe();

      expect(emissions).toEqual([devEnvironment]);
    });
  });
});
