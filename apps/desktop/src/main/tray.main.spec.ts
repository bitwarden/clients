import { EventEmitter } from "node:events";

import { BrowserWindow } from "electron";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { BiometricsService } from "@bitwarden/key-management";

import { DesktopSettingsService } from "../platform/services/desktop-settings.service";

jest.mock("electron", () => ({
  app: { dock: { hide: jest.fn(), show: jest.fn() } },
  Menu: { buildFromTemplate: jest.fn() },
  nativeImage: {
    createFromPath: jest.fn(() => ({ setTemplateImage: jest.fn() })),
  },
  Tray: jest.fn(() => ({
    on: jest.fn(),
    setToolTip: jest.fn(),
    setPressedImage: jest.fn(),
    setContextMenu: jest.fn(),
    destroy: jest.fn(),
  })),
}));

jest.mock("./window.main", () => ({ WindowMain: jest.fn() }));
jest.mock("./renderer-teardown.main", () => ({ RendererTeardownMain: jest.fn() }));

import { RendererTeardownMain } from "./renderer-teardown.main";
import { TrayMain } from "./tray.main";
import { WindowMain } from "./window.main";

describe("TrayMain", () => {
  describe("window close", () => {
    let runInBackground$: BehaviorSubject<boolean>;
    let windowMain: WindowMain;
    let win: EventEmitter & { hide: jest.Mock };
    let rendererTeardown: MockProxy<RendererTeardownMain>;

    const emitClose = () => {
      const event = { preventDefault: jest.fn() };
      win.emit("close", event);
      return event;
    };

    beforeEach(async () => {
      globalThis.BIT_ENVIRONMENT = "production";
      runInBackground$ = new BehaviorSubject(false);
      win = Object.assign(new EventEmitter(), { hide: jest.fn() });
      windowMain = { isQuitting: false, rendererDestroyed: false, win } as unknown as WindowMain;
      rendererTeardown = mock<RendererTeardownMain>();
      rendererTeardown.tryTearDown.mockReturnValue(false);

      const desktopSettingsService = mock<DesktopSettingsService>();
      desktopSettingsService.runInBackground$ = runInBackground$;

      const sut = new TrayMain(
        windowMain,
        mock<I18nService>(),
        desktopSettingsService,
        mock<MessagingService>(),
        mock<BiometricsService>(),
        rendererTeardown,
      );
      await sut.init("Bitwarden");
      sut.setupWindowListeners(win as unknown as BrowserWindow);
    });

    it("prevents the close synchronously and hides the window when running in the background", () => {
      runInBackground$.next(true);

      const event = emitClose();

      expect(event.preventDefault).toHaveBeenCalled();
      expect(win.hide).toHaveBeenCalled();
      expect(windowMain.isQuitting).toBe(false);
    });

    it("hides the window being closed when another window is the main window", () => {
      runInBackground$.next(true);
      const other = { hide: jest.fn() };
      windowMain.win = other as unknown as BrowserWindow;

      emitClose();

      expect(win.hide).toHaveBeenCalled();
      expect(other.hide).not.toHaveBeenCalled();
    });

    it("lets the close proceed and marks the app as quitting when not running in the background", () => {
      const event = emitClose();

      expect(event.preventDefault).not.toHaveBeenCalled();
      expect(windowMain.isQuitting).toBe(true);
    });

    it("lets the close proceed while the app is quitting", () => {
      runInBackground$.next(true);
      windowMain.isQuitting = true;

      const event = emitClose();

      expect(event.preventDefault).not.toHaveBeenCalled();
      expect(win.hide).not.toHaveBeenCalled();
    });

    it("destroys the renderer instead of hiding when teardown is allowed", () => {
      runInBackground$.next(true);
      rendererTeardown.tryTearDown.mockReturnValue(true);

      const event = emitClose();

      expect(event.preventDefault).toHaveBeenCalled();
      expect(rendererTeardown.tryTearDown).toHaveBeenCalled();
      expect(win.hide).not.toHaveBeenCalled();
    });

    it("does not tear down when the closing window is not the main window", () => {
      runInBackground$.next(true);
      rendererTeardown.tryTearDown.mockReturnValue(true);
      windowMain.win = { hide: jest.fn() } as unknown as BrowserWindow;

      emitClose();

      expect(rendererTeardown.tryTearDown).not.toHaveBeenCalled();
      expect(win.hide).toHaveBeenCalled();
    });

    it("lets the teardown close proceed", () => {
      runInBackground$.next(true);
      Object.assign(windowMain, { rendererDestroyed: true });

      const event = emitClose();

      expect(event.preventDefault).not.toHaveBeenCalled();
      expect(win.hide).not.toHaveBeenCalled();
    });
  });
});
