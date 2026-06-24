import { mock, MockProxy } from "jest-mock-extended";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { ManagedSettingsService } from "@bitwarden/common/platform/managed-settings/managed-settings.service";

import { BrowserApi } from "../browser/browser-api";

import { BrowserManagedConfigReader } from "./browser-managed-config-reader";

describe("BrowserManagedConfigReader", () => {
  let managedSettings: MockProxy<ManagedSettingsService>;
  let logService: MockProxy<LogService>;
  let reader: BrowserManagedConfigReader;

  beforeEach(() => {
    jest.clearAllMocks();
    managedSettings = mock<ManagedSettingsService>();
    logService = mock<LogService>();
    reader = new BrowserManagedConfigReader(managedSettings, logService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("pushes the managed config on refresh", async () => {
    jest
      .spyOn(BrowserApi, "getManagedStorage")
      .mockResolvedValue({ environment: { base: "https://x" } });

    await reader.refresh();

    expect(managedSettings.pushExplicit).toHaveBeenCalledWith({
      environment: { base: "https://x" },
    });
  });

  it("does nothing when the managed area is absent", async () => {
    jest.spyOn(BrowserApi, "getManagedStorage").mockResolvedValue(null);

    await reader.refresh();

    expect(managedSettings.pushExplicit).not.toHaveBeenCalled();
  });

  it("swallows and logs a read error", async () => {
    const error = new Error("denied");
    jest.spyOn(BrowserApi, "getManagedStorage").mockRejectedValue(error);

    await reader.refresh();

    expect(logService.error).toHaveBeenCalled();
    expect(managedSettings.pushExplicit).not.toHaveBeenCalled();
  });

  it("re-reads only on managed-area changes after start", async () => {
    const getSpy = jest.spyOn(BrowserApi, "getManagedStorage").mockResolvedValue({});
    let fire: (changes: unknown, area: string) => void = () => {};
    jest.spyOn(BrowserApi, "storageChangeListener").mockImplementation((cb) => {
      fire = cb as (changes: unknown, area: string) => void;
    });

    await reader.start();
    expect(getSpy).toHaveBeenCalledTimes(1); // initial read

    fire({}, "managed");
    expect(getSpy).toHaveBeenCalledTimes(2);

    fire({}, "local");
    expect(getSpy).toHaveBeenCalledTimes(2); // non-managed area ignored
  });
});
