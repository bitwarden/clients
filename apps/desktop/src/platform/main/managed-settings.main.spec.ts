import { ipcMain } from "electron";

import * as secure from "@bitwarden/node/managed-settings/secure-config-dir";

import { ManagedSettingsMain } from "./managed-settings.main";

jest.mock("electron", () => ({
  ipcMain: { handle: jest.fn() },
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

  it("returns an empty bag on non-linux until native readers land", async () => {
    const sut = new ManagedSettingsMain(windowMain, logService, "win32");
    sut.init();
    const handler = (ipcMain.handle as jest.Mock).mock.calls.find(
      (c) => c[0] === "managedSettings",
    )?.[1];
    expect(await handler()).toEqual({});
  });
});
