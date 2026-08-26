import { pathToFileURL } from "node:url";
import * as path from "path";

import { BrowserWindow } from "electron";
import { mock } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { AbstractStorageService } from "@bitwarden/common/platform/abstractions/storage.service";
import { BiometricStateService } from "@bitwarden/key-management";

import { SafeShell } from "../platform/main/safe-shell.main";
import { DesktopSettingsService } from "../platform/services/desktop-settings.service";

// window.main.ts registers a privileged scheme at module load time, which
// requires the electron runtime. Mock the surface the module touches on
// import so it can be loaded in Jest.
jest.mock("electron", () => ({
  app: {},
  BrowserWindow: jest.fn(),
  ipcMain: { on: jest.fn() },
  nativeTheme: {},
  screen: {},
  session: {},
  protocol: { registerSchemesAsPrivileged: jest.fn() },
  net: {},
}));

// window.main.ts imports processisolations, which loads a native .node
// module at import time.
jest.mock("@bitwarden/desktop-napi", () => ({
  processisolations: {
    isolateProcess: jest.fn(),
    isCoreDumpingDisabled: jest.fn(),
    disableCoredumps: jest.fn(),
  },
}));

import { WindowMain } from "./window.main";

describe("WindowMain", () => {
  describe("isLocalBundleUrl", () => {
    let sut: WindowMain;
    // Access the private method under test without widening its visibility
    // in production code.
    let isLocalBundleUrl: (url: string) => boolean;

    // The `file:` branch accepts only the app's own bundle, derived from
    // __dirname the same way the production code does. __dirname here is
    // this spec's directory, which is also the directory the code under test
    // resolves against, so this is the real bundle URL for the running test.
    const bundleUrl = pathToFileURL(path.join(__dirname, "/index.html")).toString();

    beforeEach(() => {
      sut = new WindowMain(
        mock<BiometricStateService>(),
        mock<LogService>(),
        mock<AbstractStorageService>(),
        mock<DesktopSettingsService>(),
        mock<SafeShell>(),
        null,
        () => {},
        null,
      );

      isLocalBundleUrl = (url: string) => (sut as any).isLocalBundleUrl(url);
    });

    it("returns true for the app's own file:// bundle URL", () => {
      expect(isLocalBundleUrl(bundleUrl)).toBe(true);
    });

    it("returns true for the app's own bundle URL with a hash", () => {
      expect(isLocalBundleUrl(`${bundleUrl}#/passkeys`)).toBe(true);
    });

    it("returns true for the app's own bundle URL with a query", () => {
      expect(isLocalBundleUrl(`${bundleUrl}?redirectUrl=/passkeys`)).toBe(true);
    });

    it("returns false for a file:// URL with a foreign host", () => {
      expect(isLocalBundleUrl("file://attacker.com/index.html")).toBe(false);
    });

    it("returns false for a file:// URL in a foreign directory", () => {
      expect(isLocalBundleUrl("file:///tmp/evil/index.html")).toBe(false);
    });

    it("returns false for a file:// URL that traverses outside the bundle dir", () => {
      // The `../` segments normalize (via the URL parser) to
      // /tmp/evil/index.html, outside the bundle.
      expect(isLocalBundleUrl(`${bundleUrl}/../../../tmp/evil/index.html`)).toBe(false);
    });

    it("returns true for a bw-desktop-file://bundle/index.html URL", () => {
      expect(isLocalBundleUrl("bw-desktop-file://bundle/index.html")).toBe(true);
    });

    it("returns false for an external https URL", () => {
      expect(isLocalBundleUrl("https://evil.com")).toBe(false);
    });

    it("returns false for a bw-desktop-file URL with the wrong host", () => {
      expect(isLocalBundleUrl("bw-desktop-file://evil/index.html")).toBe(false);
    });

    it("returns false for an unparseable string without throwing", () => {
      expect(isLocalBundleUrl("not a url")).toBe(false);
    });
  });

  describe("show", () => {
    let sut: WindowMain;

    beforeEach(() => {
      sut = new WindowMain(
        mock<BiometricStateService>(),
        mock<LogService>(),
        mock<AbstractStorageService>(),
        mock<DesktopSettingsService>(),
        mock<SafeShell>(),
        null,
        () => {},
        null,
      );
    });

    it("calls maximize() when the window is already visible and stored isMaximized is true", () => {
      // Arrange
      const mockWin = mock<BrowserWindow>();
      mockWin.isVisible.mockReturnValue(true);
      sut.win = mockWin;
      (sut as any).windowStates["mainWindowSize"] = { isMaximized: true };

      // Act
      sut.show();

      // Assert
      expect(mockWin.maximize).toHaveBeenCalledTimes(1);
    });

    it("does NOT call maximize() when stored isMaximized is false", () => {
      // Arrange
      const mockWin = mock<BrowserWindow>();
      mockWin.isVisible.mockReturnValue(false);
      sut.win = mockWin;
      (sut as any).windowStates["mainWindowSize"] = { isMaximized: false };

      // Act
      sut.show();

      // Assert
      expect(mockWin.maximize).not.toHaveBeenCalled();
    });

    it("calls maximize() when the window is minimized and stored isMaximized is true", () => {
      // Arrange — minimized window is not visible
      const mockWin = mock<BrowserWindow>();
      mockWin.isVisible.mockReturnValue(false);
      sut.win = mockWin;
      (sut as any).windowStates["mainWindowSize"] = { isMaximized: true };

      // Act
      sut.show();

      // Assert
      expect(mockWin.maximize).toHaveBeenCalledTimes(1);
    });
  });

  describe("updateWindowState", () => {
    let sut: WindowMain;
    let desktopSettingsService: ReturnType<typeof mock<DesktopSettingsService>>;

    beforeEach(() => {
      desktopSettingsService = mock<DesktopSettingsService>();
      // updateWindowState reads modalMode$ via firstValueFrom; provide a non-modal value.
      desktopSettingsService.modalMode$ = new BehaviorSubject({
        isModalModeActive: false,
        showTrafficButtons: false,
        modalPosition: undefined,
      });

      sut = new WindowMain(
        mock<BiometricStateService>(),
        mock<LogService>(),
        mock<AbstractStorageService>(),
        desktopSettingsService,
        mock<SafeShell>(),
        null,
        () => {},
        null,
      );
    });

    it("does NOT overwrite a stored isMaximized:true to false when the window is minimized", async () => {
      // Arrange
      const mockWin = mock<BrowserWindow>();
      mockWin.isDestroyed.mockReturnValue(false);
      mockWin.isMinimized.mockReturnValue(true);
      mockWin.isMaximized.mockReturnValue(false);
      mockWin.isFullScreen.mockReturnValue(false);
      mockWin.getBounds.mockReturnValue({ x: 0, y: 0, width: 800, height: 600 });

      // Pre-seed the stored state as maximized (set before the window was minimized)
      (sut as any).windowStates["mainWindowSize"] = { isMaximized: true };

      // Act
      await (sut as any).updateWindowState("mainWindowSize", mockWin);

      // Assert
      expect((sut as any).windowStates["mainWindowSize"].isMaximized).toBe(true);
    });
  });
});
