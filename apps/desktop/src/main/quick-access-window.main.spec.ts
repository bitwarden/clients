import { BrowserWindow } from "electron";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import { QuickAccessWindowMain } from "./quick-access-window.main";

jest.mock("electron", () => ({
  app: {
    name: "Bitwarden",
  },
  BrowserWindow: jest.fn(),
  screen: {
    getCursorScreenPoint: jest.fn().mockReturnValue({ x: 0, y: 0 }),
    getDisplayNearestPoint: jest.fn().mockReturnValue({
      workArea: {
        x: 0,
        y: 0,
        width: 1440,
        height: 900,
      },
    }),
  },
  session: {
    fromPartition: jest.fn().mockReturnValue({}),
  },
}));

describe("QuickAccessWindowMain", () => {
  let logService: jest.Mocked<LogService>;
  let webContents: {
    getURL: jest.Mock;
    loadURL?: never;
    send: jest.Mock;
    setWindowOpenHandler: jest.Mock;
    userAgent: string;
  };
  let browserWindow: {
    close: jest.Mock;
    focus: jest.Mock;
    hide: jest.Mock;
    isDestroyed: jest.Mock;
    isFocused: jest.Mock;
    isVisible: jest.Mock;
    loadURL: jest.Mock;
    on: jest.Mock;
    setBounds: jest.Mock;
    setWindowButtonVisibility: jest.Mock;
    show: jest.Mock;
    webContents: typeof webContents;
  };

  beforeEach(() => {
    logService = {
      debug: jest.fn(),
    } as any;
    webContents = {
      getURL: jest.fn().mockReturnValue("file:///index.html#/quick-access"),
      send: jest.fn(),
      setWindowOpenHandler: jest.fn(),
      userAgent: "Electron",
    };
    browserWindow = {
      close: jest.fn(),
      focus: jest.fn(),
      hide: jest.fn(),
      isDestroyed: jest.fn().mockReturnValue(false),
      isFocused: jest.fn().mockReturnValue(false),
      isVisible: jest.fn().mockReturnValue(false),
      loadURL: jest.fn().mockResolvedValue(undefined),
      on: jest.fn(),
      setBounds: jest.fn(),
      setWindowButtonVisibility: jest.fn(),
      show: jest.fn(),
      webContents,
    };

    (BrowserWindow as unknown as jest.Mock).mockClear();
    (BrowserWindow as unknown as jest.Mock).mockImplementation(() => browserWindow);
  });

  it("shows the quick access route without reloading when the window route is clean", async () => {
    const service = new QuickAccessWindowMain(logService);

    await service.show();

    expect(browserWindow.loadURL).toHaveBeenCalledTimes(1);
    expect(browserWindow.loadURL).toHaveBeenCalledWith(
      expect.stringContaining("#/quick-access"),
      expect.any(Object),
    );
    expect(browserWindow.show).toHaveBeenCalled();
  });

  it("reloads the quick access route before showing a reused window with a stale route", async () => {
    const service = new QuickAccessWindowMain(logService);
    await service.show();
    webContents.getURL.mockReturnValue("file:///index.html#/vault");

    await service.show();

    expect(browserWindow.loadURL).toHaveBeenCalledTimes(2);
    expect(browserWindow.loadURL).toHaveBeenLastCalledWith(
      expect.stringContaining("#/quick-access"),
      expect.any(Object),
    );
  });
});
