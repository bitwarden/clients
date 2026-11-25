import { globalShortcut } from "electron";
import { mock, MockProxy } from "jest-mock-extended";

import { IpcService } from "@bitwarden/common/platform/ipc";
import { autotype } from "@bitwarden/desktop-napi";
import { LogService } from "@bitwarden/logging";
import { AutotypeDriver, IpcClient, registerAutotypeHandlers } from "@bitwarden/sdk-internal";

import { WindowMain } from "../../main/window.main";
import { DEFAULT_KEYBOARD_SHORTCUT } from "../models/main-autotype-keyboard-shortcut";

import { MainDesktopAutotypeService } from "./main-desktop-autotype.service";

/*
  Only the `globalShortcut` surface the reachable code paths touch is mocked.
  This service registers no Electron IPC listeners (its IPC goes through the
  SDK, which is mocked), so `ipcMain` is not needed.
*/
jest.mock("electron", () => ({
  globalShortcut: {
    unregister: jest.fn(),
    isRegistered: jest.fn(),
  },
}));

jest.mock("@bitwarden/desktop-napi", () => ({
  autotype: {
    getRunningApps: jest.fn(),
  },
}));

jest.mock("@bitwarden/sdk-internal", () => ({
  registerAutotypeHandlers: jest.fn(),
}));

