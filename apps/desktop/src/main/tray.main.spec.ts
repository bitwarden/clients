import { Tray } from "electron";
import { mock } from "jest-mock-extended";
import { Subject } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { BiometricsService } from "@bitwarden/key-management";

import { DesktopSettingsService } from "../platform/services/desktop-settings.service";

import { TrayMain } from "./tray.main";
import { WindowMain } from "./window.main";

jest.mock("electron", () => ({
  app: {},
  Tray: jest.fn(() => ({ setToolTip: jest.fn(), on: jest.fn() })),
  nativeImage: { createFromPath: jest.fn() },
}));

describe("TrayMain shutdown", () => {
  it("uses a valid tooltip even when a window closes before tray initialization", () => {
    const tray = new TrayMain(
      mock<WindowMain>(),
      mock<I18nService>(),
      mock<DesktopSettingsService>(),
      mock<MessagingService>(),
      mock<BiometricsService>(),
    );
    tray.showTray();
    expect(jest.mocked(Tray).mock.results.at(-1).value.setToolTip).toHaveBeenCalledWith(
      "Bitwarden",
    );
  });

  it("does not create or hide to the tray when quitting begins during the settings read", async () => {
    const windowMain = mock<WindowMain>();
    windowMain.isQuitting = false;
    const settings = mock<DesktopSettingsService>();
    const background = new Subject<boolean>();
    settings.runInBackground$ = background;
    const tray = new TrayMain(
      windowMain,
      mock<I18nService>(),
      settings,
      mock<MessagingService>(),
      mock<BiometricsService>(),
    );
    const showTray = jest.spyOn(tray, "showTray");
    const win = { on: jest.fn() };
    tray.setupWindowListeners(win as unknown as Electron.BrowserWindow);
    const close = win.on.mock.calls.find(([event]) => event === "close")[1];
    const event = { preventDefault: jest.fn() };
    const pending = close(event);
    windowMain.isQuitting = true;
    background.next(true);
    await pending;
    expect(showTray).not.toHaveBeenCalled();
    expect(event.preventDefault).not.toHaveBeenCalled();
  });
});
