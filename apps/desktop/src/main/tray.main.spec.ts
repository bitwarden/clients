import { EventEmitter } from "events";

import { BrowserWindow } from "electron";
import { mock } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { BiometricsService } from "@bitwarden/key-management";

import { DesktopSettingsService } from "../platform/services/desktop-settings.service";

import { TrayMain } from "./tray.main";
import { WindowMain } from "./window.main";

jest.mock("electron", () => ({
  app: { dock: { hide: jest.fn(), show: jest.fn() } },
  Menu: { buildFromTemplate: jest.fn() },
  nativeImage: {
    createFromPath: jest.fn(() => ({ setTemplateImage: jest.fn() })),
  },
  Tray: jest.fn(() => ({
    setToolTip: jest.fn(),
    on: jest.fn(),
    setPressedImage: jest.fn(),
    setContextMenu: jest.fn(),
    destroy: jest.fn(),
  })),
}));

jest.mock("../utils", () => ({ isDev: () => false }));

jest.mock("./window.main", () => ({ WindowMain: jest.fn() }));

describe("TrayMain", () => {
  let windowMain: WindowMain;
  let win: EventEmitter & { hide: jest.Mock };
  let runInBackground$: BehaviorSubject<boolean>;
  let sut: TrayMain;

  // Emits "close" the way Electron does for a JS-initiated close (e.g. the "close" menu role):
  // the default-prevented flag is read synchronously once the listeners return.
  const emitClose = () => {
    const event = { defaultPrevented: false, preventDefault: jest.fn() };
    event.preventDefault.mockImplementation(() => (event.defaultPrevented = true));
    win.emit("close", event);
    return event.defaultPrevented;
  };

  beforeEach(async () => {
    win = Object.assign(new EventEmitter(), { hide: jest.fn() });
    windowMain = { isQuitting: false, win } as unknown as WindowMain;
    runInBackground$ = new BehaviorSubject(true);
    const desktopSettingsService = mock<DesktopSettingsService>();
    (desktopSettingsService as any).runInBackground$ = runInBackground$;

    sut = new TrayMain(
      windowMain,
      mock<I18nService>(),
      desktopSettingsService,
      mock<MessagingService>(),
      mock<BiometricsService>(),
    );
    await sut.init("Bitwarden");
    sut.setupWindowListeners(win as unknown as BrowserWindow);
  });

  it("prevents the window close synchronously and hides to tray when running in the background", () => {
    expect(emitClose()).toBe(true);
    expect(win.hide).toHaveBeenCalled();
    expect(windowMain.isQuitting).toBe(false);
  });

  it("lets the window close and quits when not running in the background", () => {
    runInBackground$.next(false);

    expect(emitClose()).toBe(false);
    expect(win.hide).not.toHaveBeenCalled();
    expect(windowMain.isQuitting).toBe(true);
  });

  it("lets the window close while quitting", () => {
    windowMain.isQuitting = true;

    expect(emitClose()).toBe(false);
    expect(win.hide).not.toHaveBeenCalled();
  });
});
