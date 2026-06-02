import { globalShortcut } from "electron";
import { of } from "rxjs";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import { DesktopSettingsService } from "../platform/services/desktop-settings.service";

import { QuickAccessWindowMain } from "./quick-access-window.main";
import { DEFAULT_QUICK_ACCESS_SHORTCUT, QuickAccessMain } from "./quick-access.main";
import { WindowMain } from "./window.main";

jest.mock("electron", () => ({
  globalShortcut: {
    isRegistered: jest.fn(),
    register: jest.fn(),
    unregister: jest.fn(),
  },
}));

describe("QuickAccessMain", () => {
  let logService: jest.Mocked<LogService>;
  let windowMain: jest.Mocked<WindowMain>;
  let quickAccessWindow: jest.Mocked<QuickAccessWindowMain>;
  let desktopSettingsService: jest.Mocked<DesktopSettingsService>;
  let service: QuickAccessMain;

  beforeEach(() => {
    logService = {
      debug: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
      warning: jest.fn(),
    } as any;

    windowMain = {
      show: jest.fn(),
      win: {
        focus: jest.fn(),
        hide: jest.fn(),
        isDestroyed: jest.fn().mockReturnValue(false),
        isVisible: jest.fn().mockReturnValue(true),
        webContents: {
          send: jest.fn(),
        },
      },
    } as any;

    quickAccessWindow = {
      dispose: jest.fn(),
      hide: jest.fn(),
      send: jest.fn(),
      show: jest.fn(),
      toggle: jest.fn(),
    } as any;

    desktopSettingsService = {
      quickAccessEnabled$: of(true),
      quickAccessShortcut$: of(DEFAULT_QUICK_ACCESS_SHORTCUT),
    } as any;

    jest.clearAllMocks();
    (globalShortcut.isRegistered as jest.Mock).mockReturnValue(false);
    (globalShortcut.register as jest.Mock).mockReturnValue(true);

    service = new QuickAccessMain(
      logService,
      windowMain,
      quickAccessWindow,
      desktopSettingsService,
    );
  });

  it("registers the default global shortcut", async () => {
    await service.init();

    expect(globalShortcut.register).toHaveBeenCalledWith(
      DEFAULT_QUICK_ACCESS_SHORTCUT,
      expect.any(Function),
    );
    expect(logService.info).toHaveBeenCalledWith(
      `Quick Access enabled with shortcut: ${DEFAULT_QUICK_ACCESS_SHORTCUT}`,
    );
  });

  it("toggles the quick access window from the shortcut callback", async () => {
    await service.init();
    const callback = (globalShortcut.register as jest.Mock).mock.calls[0][1];

    callback();

    expect(quickAccessWindow.toggle).toHaveBeenCalled();
  });

  it("does not register the shortcut when Quick Access is disabled", async () => {
    desktopSettingsService.quickAccessEnabled$ = of(false);
    service = new QuickAccessMain(
      logService,
      windowMain,
      quickAccessWindow,
      desktopSettingsService,
    );

    await service.init();

    expect(globalShortcut.register).not.toHaveBeenCalled();
    expect(quickAccessWindow.hide).toHaveBeenCalled();
  });

  it("toggles quick access without showing the main window", async () => {
    await service.toggle();

    expect(quickAccessWindow.toggle).toHaveBeenCalled();
    expect(windowMain.show).not.toHaveBeenCalled();
    expect(windowMain.win.focus).not.toHaveBeenCalled();
  });

  it("keeps the main window hidden when toggling quick access from the background", async () => {
    windowMain.win.isVisible.mockReturnValueOnce(false).mockReturnValueOnce(true);

    await service.toggle();

    expect(quickAccessWindow.toggle).toHaveBeenCalled();
    expect(windowMain.win.hide).toHaveBeenCalled();
  });

  it("ignores toggle when Quick Access is disabled", async () => {
    desktopSettingsService.quickAccessEnabled$ = of(false);
    service = new QuickAccessMain(
      logService,
      windowMain,
      quickAccessWindow,
      desktopSettingsService,
    );
    await service.init();

    await service.toggle();

    expect(quickAccessWindow.toggle).not.toHaveBeenCalled();
  });

  it("does not register when the shortcut is already owned", async () => {
    (globalShortcut.isRegistered as jest.Mock).mockReturnValue(true);

    await service.init();

    expect(globalShortcut.register).not.toHaveBeenCalled();
    expect(logService.warning).toHaveBeenCalledWith(
      `Quick Access shortcut is already registered: ${DEFAULT_QUICK_ACCESS_SHORTCUT}`,
    );
  });

  it("re-registers when the shortcut changes", async () => {
    await service.init();
    (globalShortcut.isRegistered as jest.Mock).mockImplementation(
      (shortcut) => shortcut === DEFAULT_QUICK_ACCESS_SHORTCUT,
    );

    service.setShortcut("Control+Alt+Q");

    expect(globalShortcut.unregister).toHaveBeenCalledWith(DEFAULT_QUICK_ACCESS_SHORTCUT);
    expect(globalShortcut.register).toHaveBeenLastCalledWith("Control+Alt+Q", expect.any(Function));
  });

  it("does not re-register invalid shortcuts", async () => {
    await service.init();

    service.setShortcut("Shift+Q");

    expect(globalShortcut.register).toHaveBeenCalledTimes(1);
    expect(logService.warning).toHaveBeenCalledWith(
      "Invalid Quick Access shortcut ignored: Shift+Q",
    );
  });

  it("unregisters and hides when Quick Access is disabled", async () => {
    await service.init();
    (globalShortcut.isRegistered as jest.Mock).mockReturnValue(true);

    service.setEnabled(false);

    expect(globalShortcut.unregister).toHaveBeenCalledWith(DEFAULT_QUICK_ACCESS_SHORTCUT);
    expect(quickAccessWindow.hide).toHaveBeenCalled();
  });

  it("opens a cipher in the main window", () => {
    service.openCipher("cipher-id", "mail");

    expect(quickAccessWindow.hide).toHaveBeenCalled();
    expect(windowMain.show).toHaveBeenCalled();
    expect(windowMain.win.focus).toHaveBeenCalled();
    expect(windowMain.win.webContents.send).toHaveBeenCalledWith("messagingService", {
      command: "quickAccessOpenCipher",
      cipherId: "cipher-id",
      searchText: "mail",
    });
  });

  it("opens an app route in the main window", () => {
    service.openApp(["/lock"]);

    expect(quickAccessWindow.hide).toHaveBeenCalled();
    expect(windowMain.show).toHaveBeenCalled();
    expect(windowMain.win.webContents.send).toHaveBeenCalledWith("messagingService", {
      command: "quickAccessOpenApp",
      route: ["/lock"],
    });
  });

  it("sends messages to the quick access window", () => {
    service.send({ command: "quickAccessSearchResponse" });

    expect(quickAccessWindow.send).toHaveBeenCalledWith({ command: "quickAccessSearchResponse" });
  });

  it("can reset the window without unregistering the shortcut", () => {
    service.resetWindow();

    expect(quickAccessWindow.dispose).toHaveBeenCalled();
    expect(globalShortcut.unregister).not.toHaveBeenCalled();
  });

  it("unregisters the shortcut and disposes the window", async () => {
    await service.init();
    (globalShortcut.isRegistered as jest.Mock).mockReturnValue(true);

    service.dispose();

    expect(globalShortcut.unregister).toHaveBeenCalledWith(DEFAULT_QUICK_ACCESS_SHORTCUT);
    expect(quickAccessWindow.dispose).toHaveBeenCalled();
  });
});
