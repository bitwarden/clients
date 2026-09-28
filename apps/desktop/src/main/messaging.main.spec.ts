import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { autostart } from "@bitwarden/desktop-napi";

import { Main } from "../main";
import { DesktopSettingsService } from "../platform/services/desktop-settings.service";

import { MessagingMain } from "./messaging.main";

jest.mock("electron", () => ({
  app: {
    getPath: jest.fn(() => "/tmp/.mount_Bitwar/bitwarden-app"),
    setLoginItemSettings: jest.fn(),
  },
  ipcMain: {
    on: jest.fn(),
  },
}));

jest.mock("@bitwarden/desktop-napi", () => ({
  autostart: {
    setAutostart: jest.fn(() => Promise.resolve()),
  },
}));

describe("MessagingMain", () => {
  const originalPlatform = process.platform;
  let sut: MessagingMain;

  beforeEach(() => {
    jest.useFakeTimers();
    Object.defineProperty(process, "platform", { value: "linux" });

    const desktopSettingsService = mock<DesktopSettingsService>();
    desktopSettingsService.openAtLogin$ = of(true);
    sut = new MessagingMain(mock<Main>(), desktopSettingsService);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
    Object.defineProperty(process, "platform", { value: originalPlatform });
    delete process.env.APPIMAGE;
  });

  // The AppImage runs from a temporary mount, so an autostart entry would point at a path that
  // no longer exists after reboot.
  it("removes the autostart entry on AppImage even when enabled", async () => {
    process.env.APPIMAGE = "/home/user/Bitwarden.AppImage";

    await sut.init();

    expect(autostart.setAutostart).toHaveBeenCalledWith(false, expect.anything());
  });
});
