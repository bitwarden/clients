import { ipcRenderer, IpcRendererEvent } from "electron";

import { ThemeType } from "@bitwarden/common/platform/enums";

import preload from "./preload";

jest.mock("electron", () => ({
  ipcRenderer: {
    addListener: jest.fn(),
    invoke: jest.fn(),
    on: jest.fn(),
    removeListener: jest.fn(),
    send: jest.fn(),
  },
}));

jest.mock("../utils", () => ({
  EnvAccessTokenLocation: { Disk: "disk" },
  accessTokenLocation: jest.fn().mockReturnValue("disk"),
  allowBrowserintegrationOverride: jest.fn().mockReturnValue(false),
  isAppImage: jest.fn().mockReturnValue(false),
  isDev: jest.fn().mockReturnValue(false),
  isFlatpak: jest.fn().mockReturnValue(false),
  isMacAppStore: jest.fn().mockReturnValue(false),
  isSnapStore: jest.fn().mockReturnValue(false),
  isWindowsPortable: jest.fn().mockReturnValue(false),
  isWindowsStore: jest.fn().mockReturnValue(false),
}));

describe("platform preload", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("onMessage", () => {
    it("returns a cleanup that removes the exact registered wrapper", () => {
      const cleanup = preload.onMessage.addListener(jest.fn());
      const wrapper = jest.mocked(ipcRenderer.addListener).mock.calls[0][1];

      cleanup();

      expect(ipcRenderer.removeListener).toHaveBeenCalledWith("messagingService", wrapper);
    });

    it("keeps cleanup isolated for multiple callbacks", () => {
      const firstCallback = jest.fn();
      const secondCallback = jest.fn();
      const cleanupFirst = preload.onMessage.addListener(firstCallback);
      const cleanupSecond = preload.onMessage.addListener(secondCallback);
      const firstWrapper = jest.mocked(ipcRenderer.addListener).mock.calls[0][1];
      const secondWrapper = jest.mocked(ipcRenderer.addListener).mock.calls[1][1];

      cleanupFirst();
      secondWrapper({} as IpcRendererEvent, { command: "sync", value: 1 });

      expect(ipcRenderer.removeListener).toHaveBeenCalledWith("messagingService", firstWrapper);
      expect(ipcRenderer.removeListener).not.toHaveBeenCalledWith(
        "messagingService",
        secondWrapper,
      );
      expect(firstCallback).not.toHaveBeenCalled();
      expect(secondCallback).toHaveBeenCalledWith({ command: "sync", value: 1 });

      cleanupSecond();
    });

    it("delivers valid messages and filters messages without a command", () => {
      const callback = jest.fn();
      const cleanup = preload.onMessage.addListener(callback);
      const wrapper = jest.mocked(ipcRenderer.addListener).mock.calls[0][1];

      wrapper({} as IpcRendererEvent, { command: "sync", value: 1 });
      wrapper({} as IpcRendererEvent, { command: "" });

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith({ command: "sync", value: 1 });

      cleanup();
    });
  });

  describe("onSystemThemeUpdated", () => {
    it("forwards the exact theme and returns cleanup for the registered wrapper", () => {
      const callback = jest.fn();
      const cleanup = preload.onSystemThemeUpdated(callback);
      const wrapper = jest.mocked(ipcRenderer.on).mock.calls[0][1];

      wrapper({} as IpcRendererEvent, ThemeType.Dark);

      expect(callback).toHaveBeenCalledWith(ThemeType.Dark);

      cleanup();
      expect(ipcRenderer.removeListener).toHaveBeenCalledWith("systemThemeUpdated", wrapper);
    });
  });
});
