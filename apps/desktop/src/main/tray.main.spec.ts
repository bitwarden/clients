import { app } from "electron";
import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { BiometricsService } from "@bitwarden/key-management";

import { DesktopSettingsService } from "../platform/services/desktop-settings.service";

// tray.main.ts imports window.main.ts (for the WindowMain type), which registers a
// privileged scheme at module load time and pulls in native modules. Mock the surface both
// modules touch on import so they can be loaded in Jest.
jest.mock("electron", () => ({
  app: { dock: { hide: jest.fn(), show: jest.fn() } },
  BrowserWindow: jest.fn(),
  ipcMain: { on: jest.fn() },
  nativeTheme: {},
  screen: {},
  session: {},
  protocol: { registerSchemesAsPrivileged: jest.fn() },
  net: {},
  Menu: { buildFromTemplate: jest.fn() },
  nativeImage: { createFromPath: jest.fn(() => ({ setTemplateImage: jest.fn() })) },
  Tray: jest.fn(),
}));

jest.mock("@bitwarden/desktop-napi", () => ({
  processisolations: {
    isolateProcess: jest.fn(),
    isCoreDumpingDisabled: jest.fn(),
    disableCoredumps: jest.fn(),
  },
}));

import { TrayMain } from "./tray.main";
import { WindowMain } from "./window.main";

describe("TrayMain", () => {
  describe("setupWindowListeners close handler", () => {
    let windowMain: WindowMain;
    let desktopSettingsService: DesktopSettingsService;
    let sut: TrayMain;

    // The listeners registered on the fake window, keyed by event name.
    let listeners: Record<string, (...args: any[]) => any>;
    let win: { on: jest.Mock };

    const setup = (runInBackground: boolean) => {
      windowMain = mock<WindowMain>();
      windowMain.isQuitting = false;

      desktopSettingsService = mock<DesktopSettingsService>();
      (desktopSettingsService as any).runInBackground$ = of(runInBackground);

      sut = new TrayMain(
        windowMain,
        mock<I18nService>(),
        desktopSettingsService,
        mock<MessagingService>(),
        mock<BiometricsService>(),
      );

      // Avoid constructing a real Tray; we only care about the close-handling decision.
      jest.spyOn(sut, "showTray").mockImplementation(() => {});

      listeners = {};
      win = {
        on: jest.fn((event: string, cb: (...args: any[]) => any) => {
          listeners[event] = cb;
        }),
      };

      sut.setupWindowListeners(win as any);
    };

    afterEach(() => {
      jest.clearAllMocks();
    });

    it("does not prevent the close and keeps the tray shown when running in the background", async () => {
      setup(true);
      const event = { preventDefault: jest.fn() };

      await listeners["close"](event);

      expect(event.preventDefault).not.toHaveBeenCalled();
      expect(sut.showTray).toHaveBeenCalled();
      expect(app.dock.hide).not.toHaveBeenCalled();
      expect(windowMain.isQuitting).toBe(false);
    });

    it("marks the app as quitting when not running in the background", async () => {
      setup(false);
      const event = { preventDefault: jest.fn() };

      await listeners["close"](event);

      expect(event.preventDefault).not.toHaveBeenCalled();
      expect(windowMain.isQuitting).toBe(true);
    });

    it("returns early without touching the tray when already quitting", async () => {
      setup(true);
      windowMain.isQuitting = true;
      const event = { preventDefault: jest.fn() };

      await listeners["close"](event);

      expect(event.preventDefault).not.toHaveBeenCalled();
      expect(sut.showTray).not.toHaveBeenCalled();
    });
  });
});
