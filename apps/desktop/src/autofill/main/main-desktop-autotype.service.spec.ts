import { globalShortcut } from "electron";
import { mock, MockProxy } from "jest-mock-extended";

import { IpcService } from "@bitwarden/common/platform/ipc";
import { LogService } from "@bitwarden/logging";
import { autotypeRegisterSetEnabledHandler, IpcClient } from "@bitwarden/sdk-internal";

import { WindowMain } from "../../main/window.main";
import { DEFAULT_KEYBOARD_SHORTCUT } from "../models/main-autotype-keyboard-shortcut";

import { AutotypeSetEnabledDriver } from "./autotype-set-enabled-driver";
import { MainDesktopAutotypeService } from "./main-desktop-autotype.service";

/*
  Only the `globalShortcut` surface the reachable code paths touch is mocked.
  This service registers no Electron IPC listeners, so `ipcMain` is not needed —
  the render process reaches it over the SDK's encrypted IPC channel instead.
*/
jest.mock("electron", () => ({
  globalShortcut: {
    register: jest.fn(),
    unregister: jest.fn(),
    isRegistered: jest.fn(),
  },
}));

jest.mock("@bitwarden/sdk-internal", () => ({
  ...jest.requireActual("@bitwarden/sdk-internal"),
  autotypeRegisterSetEnabledHandler: jest.fn(),
}));

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
    (globalShortcut.register as jest.Mock).mockReturnValue(true);

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
    it("should register a set-enabled handler backed by the service", async () => {
      await service.init();

      expect(autotypeRegisterSetEnabledHandler).toHaveBeenCalledWith(
        mockIpcService.client,
        expect.any(AutotypeSetEnabledDriver),
      );

      const [, driver] = (autotypeRegisterSetEnabledHandler as jest.Mock).mock.calls[0];
      await expect(driver.set_autotype_enabled(true)).resolves.toBe(true);
      expect(globalShortcut.register).toHaveBeenCalledWith(
        defaultKeyboardShortcut,
        expect.any(Function),
      );
    });

    it("should log and not throw when the IPC client is unavailable", async () => {
      // `IpcMainService.init()` swallows its own failures, so the getter throws.
      const failure = new Error("IpcService not initialized. Call init() first.");
      const brokenIpcService = {
        get client(): IpcClient {
          throw failure;
        },
      } as IpcService;
      service = new MainDesktopAutotypeService(mockLogService, mockWindowMain, brokenIpcService);

      await expect(service.init()).resolves.toBeUndefined();

      expect(autotypeRegisterSetEnabledHandler).not.toHaveBeenCalled();
      expect(mockLogService.error).toHaveBeenCalledWith(
        "Failed to register the Autotype set-enabled IPC handler.",
        failure,
      );
    });
  });

  describe("setAutotypeEnabled", () => {
    it("should register the keyboard shortcut and report success when enabling", () => {
      expect(service.setAutotypeEnabled(true)).toBe(true);

      expect(globalShortcut.register).toHaveBeenCalledWith(
        defaultKeyboardShortcut,
        expect.any(Function),
      );
      expect(mockLogService.debug).toHaveBeenCalledWith("Autotype enabled.");
    });

    it("should report failure when the keyboard shortcut cannot be registered", () => {
      (globalShortcut.register as jest.Mock).mockReturnValue(false);

      expect(service.setAutotypeEnabled(true)).toBe(false);

      expect(mockLogService.error).toHaveBeenCalledWith("Failed to enable Autotype.");
    });

    it("should report success without re-registering when already enabled", () => {
      (globalShortcut.isRegistered as jest.Mock).mockReturnValue(true);

      expect(service.setAutotypeEnabled(true)).toBe(true);

      expect(globalShortcut.register).not.toHaveBeenCalled();
    });

    it("should unregister the keyboard shortcut and report success when disabling", () => {
      (globalShortcut.isRegistered as jest.Mock).mockReturnValue(true);

      expect(service.setAutotypeEnabled(false)).toBe(true);

      expect(globalShortcut.unregister).toHaveBeenCalledWith(defaultKeyboardShortcut);
    });

    it("should report success when disabling an already disabled autotype", () => {
      expect(service.setAutotypeEnabled(false)).toBe(true);

      expect(globalShortcut.unregister).not.toHaveBeenCalled();
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
