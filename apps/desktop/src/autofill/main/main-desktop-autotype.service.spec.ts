import { globalShortcut } from "electron";
import { mock, MockProxy } from "jest-mock-extended";

import { IpcService } from "@bitwarden/common/platform/ipc";
import { LogService } from "@bitwarden/logging";
import { AutotypeDriver, registerAutotypeHandlers } from "@bitwarden/sdk-internal";

import { WindowMain } from "../../main/window.main";
import { DEFAULT_KEYBOARD_SHORTCUT } from "../models/main-autotype-keyboard-shortcut";

import { MainDesktopAutotypeService } from "./main-desktop-autotype.service";

/*
  Only the `globalShortcut` surface the reachable code paths touch is mocked.
  This service registers no Electron IPC listeners, so `ipcMain` is not needed.
*/
jest.mock("electron", () => ({
  globalShortcut: {
    register: jest.fn(),
    unregister: jest.fn(),
    isRegistered: jest.fn(),
  },
}));

jest.mock("@bitwarden/sdk-internal", () => ({
  registerAutotypeHandlers: jest.fn(),
}));

/*
  This suite intentionally only covers the code that is reachable today:
  the constructor, `init()` and the driver it registers, `setAutotypeEnabled()`,
  `disableAutotype()` and `dispose()`. The private `setKeyboardShortcut()` method
  has no caller yet, so it is left for the ticket that wires it up.
*/
describe("MainDesktopAutotypeService", () => {
  const defaultKeyboardShortcut = DEFAULT_KEYBOARD_SHORTCUT.join("+");

  let mockLogService: MockProxy<LogService>;
  let mockWindowMain: MockProxy<WindowMain>;
  let mockIpcService: MockProxy<IpcService>;
  let service: MainDesktopAutotypeService;

  beforeEach(() => {
    jest.clearAllMocks();

    mockLogService = mock<LogService>();
    mockWindowMain = mock<WindowMain>();
    mockIpcService = mock<IpcService>();

    (globalShortcut.isRegistered as jest.Mock).mockReturnValue(false);
    (registerAutotypeHandlers as jest.Mock).mockResolvedValue(undefined);

    // Created manually since this service does not use Angular DI
    service = new MainDesktopAutotypeService(mockLogService, mockWindowMain, mockIpcService);
  });

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
    it("should register the Autotype IPC handlers with the IPC client", async () => {
      await service.init();

      expect(registerAutotypeHandlers).toHaveBeenCalledWith(
        mockIpcService.client,
        expect.anything(),
      );
    });

    it("should log and resolve when registering the handlers fails", async () => {
      const failure = new Error("IPC client not initialized");
      (registerAutotypeHandlers as jest.Mock).mockRejectedValue(failure);

      await expect(service.init()).resolves.toBeUndefined();

      expect(mockLogService.error).toHaveBeenCalledWith(
        "Failed to register the Autotype IPC handlers.",
        failure,
      );
    });
  });

  describe("Autotype driver", () => {
    let driver: AutotypeDriver;

    beforeEach(async () => {
      await service.init();
      driver = (registerAutotypeHandlers as jest.Mock).mock.calls[0][1];
    });

    describe("set_autotype_enabled", () => {
      it("should register the keyboard shortcut and report success when enabling", async () => {
        (globalShortcut.register as jest.Mock).mockReturnValue(true);

        const result = await driver.set_autotype_enabled(true);

        expect(result).toBe(true);
        expect(globalShortcut.register).toHaveBeenCalledWith(
          defaultKeyboardShortcut,
          expect.any(Function),
        );
        expect(mockLogService.debug).toHaveBeenCalledWith("Autotype enabled.");
      });

      it("should report failure when the keyboard shortcut cannot be registered", async () => {
        (globalShortcut.register as jest.Mock).mockReturnValue(false);

        const result = await driver.set_autotype_enabled(true);

        expect(result).toBe(false);
        expect(mockLogService.error).toHaveBeenCalledWith("Failed to enable Autotype.");
      });

      it("should report success without re-registering when already enabled", async () => {
        (globalShortcut.isRegistered as jest.Mock).mockReturnValue(true);

        const result = await driver.set_autotype_enabled(true);

        expect(result).toBe(true);
        expect(globalShortcut.register).not.toHaveBeenCalled();
      });

      it("should unregister the keyboard shortcut and report success when disabling", async () => {
        (globalShortcut.isRegistered as jest.Mock).mockReturnValue(true);

        const result = await driver.set_autotype_enabled(false);

        expect(result).toBe(true);
        expect(globalShortcut.unregister).toHaveBeenCalledWith(defaultKeyboardShortcut);
      });
    });

    describe("set_autotype_keyboard_shortcut", () => {
      it("should report failure without changing the keyboard shortcut", async () => {
        const result = await driver.set_autotype_keyboard_shortcut(["Control", "Alt", "Q"]);

        expect(result).toBe(false);
        expect(globalShortcut.register).not.toHaveBeenCalled();
        expect(globalShortcut.unregister).not.toHaveBeenCalled();
        expect(service["autotypeKeyboardShortcut"].getArrayFormat()).toEqual(
          DEFAULT_KEYBOARD_SHORTCUT,
        );
      });
    });

    describe("list_running_apps", () => {
      it("should report no running apps", async () => {
        await expect(driver.list_running_apps()).resolves.toEqual([]);
      });
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
