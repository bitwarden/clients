import { mock, MockProxy } from "jest-mock-extended";

import { LogService } from "@bitwarden/logging";
import { ManagedSettingsService } from "@bitwarden/managed-settings";

import { BrowserApi } from "../browser/browser-api";

import { BrowserManagedConfigReader } from "./browser-managed-config-reader";

type StorageChangeListener = Parameters<typeof BrowserApi.storageChangeListener>[0];

describe("BrowserManagedConfigReader", () => {
  let managedSettingsService: MockProxy<ManagedSettingsService>;
  let logService: MockProxy<LogService>;
  let getManagedStorage: jest.SpyInstance;
  let listener: StorageChangeListener;
  let reader: BrowserManagedConfigReader;

  beforeEach(() => {
    managedSettingsService = mock<ManagedSettingsService>();
    logService = mock<LogService>();

    getManagedStorage = jest.spyOn(BrowserApi, "getManagedStorage").mockResolvedValue({});
    jest.spyOn(BrowserApi, "storageChangeListener").mockImplementation((callback) => {
      listener = callback;
    });

    reader = new BrowserManagedConfigReader(managedSettingsService, logService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("pushes a profile flattened from managed storage on init", async () => {
    getManagedStorage.mockResolvedValue({ environment: { base: "https://vault.example.com" } });

    await reader.init();

    expect(managedSettingsService.updateProfile).toHaveBeenCalledWith({
      version: 1,
      updatedAt: expect.any(Number),
      settings: new Map([["environment.base", '"https://vault.example.com"']]),
    });
  });

  it("reads managed storage exactly once on init", async () => {
    await reader.init();

    expect(getManagedStorage).toHaveBeenCalledTimes(1);
  });

  it("stamps the profile with the current time in seconds", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-09-01T00:00:00.000Z"));
    getManagedStorage.mockResolvedValue({ environment: { base: "https://vault.example.com" } });

    await reader.init();

    expect(managedSettingsService.updateProfile).toHaveBeenCalledWith(
      expect.objectContaining({ updatedAt: 1788220800 }),
    );

    jest.useRealTimers();
  });

  it("re-reads and pushes when a storage change reports the managed area", async () => {
    await reader.init();
    getManagedStorage.mockResolvedValue({ environment: { base: "https://vault.example.com" } });

    listener({}, "managed");
    await flushPromises();

    expect(getManagedStorage).toHaveBeenCalledTimes(2);
    expect(managedSettingsService.updateProfile).toHaveBeenLastCalledWith(
      expect.objectContaining({
        settings: new Map([["environment.base", '"https://vault.example.com"']]),
      }),
    );
  });

  it.each(["local", "sync", "session"] as const)(
    "ignores a storage change for the %s area",
    async (area) => {
      await reader.init();
      managedSettingsService.updateProfile.mockClear();

      listener({}, area);
      await flushPromises();

      expect(getManagedStorage).toHaveBeenCalledTimes(1);
      expect(managedSettingsService.updateProfile).not.toHaveBeenCalled();
    },
  );

  it("clears the profile when managed storage holds no keys", async () => {
    getManagedStorage.mockResolvedValue({});

    await reader.init();

    expect(managedSettingsService.updateProfile).toHaveBeenCalledWith(undefined);
  });

  it("does not push a profile when the browser has no managed storage area", async () => {
    getManagedStorage.mockResolvedValue(undefined);

    await reader.init();

    expect(managedSettingsService.updateProfile).not.toHaveBeenCalled();
  });

  it("keeps the previous profile when a read fails", async () => {
    getManagedStorage.mockRejectedValue(new Error("Managed storage manifest not found"));

    await reader.init();

    expect(managedSettingsService.updateProfile).not.toHaveBeenCalled();
  });

  it("resolves init when a read fails", async () => {
    getManagedStorage.mockRejectedValue(new Error("Managed storage manifest not found"));

    await expect(reader.init()).resolves.toBeUndefined();
  });

  it("logs the managed setting count and key names", async () => {
    getManagedStorage.mockResolvedValue({
      environment: { base: "https://vault.example.com", api: "https://api.example.com" },
    });

    await reader.init();

    expect(logService.info).toHaveBeenCalledWith(
      "Managed configuration: applied 2 managed setting(s).",
      ["environment.api", "environment.base"],
    );
  });

  it("logs no managed value", async () => {
    getManagedStorage.mockResolvedValue({ environment: { base: "https://vault.example.com" } });

    await reader.init();

    expect(JSON.stringify(logService.info.mock.calls)).not.toContain("vault.example.com");
  });

  it("logs why managed storage was unavailable", async () => {
    getManagedStorage.mockRejectedValue(new Error("Managed storage manifest not found"));

    await reader.init();

    expect(logService.info).toHaveBeenCalledWith(
      "Managed configuration: unavailable, keeping the last known profile.",
      "Managed storage manifest not found",
    );
  });
});

/** Lets the reader's fire-and-forget re-read settle before assertions run. */
function flushPromises() {
  return new Promise(process.nextTick);
}
