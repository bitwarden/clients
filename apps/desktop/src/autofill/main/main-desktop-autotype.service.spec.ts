import { globalShortcut } from "electron";
import { mock, MockProxy } from "jest-mock-extended";

import { LogService } from "@bitwarden/logging";

import { WindowMain } from "../../main/window.main";
import { DEFAULT_KEYBOARD_SHORTCUT } from "../models/main-autotype-keyboard-shortcut";

import { MainDesktopAutotypeService } from "./main-desktop-autotype.service";

/*
  Only the `globalShortcut` surface the reachable code paths touch is mocked.
  This service registers no IPC listeners, so `ipcMain` is not needed.
*/
jest.mock("electron", () => ({
  globalShortcut: {
    unregister: jest.fn(),
    isRegistered: jest.fn(),
  },
}));

/*
  This suite intentionally only covers the code that is reachable today:
  the constructor, `disableAutotype()` and `dispose()`. The private
  `enableAutotype()` and `setKeyboardShortcut()` methods have no caller yet
  (no IPC listeners are registered by this service), so they are left for the
  tickets that wire them up.
*/
describe("MainDesktopAutotypeService", () => {
  const defaultKeyboardShortcut = DEFAULT_KEYBOARD_SHORTCUT.join("+");

  let mockLogService: MockProxy<LogService>;
  let mockWindowMain: MockProxy<WindowMain>;
  let service: MainDesktopAutotypeService;

  beforeEach(() => {
    jest.clearAllMocks();

    mockLogService = mock<LogService>();
    mockWindowMain = mock<WindowMain>();

    (globalShortcut.isRegistered as jest.Mock).mockReturnValue(false);

    // Created manually since this service does not use Angular DI
    service = new MainDesktopAutotypeService(mockLogService, mockWindowMain);
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
