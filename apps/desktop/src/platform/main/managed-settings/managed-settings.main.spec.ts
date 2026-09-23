import { ipcMain } from "electron";
import { mock, MockProxy } from "jest-mock-extended";

import { LogService } from "@bitwarden/logging";
import { createManagementProfile, ManagedSettingsService } from "@bitwarden/managed-settings";

import { WindowMain } from "../../../main/window.main";

import { ManagedSettingsSource } from "./managed-settings-source";
import { ManagedSettingsMain } from "./managed-settings.main";

jest.mock("electron", () => ({
  ipcMain: {
    handle: jest.fn(),
  },
}));

const LOCATION = "test location";

describe("ManagedSettingsMain", () => {
  let source: MockProxy<ManagedSettingsSource>;
  let managedSettingsService: MockProxy<ManagedSettingsService>;
  let logService: MockProxy<LogService>;
  let sendMock: jest.Mock;
  let windowMain: WindowMain;
  let ipcHandlers: Map<string, (...args: unknown[]) => unknown>;

  beforeEach(() => {
    jest.clearAllMocks();

    ipcHandlers = new Map();
    (ipcMain.handle as jest.Mock).mockImplementation(
      (channel: string, handler: (...args: unknown[]) => unknown) => {
        ipcHandlers.set(channel, handler);
      },
    );

    source = mock<ManagedSettingsSource>({ location: LOCATION });
    managedSettingsService = mock<ManagedSettingsService>();
    logService = mock<LogService>();
    sendMock = jest.fn();
    windowMain = { win: { webContents: { send: sendMock } } } as unknown as WindowMain;
  });

  function createSut(): ManagedSettingsMain {
    return new ManagedSettingsMain(source, managedSettingsService, windowMain, logService);
  }

  it("applies a container value read at startup as a ManagementProfile whose settings match createManagementProfile", async () => {
    const raw = { general: { theme: "dark" } };
    source.read.mockResolvedValue(JSON.stringify(raw));

    await createSut().init();

    expect(managedSettingsService.updateProfile).toHaveBeenCalledWith(
      expect.objectContaining({ settings: createManagementProfile(raw).settings }),
    );
  });

  it("keeps the last known profile and logs the location when a read rejects", async () => {
    source.read
      .mockResolvedValueOnce(JSON.stringify({ a: 1 }))
      .mockRejectedValueOnce(new Error("boom"));
    let onChanged: () => void = () => {};
    source.watch.mockImplementation(async (cb) => {
      onChanged = cb;
    });
    const sut = createSut();
    await sut.init();
    const profile = sut.current();

    onChanged();
    await flush();

    expect(managedSettingsService.updateProfile).toHaveBeenCalledTimes(1);
    expect(sut.current()).toBe(profile);
    expect(logService.warning).toHaveBeenCalledWith(
      expect.stringContaining(LOCATION),
      expect.any(Error),
    );
  });

  it("makes no updateProfile call when the startup read rejects", async () => {
    source.read.mockRejectedValue(new Error("boom"));

    await createSut().init();

    expect(managedSettingsService.updateProfile).not.toHaveBeenCalled();
  });

  it("does not republish when a re-read returns the same container string", async () => {
    source.read.mockResolvedValue(JSON.stringify({ a: 1 }));
    let onChanged: () => void = () => {};
    source.watch.mockImplementation(async (cb) => {
      onChanged = cb;
    });

    await createSut().init();
    onChanged();
    await flush();

    expect(managedSettingsService.updateProfile).toHaveBeenCalledTimes(1);
    expect(sendMock).toHaveBeenCalledTimes(1);
  });

  it("clears the profile when the container value is an empty object", async () => {
    source.read.mockResolvedValue("{}");

    await createSut().init();

    expect(managedSettingsService.updateProfile).toHaveBeenCalledWith(undefined);
  });

  it("logs that the platform has no source and publishes nothing when the source is undefined", async () => {
    const sut = new ManagedSettingsMain(undefined, managedSettingsService, windowMain, logService);

    await sut.init();

    expect(logService.info).toHaveBeenCalledWith(expect.stringContaining("no source"));
    expect(managedSettingsService.updateProfile).not.toHaveBeenCalled();
    expect(ipcHandlers.get("managedSettings.current")!()).toBeUndefined();
  });

  it("clears the profile when the host declares no managed configuration", async () => {
    source.read.mockResolvedValue(undefined);

    await createSut().init();

    expect(managedSettingsService.updateProfile).toHaveBeenCalledWith(undefined);
  });

  it("clears the profile and logs an error when the container value is not valid JSON", async () => {
    source.read.mockResolvedValue("not json");

    await createSut().init();

    expect(managedSettingsService.updateProfile).toHaveBeenCalledWith(undefined);
    expect(logService.error).toHaveBeenCalled();
  });

  it("clears the profile when the container value's top level is an array", async () => {
    source.read.mockResolvedValue(JSON.stringify([1, 2, 3]));

    await createSut().init();

    expect(managedSettingsService.updateProfile).toHaveBeenCalledWith(undefined);
  });

  it("clears the profile when the container value's top level is a JSON scalar", async () => {
    source.read.mockResolvedValue(JSON.stringify("5"));

    await createSut().init();

    expect(managedSettingsService.updateProfile).toHaveBeenCalledWith(undefined);
  });

  it("re-reads and republishes when the watcher signals a change", async () => {
    source.read
      .mockResolvedValueOnce(JSON.stringify({ a: 1 }))
      .mockResolvedValueOnce(JSON.stringify({ a: 2 }));
    let onChanged: () => void = () => {};
    source.watch.mockImplementation(async (cb) => {
      onChanged = cb;
    });

    await createSut().init();
    expect(managedSettingsService.updateProfile).toHaveBeenCalledTimes(1);

    onChanged();
    await flush();

    expect(managedSettingsService.updateProfile).toHaveBeenCalledTimes(2);
    expect(managedSettingsService.updateProfile).toHaveBeenLastCalledWith(
      expect.objectContaining({ settings: createManagementProfile({ a: 2 }).settings }),
    );
  });

  it("sends managedSettings.updated to the renderer with the same profile passed to updateProfile", async () => {
    source.read.mockResolvedValue(JSON.stringify({ a: 1 }));

    await createSut().init();

    const publishedProfile = managedSettingsService.updateProfile.mock.calls[0][0];
    expect(sendMock).toHaveBeenCalledWith("managedSettings.updated", publishedProfile);
  });

  it("registers a managedSettings.current handler that returns the active profile", async () => {
    source.read.mockResolvedValue(JSON.stringify({ a: 1 }));
    const sut = createSut();
    await sut.init();

    const handler = ipcHandlers.get("managedSettings.current")!;
    expect(handler()).toBe(sut.current());
    expect(sut.current()).not.toBeUndefined();
  });

  it("registers a managedSettings.current handler that returns undefined when no profile is active", () => {
    const sut = createSut();

    const handler = ipcHandlers.get("managedSettings.current")!;
    expect(handler()).toBeUndefined();
    expect(sut.current()).toBeUndefined();
  });

  it("logs an error and does not reject init() when source.watch rejects, while the startup read still applies", async () => {
    source.read.mockResolvedValue(JSON.stringify({ a: 1 }));
    source.watch.mockRejectedValue(new Error("no watcher on this platform"));

    await expect(createSut().init()).resolves.toBeUndefined();

    expect(logService.error).toHaveBeenCalled();
    expect(managedSettingsService.updateProfile).toHaveBeenCalledWith(
      expect.objectContaining({ settings: createManagementProfile({ a: 1 }).settings }),
    );
  });

  it.each([
    ["a valid container value", (secret: string) => JSON.stringify({ apiKey: secret })],
    ["an invalid container value", (secret: string) => `{ apiKey: ${secret}`],
  ])("never logs %s itself", async (_name, containerFor) => {
    const secret = "sk_live_super_secret_value_12345";
    source.read.mockResolvedValue(containerFor(secret));
    source.watch.mockRejectedValue(new Error("watch failed: " + "unrelated reason"));

    await createSut().init();

    const allLogCalls = [
      ...logService.info.mock.calls,
      ...logService.error.mock.calls,
      ...logService.warning.mock.calls,
    ];
    for (const call of allLogCalls) {
      for (const arg of call) {
        expect(JSON.stringify(arg)).not.toContain(secret);
      }
    }
  });
});

async function flush(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}
