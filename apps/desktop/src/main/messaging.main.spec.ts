import * as fs from "fs";

import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { autostart } from "@bitwarden/desktop-napi";

import { Main } from "../main";
import { DesktopSettingsService } from "../platform/services/desktop-settings.service";

import { AUTOSTART_FLAG, MessagingMain } from "./messaging.main";

const ELECTRON_EXE = "/opt/Bitwarden/bitwarden-app";
const LAUNCHER = "/opt/Bitwarden/bitwarden";

jest.mock("electron", () => ({
  app: {
    getPath: jest.fn(() => ELECTRON_EXE),
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
    jest.restoreAllMocks();
    jest.clearAllMocks();
    Object.defineProperty(process, "platform", { value: originalPlatform });
  });

  describe("linux autostart", () => {
    it("points at the launcher script when it is installed", async () => {
      jest.spyOn(fs, "existsSync").mockImplementation((p) => p === LAUNCHER);

      await sut.init();

      expect(autostart.setAutostart).toHaveBeenCalledWith(true, {
        execPath: LAUNCHER,
        autostartFlag: AUTOSTART_FLAG,
      });
    });

    it("falls back to the electron binary when no launcher exists", async () => {
      jest.spyOn(fs, "existsSync").mockReturnValue(false);

      await sut.init();

      expect(autostart.setAutostart).toHaveBeenCalledWith(true, {
        execPath: ELECTRON_EXE,
        autostartFlag: AUTOSTART_FLAG,
      });
    });
  });
});
