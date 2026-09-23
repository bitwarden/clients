import { mock, MockProxy } from "jest-mock-extended";
import { firstValueFrom } from "rxjs";

import { Region } from "@bitwarden/common/platform/abstractions/environment.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import {
  FakeAccountService,
  FakeStateProvider,
  mockAccountServiceWith,
} from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { LogService } from "@bitwarden/logging";
import {
  createManagementProfile,
  DefaultManagedSettingsService,
} from "@bitwarden/managed-settings";

import { BrowserEnvironmentService } from "./browser-environment.service";
import { BrowserManagedEnvironmentApplier } from "./browser-managed-environment-applier";

jest.mock("../flags", () => ({
  ...jest.requireActual("../flags"),
  devFlagEnabled: jest.fn().mockReturnValue(false),
  devFlagValue: jest.fn(),
}));

describe("BrowserManagedEnvironmentApplier", () => {
  let accountService: FakeAccountService;
  let stateProvider: FakeStateProvider;
  let managedSettingsService: DefaultManagedSettingsService;
  let environmentService: BrowserEnvironmentService;
  let logService: MockProxy<LogService>;
  let applier: BrowserManagedEnvironmentApplier;

  /** Pushes a profile the way `BrowserManagedConfigReader` would. */
  function push(source: Record<string, unknown>) {
    managedSettingsService.updateProfile(createManagementProfile(source));
  }

  /** Lets the applier's asynchronous read-compare-write settle. */
  function settle() {
    return new Promise((resolve) => setTimeout(resolve, 0));
  }

  function currentUrls() {
    return firstValueFrom(environmentService.environment$).then((e) => e.getUrls());
  }

  beforeEach(() => {
    accountService = mockAccountServiceWith(Utils.newGuid() as UserId);
    stateProvider = new FakeStateProvider(accountService);
    managedSettingsService = new DefaultManagedSettingsService(Promise.resolve());
    environmentService = new BrowserEnvironmentService(
      stateProvider,
      accountService,
      managedSettingsService,
    );
    logService = mock<LogService>();
    applier = new BrowserManagedEnvironmentApplier(environmentService, stateProvider, logService);
  });

  it("applies a policy that is already present at startup", async () => {
    push({ environment: { base: "https://vault.example.com" } });

    applier.init();
    await settle();

    expect(await currentUrls()).toMatchObject({ base: "https://vault.example.com" });
  });

  it("applies a policy that arrives after startup", async () => {
    applier.init();
    await settle();

    push({ environment: { base: "https://late.example.com" } });
    await settle();

    expect(await currentUrls()).toMatchObject({ base: "https://late.example.com" });
  });

  it("re-applies when the administrator changes the policy", async () => {
    push({ environment: { base: "https://first.example.com" } });
    applier.init();
    await settle();

    push({ environment: { base: "https://second.example.com" } });
    await settle();

    expect(await currentUrls()).toMatchObject({ base: "https://second.example.com" });
  });

  it("does not re-apply over a url the user changed after the policy was applied", async () => {
    push({ environment: { base: "https://vault.example.com" } });
    applier.init();
    await settle();

    await environmentService.setEnvironment(Region.EU);

    // A second applier over the same state stands in for the next service worker, which re-pushes
    // the unchanged profile from managed storage.
    new BrowserManagedEnvironmentApplier(environmentService, stateProvider, logService).init();
    await settle();

    const environment = await firstValueFrom(environmentService.environment$);
    expect(environment.getRegion()).toBe(Region.EU);
  });

  it("leaves the applied environment in place when the administrator withdraws the policy", async () => {
    push({ environment: { base: "https://vault.example.com" } });
    applier.init();
    await settle();

    managedSettingsService.updateProfile(undefined);
    await settle();

    expect(await currentUrls()).toMatchObject({ base: "https://vault.example.com" });
  });

  it("applies a different policy deployed after a withdrawal", async () => {
    push({ environment: { base: "https://first.example.com" } });
    applier.init();
    await settle();
    managedSettingsService.updateProfile(undefined);
    await settle();

    push({ environment: { base: "https://second.example.com" } });
    await settle();

    expect(await currentUrls()).toMatchObject({ base: "https://second.example.com" });
  });

  it("keeps applying later policies after one apply fails", async () => {
    const setUrls = jest
      .spyOn(environmentService, "setUrlsToManagedEnvironment")
      .mockRejectedValueOnce(new Error("state unavailable"));
    push({ environment: { base: "https://first.example.com" } });
    applier.init();
    await settle();
    setUrls.mockRestore();

    push({ environment: { base: "https://second.example.com" } });
    await settle();

    expect(await currentUrls()).toMatchObject({ base: "https://second.example.com" });
  });

  it("logs the managed keys without any of their values", async () => {
    push({ environment: { base: "https://vault.example.com" } });

    applier.init();
    await settle();

    expect(logService.info).toHaveBeenCalled();
    const logged = JSON.stringify(logService.info.mock.calls);
    expect(logged).toContain("base");
    expect(logged).not.toContain("example.com");
  });
});
