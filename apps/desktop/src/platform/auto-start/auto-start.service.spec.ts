import * as fs from "fs";
import * as path from "path";

import { app } from "electron";
import { mock, MockProxy } from "jest-mock-extended";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { autostart } from "@bitwarden/desktop-napi";

import * as utils from "../../utils";
import { DesktopSettingsService } from "../services/desktop-settings.service";

import { DefaultAutoStartService } from "./auto-start.service";
import { AutoStartStatus } from "./auto-start.service.abstraction";

// Mock modules
jest.mock("fs");
jest.mock("electron", () => ({
  app: {
    getVersion: jest.fn(),
    getPath: jest.fn(),
    setLoginItemSettings: jest.fn(),
    getLoginItemSettings: jest.fn(),
  },
}));
jest.mock("@bitwarden/desktop-napi", () => ({
  autostart: {
    setAutostart: jest.fn(),
  },
}));
jest.mock("../../utils", () => ({
  isFlatpak: jest.fn(),
  isSnapStore: jest.fn(),
  isWindowsStore: jest.fn(),
}));

describe("DefaultAutoStartService", () => {
  let service: DefaultAutoStartService;
  let logService: MockProxy<LogService>;
  let desktopSettingsService: MockProxy<DesktopSettingsService>;
  let originalPlatform: NodeJS.Platform;

  beforeEach(() => {
    logService = mock<LogService>();
    desktopSettingsService = mock<DesktopSettingsService>();
    service = new DefaultAutoStartService(logService, desktopSettingsService);
    originalPlatform = process.platform;
    jest.clearAllMocks();

    // Default mock implementations
    (app.getVersion as jest.Mock).mockReturnValue("1.0.0");
    (app.getPath as jest.Mock).mockImplementation((name: string) => {
      if (name === "exe") {
        return "/usr/bin/bitwarden";
      }
      if (name === "home") {
        return "/home/user";
      }
      return "";
    });
    (utils.isFlatpak as jest.Mock).mockReturnValue(false);
    (utils.isSnapStore as jest.Mock).mockReturnValue(false);
    (utils.isWindowsStore as jest.Mock).mockReturnValue(false);
  });

  afterEach(() => {
    Object.defineProperty(process, "platform", {
      value: originalPlatform,
    });
  });

  describe("Linux (Flatpak)", () => {
    beforeEach(() => {
      Object.defineProperty(process, "platform", {
        value: "linux",
      });
      (utils.isFlatpak as jest.Mock).mockReturnValue(true);
      (utils.isSnapStore as jest.Mock).mockReturnValue(false);
    });

    it("should enable autostart using the portal", async () => {
      (autostart.setAutostart as jest.Mock).mockResolvedValue(undefined);

      await service.enable();

      expect(autostart.setAutostart).toHaveBeenCalledWith(true, []);
    });

    it("should disable autostart using the portal", async () => {
      (autostart.setAutostart as jest.Mock).mockResolvedValue(undefined);

      await service.disable();

      expect(autostart.setAutostart).toHaveBeenCalledWith(false, []);
    });

    it("should handle portal errors gracefully when enabling", async () => {
      const error = new Error("Portal error");
      (autostart.setAutostart as jest.Mock).mockRejectedValue(error);

      await service.enable();

      expect(logService.error).toHaveBeenCalledWith(
        "Failed to enable autostart via portal:",
        error,
      );
    });

    it("should handle portal errors gracefully when disabling", async () => {
      const error = new Error("Portal error");
      (autostart.setAutostart as jest.Mock).mockRejectedValue(error);

      await service.disable();

      expect(logService.error).toHaveBeenCalledWith(
        "Failed to disable autostart via portal:",
        error,
      );
    });

    it("should return Unknown for isEnabled (cannot query portal state)", async () => {
      const result = await service.isEnabled();

      expect(result).toBe(AutoStartStatus.Unknown);
    });
  });

  describe("Linux (Snap)", () => {
    beforeEach(() => {
      Object.defineProperty(process, "platform", {
        value: "linux",
      });
      (utils.isFlatpak as jest.Mock).mockReturnValue(false);
      (utils.isSnapStore as jest.Mock).mockReturnValue(true);
    });

    it("should not create desktop file when enabling (snap manages autostart)", async () => {
      await service.enable();

      expect(fs.writeFileSync).not.toHaveBeenCalled();
      expect(fs.mkdirSync).not.toHaveBeenCalled();
    });

    it("should not remove desktop file when disabling (snap manages autostart)", async () => {
      await service.disable();

      expect(fs.unlinkSync).not.toHaveBeenCalled();
    });

    it("should return Unknown for isEnabled (snap state cannot be queried)", async () => {
      const result = await service.isEnabled();

      expect(result).toBe(AutoStartStatus.Unknown);
    });
  });

  describe("Linux (Standard)", () => {
    beforeEach(() => {
      Object.defineProperty(process, "platform", {
        value: "linux",
      });
      (utils.isFlatpak as jest.Mock).mockReturnValue(false);
      (utils.isSnapStore as jest.Mock).mockReturnValue(false);
    });

    it("should create desktop file when enabling", async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);

      await service.enable();

      const expectedPath = path.join("/home/user", ".config", "autostart", "bitwarden.desktop");
      const expectedContent = `[Desktop Entry]
Type=Application
Version=1.0.0
Name=Bitwarden
Comment=Bitwarden startup script
Exec=/usr/bin/bitwarden
StartupNotify=false
Terminal=false`;

      expect(fs.writeFileSync).toHaveBeenCalledWith(expectedPath, expectedContent);
    });

    it("should create autostart directory if it does not exist", async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      await service.enable();

      const expectedDir = path.join("/home/user", ".config", "autostart");
      expect(fs.mkdirSync).toHaveBeenCalledWith(expectedDir, { recursive: true });
    });

    it("should remove desktop file when disabling", async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);

      await service.disable();

      const expectedPath = path.join("/home/user", ".config", "autostart", "bitwarden.desktop");
      expect(fs.unlinkSync).toHaveBeenCalledWith(expectedPath);
    });

    it("should not throw error when removing non-existent desktop file", async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      await expect(service.disable()).resolves.not.toThrow();

      expect(fs.unlinkSync).not.toHaveBeenCalled();
    });

    it("should return Enabled when desktop file exists", async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);

      const result = await service.isEnabled();

      expect(result).toBe(AutoStartStatus.Enabled);
      const expectedPath = path.join("/home/user", ".config", "autostart", "bitwarden.desktop");
      expect(fs.existsSync).toHaveBeenCalledWith(expectedPath);
    });

    it("should return Disabled when desktop file does not exist", async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      const result = await service.isEnabled();

      expect(result).toBe(AutoStartStatus.Disabled);
    });
  });

  describe("macOS", () => {
    beforeEach(() => {
      Object.defineProperty(process, "platform", {
        value: "darwin",
      });
    });

    it("should enable autostart using Electron API", async () => {
      await service.enable();

      expect(app.setLoginItemSettings).toHaveBeenCalledWith({ openAtLogin: true });
    });

    it("should disable autostart using Electron API", async () => {
      await service.disable();

      expect(app.setLoginItemSettings).toHaveBeenCalledWith({ openAtLogin: false });
    });

    it("should return Enabled when openAtLogin is enabled", async () => {
      (app.getLoginItemSettings as jest.Mock).mockReturnValue({
        openAtLogin: true,
        openAsHidden: false,
      });

      const result = await service.isEnabled();

      expect(result).toBe(AutoStartStatus.Enabled);
    });

    it("should return Disabled when openAtLogin is disabled", async () => {
      (app.getLoginItemSettings as jest.Mock).mockReturnValue({
        openAtLogin: false,
        openAsHidden: false,
      });

      const result = await service.isEnabled();

      expect(result).toBe(AutoStartStatus.Disabled);
    });
  });

  describe("Windows", () => {
    beforeEach(() => {
      Object.defineProperty(process, "platform", {
        value: "win32",
      });
      (utils.isFlatpak as jest.Mock).mockReturnValue(false);
      (utils.isSnapStore as jest.Mock).mockReturnValue(false);
    });

    it("should enable autostart using Electron API", async () => {
      await service.enable();

      expect(app.setLoginItemSettings).toHaveBeenCalledWith({ openAtLogin: true });
    });

    it("should disable autostart using Electron API", async () => {
      await service.disable();

      expect(app.setLoginItemSettings).toHaveBeenCalledWith({ openAtLogin: false });
    });

    it("should return Enabled when openAtLogin is enabled", async () => {
      (app.getLoginItemSettings as jest.Mock).mockReturnValue({
        openAtLogin: true,
        openAsHidden: false,
      });

      const result = await service.isEnabled();

      expect(result).toBe(AutoStartStatus.Enabled);
    });

    it("should return Disabled when openAtLogin is disabled", async () => {
      (app.getLoginItemSettings as jest.Mock).mockReturnValue({
        openAtLogin: false,
        openAsHidden: false,
      });

      const result = await service.isEnabled();

      expect(result).toBe(AutoStartStatus.Disabled);
    });
  });
});