/*
  This suite intentionally only covers the code that is reachable today:
  the constructor, `init()`, `listRunningApps()`, the Autotype IPC driver,
  `disableAutotype()` and `dispose()`. The private `enableAutotype()` and
  `setKeyboardShortcut()` methods have no caller yet (the driver doesn't apply
  the enabled state or the keyboard shortcut until PM-38967), so they are left
  for the tickets that wire them up.
*/
describe("MainDesktopAutotypeService", () => {
  const defaultKeyboardShortcut = DEFAULT_KEYBOARD_SHORTCUT.join("+");
  const runningApps: autotype.RunningApp[] = [
    { name: "App A", path: "%LOCALAPPDATA%\\AppA\\app-a.exe" },
    { name: "App B", path: "C:\\Program Files\\AppB\\app-b.exe" },
  ];

  let mockLogService: MockProxy<LogService>;
  let mockWindowMain: MockProxy<WindowMain>;
  let mockIpcClient: IpcClient;
  let mockIpcService: MockProxy<IpcService>;
  let service: MainDesktopAutotypeService;

  beforeEach(() => {
    jest.clearAllMocks();

    mockLogService = mock<LogService>();
    mockWindowMain = mock<WindowMain>();
    mockIpcClient = {} as IpcClient;
    mockIpcService = mock<IpcService>({ client: mockIpcClient });

    (globalShortcut.isRegistered as jest.Mock).mockReturnValue(false);
    (registerAutotypeHandlers as jest.Mock).mockResolvedValue(undefined);
    (autotype.getRunningApps as jest.Mock).mockResolvedValue(runningApps);

    // Created manually since this service does not use Angular DI
    service = new MainDesktopAutotypeService(mockLogService, mockWindowMain, mockIpcService);
  });

  // Initializes the service and returns the driver it registered with the SDK
  async function registeredDriver(): Promise<AutotypeDriver> {
    await service.init();
    return (registerAutotypeHandlers as jest.Mock).mock.calls[0][1];
  }

  describe("constructor", () => {
    it("should create the service", () => {
      expect(service).toBeTruthy();
    });

    it("should initialize the keyboard shortcut to the default", () => {
      // Read the private field rather than widening its visibility in
      // production code; there is no accessor for it yet.
      const keyboardShortcut = service["autotypeKeyboardShortcut"];

      expect(keyboardShortcut).toBeDefined();
      expect(keyboardShortcut.getArrayFormat()).toEqual(DEFAULT_KEYBOARD_SHORTCUT);
      expect(keyboardShortcut.getElectronFormat()).toEqual(defaultKeyboardShortcut);
    });
  });

  describe("init", () => {
    it("should register the Autotype IPC handlers on the IPC client", async () => {
      await service.init();

      expect(registerAutotypeHandlers).toHaveBeenCalledTimes(1);
      expect(registerAutotypeHandlers).toHaveBeenCalledWith(mockIpcClient, expect.anything());
    });

    it("should log an error and resolve when the handlers can't be registered", async () => {
      const error = new Error("registration failed");
      (registerAutotypeHandlers as jest.Mock).mockRejectedValue(error);

      await expect(service.init()).resolves.toBeUndefined();

      expect(mockLogService.error).toHaveBeenCalledWith(
        "Failed to register the Autotype IPC handlers.",
        error,
      );
    });
  });

  describe("listRunningApps", () => {
    it("should return the running apps from desktop native", async () => {
      await expect(service.listRunningApps()).resolves.toEqual(runningApps);
    });

    it("should not log anything when the apps are listed", async () => {
      await service.listRunningApps();

      expect(mockLogService.debug).not.toHaveBeenCalled();
      expect(mockLogService.info).not.toHaveBeenCalled();
      expect(mockLogService.warning).not.toHaveBeenCalled();
      expect(mockLogService.error).not.toHaveBeenCalled();
    });

    it("should return an empty list and log an error when the apps can't be listed", async () => {
      const error = new Error("listing failed");
      (autotype.getRunningApps as jest.Mock).mockRejectedValue(error);

      await expect(service.listRunningApps()).resolves.toEqual([]);

      expect(mockLogService.error).toHaveBeenCalledWith(
        "Failed to list the running apps for Autotype.",
        error,
      );
    });
  });

  describe("Autotype IPC driver", () => {
    it("should answer a running apps request with the running apps", async () => {
      const driver = await registeredDriver();

      await expect(driver.list_running_apps()).resolves.toEqual(runningApps);
    });

    it("should answer a running apps request with an empty list when the apps can't be listed", async () => {
      (autotype.getRunningApps as jest.Mock).mockRejectedValue(new Error("listing failed"));
      const driver = await registeredDriver();

      await expect(driver.list_running_apps()).resolves.toEqual([]);
    });

    it("should report that the enabled state wasn't applied", async () => {
      const driver = await registeredDriver();

      await expect(driver.set_autotype_enabled(true)).resolves.toBe(false);
      await expect(driver.set_autotype_enabled(false)).resolves.toBe(false);
      expect(globalShortcut.unregister).not.toHaveBeenCalled();
    });

    it("should report that the keyboard shortcut wasn't applied", async () => {
      const driver = await registeredDriver();

      await expect(driver.set_autotype_keyboard_shortcut(["Control", "Alt", "B"])).resolves.toBe(
        false,
      );
      expect(service["autotypeKeyboardShortcut"].getArrayFormat()).toEqual(
        DEFAULT_KEYBOARD_SHORTCUT,
      );
    });
  });

  describe("disableAutotype", () => {
    it("should unregister the keyboard shortcut when it is registered", () => {
      (globalShortcut.isRegistered as jest.Mock).mockReturnValue(true);

      service.disableAutotype();

      expect(globalShortcut.unregister).toHaveBeenCalledWith(defaultKeyboardShortcut);
      expect(mockLogService.debug).toHaveBeenCalledWith("Autotype disabled.");
    });

    it("should log that autotype is implicitly disabled when the keyboard shortcut is not registered", () => {
      (globalShortcut.isRegistered as jest.Mock).mockReturnValue(false);

      service.disableAutotype();

      expect(globalShortcut.unregister).not.toHaveBeenCalled();
      expect(mockLogService.debug).toHaveBeenCalledWith(
        "Autotype is not registered, implicitly disabled.",
      );
    });
  });

  describe("dispose", () => {
    it("should disable autotype when the keyboard shortcut is registered", () => {
      (globalShortcut.isRegistered as jest.Mock).mockReturnValue(true);

      service.dispose();

      expect(globalShortcut.unregister).toHaveBeenCalledWith(defaultKeyboardShortcut);
      expect(mockLogService.debug).toHaveBeenCalledWith("Autotype disabled.");
    });

    it("should not unregister the keyboard shortcut when it is not registered", () => {
      (globalShortcut.isRegistered as jest.Mock).mockReturnValue(false);

      service.dispose();

      expect(globalShortcut.unregister).not.toHaveBeenCalled();
      expect(mockLogService.debug).toHaveBeenCalledWith(
        "Autotype is not registered, implicitly disabled.",
      );
    });

    it("should not throw", () => {
      expect(() => service.dispose()).not.toThrow();
    });
  });
});
