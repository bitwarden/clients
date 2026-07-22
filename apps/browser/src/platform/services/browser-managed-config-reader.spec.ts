import { mock, MockProxy } from "jest-mock-extended";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { ManagedSettingsService } from "@bitwarden/common/platform/managed-settings";

import { BrowserApi } from "../browser/browser-api";

import { BrowserManagedConfigReader } from "./browser-managed-config-reader";

describe("BrowserManagedConfigReader", () => {
  let managedSettingsService: MockProxy<ManagedSettingsService>;
  let logService: MockProxy<LogService>;
  let reader: BrowserManagedConfigReader;
  let changeListener: Parameters<typeof BrowserApi.storageChangeListener>[0];

  beforeEach(() => {
    managedSettingsService = mock<ManagedSettingsService>();
    logService = mock<LogService>();

    jest.spyOn(BrowserApi, "getManagedStorage").mockResolvedValue(null);
    jest.spyOn(BrowserApi, "storageChangeListener").mockImplementation((callback) => {
      changeListener = callback;
    });

    reader = new BrowserManagedConfigReader(managedSettingsService, logService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("reads managed storage and pushes a normalized profile at startup", async () => {
    jest
      .spyOn(BrowserApi, "getManagedStorage")
      .mockResolvedValue({ environment: { base: "https://vault" } });

    await reader.start();

    expect(BrowserApi.getManagedStorage).toHaveBeenCalledTimes(1);
    const profile = managedSettingsService.updateProfile.mock.calls[0][0];
    expect(profile?.settings.get("environment.base")).toBe('"https://vault"');
  });

  it("clears the profile when the managed store is empty (fail closed)", async () => {
    jest.spyOn(BrowserApi, "getManagedStorage").mockResolvedValue({});

    await reader.start();

    expect(managedSettingsService.updateProfile).toHaveBeenCalledWith(undefined);
  });

  it("clears the profile when the managed store is unreadable (fail closed)", async () => {
    jest.spyOn(BrowserApi, "getManagedStorage").mockRejectedValue(new Error("access denied"));

    await reader.start();

    expect(managedSettingsService.updateProfile).toHaveBeenCalledWith(undefined);
  });

  it("re-reads when the managed storage area changes", async () => {
    await reader.start();
    expect(BrowserApi.getManagedStorage).toHaveBeenCalledTimes(1);

    changeListener({}, "managed");

    expect(BrowserApi.getManagedStorage).toHaveBeenCalledTimes(2);
  });

  it("ignores changes to other storage areas", async () => {
    await reader.start();
    expect(BrowserApi.getManagedStorage).toHaveBeenCalledTimes(1);

    changeListener({}, "local");
    changeListener({}, "sync");
    changeListener({}, "session");

    expect(BrowserApi.getManagedStorage).toHaveBeenCalledTimes(1);
  });
});
