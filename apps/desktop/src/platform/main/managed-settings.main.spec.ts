import { ipcMain } from "electron";

import { managed_settings, windows_registry } from "@bitwarden/desktop-napi";
import * as secure from "@bitwarden/node/managed-settings/secure-config-dir";

import { ManagedSettingsMain } from "./managed-settings.main";

jest.mock("electron", () => ({
  ipcMain: { handle: jest.fn() },
}));

jest.mock("@bitwarden/desktop-napi", () => ({
  managed_settings: { watchRegistry: jest.fn().mockResolvedValue(undefined) },
  windows_registry: { readValues: jest.fn().mockResolvedValue({}) },
}));

describe("ManagedSettingsMain (linux)", () => {
  const logService = { warning: jest.fn(), error: jest.fn(), info: jest.fn() } as any;
  const send = jest.fn();
  const windowMain = { win: { webContents: { send } } } as any;

  beforeEach(() => jest.clearAllMocks());

  it("registers the managedSettings IPC handler returning the read bag", async () => {
    jest
      .spyOn(secure, "readSecureManagedConfigDir")
      .mockReturnValue({ environment: { base: "https://x" } });
    const sut = new ManagedSettingsMain(windowMain, logService, "linux");
    sut.init();

    const handler = (ipcMain.handle as jest.Mock).mock.calls.find(
      (c) => c[0] === "managedSettings",
    )?.[1];
    expect(handler).toBeDefined();
    expect(await handler()).toEqual({ environment: { base: "https://x" } });
  });

  it("returns registry values on win32 (mocked to empty)", async () => {
    const sut = new ManagedSettingsMain(windowMain, logService, "win32");
    sut.init();
    const handler = (ipcMain.handle as jest.Mock).mock.calls.find(
      (c) => c[0] === "managedSettings",
    )?.[1];
    expect(await handler()).toEqual({});
    expect(windows_registry.readValues).toHaveBeenCalledWith(
      "HKLM",
      "SOFTWARE\\Policies\\Bitwarden",
    );
  });

  it("starts the registry watcher on win32", () => {
    const sut = new ManagedSettingsMain(windowMain, logService, "win32");
    sut.init();
    expect(managed_settings.watchRegistry).toHaveBeenCalledWith(
      "SOFTWARE\\Policies\\Bitwarden",
      expect.any(Function),
    );
  });
});
