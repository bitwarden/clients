import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { LogService } from "@bitwarden/logging";
import { ManagedSettingsService } from "@bitwarden/managed-settings";
import { ManagedSettingsClient } from "@bitwarden/sdk-internal";

import { BrowserApi } from "../browser/browser-api";

import { BrowserManagedConfigReader } from "./browser-managed-config-reader";

type StorageChangeListener = Parameters<typeof BrowserApi.storageChangeListener>[0];

describe("BrowserManagedConfigReader", () => {
  let managedSettingsService: MockProxy<ManagedSettingsService>;
  let client: MockProxy<ManagedSettingsClient>;
  let logService: MockProxy<LogService>;
  let getManagedStorage: jest.SpyInstance;
  let listener: StorageChangeListener;
  let reader: BrowserManagedConfigReader;

  beforeEach(() => {
    client = mock<ManagedSettingsClient>();
    client.update_from_json.mockResolvedValue(undefined);
    // Assigned after construction; see mockManagedSettingsService in @bitwarden/common/spec.
    managedSettingsService = mock<ManagedSettingsService>();
    managedSettingsService.client$ = new BehaviorSubject(client);
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

  it("passes managed storage to the SDK as JSON on init", async () => {
    getManagedStorage.mockResolvedValue({ environment: { base: "https://vault.example.com" } });

    await reader.init();

    expect(client.update_from_json).toHaveBeenCalledWith(
      '{"environment":{"base":"https://vault.example.com"}}',
    );
  });

  it("reads managed storage exactly once on init", async () => {
    await reader.init();

    expect(getManagedStorage).toHaveBeenCalledTimes(1);
  });

  it("re-reads and passes managed storage when a storage change reports the managed area", async () => {
    await reader.init();
    getManagedStorage.mockResolvedValue({ environment: { base: "https://vault.example.com" } });

    listener({}, "managed");
    await flushPromises();

    expect(getManagedStorage).toHaveBeenCalledTimes(2);
    expect(client.update_from_json).toHaveBeenLastCalledWith(
      '{"environment":{"base":"https://vault.example.com"}}',
    );
  });

  it.each(["local", "sync", "session"] as const)(
    "ignores a storage change for the %s area",
    async (area) => {
      await reader.init();
      client.update_from_json.mockClear();

      listener({}, area);
      await flushPromises();

      expect(getManagedStorage).toHaveBeenCalledTimes(1);
      expect(client.update_from_json).not.toHaveBeenCalled();
    },
  );

  it("passes an empty managed storage area to the SDK", async () => {
    getManagedStorage.mockResolvedValue({});

    await reader.init();

    expect(client.update_from_json).toHaveBeenCalledWith("{}");
  });

  it("does not update the SDK when the browser has no managed storage area", async () => {
    getManagedStorage.mockResolvedValue(undefined);

    await reader.init();

    expect(client.update_from_json).not.toHaveBeenCalled();
  });

  it("keeps the previous profile when a read fails", async () => {
    getManagedStorage.mockRejectedValue(new Error("Managed storage manifest not found"));

    await reader.init();

    expect(client.update_from_json).not.toHaveBeenCalled();
  });

  it("resolves init when a read fails", async () => {
    getManagedStorage.mockRejectedValue(new Error("Managed storage manifest not found"));

    await expect(reader.init()).resolves.toBeUndefined();
  });

  it("logs a value the SDK rejects", async () => {
    client.update_from_json.mockRejectedValue(new Error("top level is not an object"));

    await reader.init();

    expect(logService.error).toHaveBeenCalledWith(
      "Managed configuration: the managed storage area was rejected.",
      "top level is not an object",
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
