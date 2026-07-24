import { pathToFileURL } from "node:url";
import * as path from "path";

import { mock } from "jest-mock-extended";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { AbstractStorageService } from "@bitwarden/common/platform/abstractions/storage.service";
import { BiometricStateService } from "@bitwarden/key-management";

import { SafeShell } from "../platform/main/safe-shell.main";
import { DesktopSettingsService } from "../platform/services/desktop-settings.service";
import { isMac, isMacAppStore } from "../utils";

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

// Platform helpers are simple functions over process.platform; mock them so tests can
// exercise the platform-specific branches deterministically.
jest.mock("../utils", () => ({
  ...jest.requireActual("../utils"),
  isMac: jest.fn(),
  isMacAppStore: jest.fn(),
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

  describe("shouldQuitOnAllWindowsClosed", () => {
    let sut: WindowMain;
    let shouldQuitOnAllWindowsClosed: () => boolean;

    const setRunInBackground = (value: boolean) => ((sut as any).runInBackground = value);

    beforeEach(() => {
      jest.mocked(isMac).mockReturnValue(false);
      jest.mocked(isMacAppStore).mockReturnValue(false);

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

      shouldQuitOnAllWindowsClosed = () => (sut as any).shouldQuitOnAllWindowsClosed();
    });

    it("quits when explicitly quitting, regardless of platform or background setting", () => {
      jest.mocked(isMac).mockReturnValue(true);
      sut.isQuitting = true;
      setRunInBackground(true);

      expect(shouldQuitOnAllWindowsClosed()).toBe(true);
    });

    it("quits on the Mac App Store even when running in the background", () => {
      jest.mocked(isMac).mockReturnValue(true);
      jest.mocked(isMacAppStore).mockReturnValue(true);
      setRunInBackground(true);

      expect(shouldQuitOnAllWindowsClosed()).toBe(true);
    });

    it("stays resident when running in the background on Windows/Linux", () => {
      jest.mocked(isMac).mockReturnValue(false);
      setRunInBackground(true);

      expect(shouldQuitOnAllWindowsClosed()).toBe(false);
    });

    it("stays resident when running in the background on macOS", () => {
      jest.mocked(isMac).mockReturnValue(true);
      setRunInBackground(true);

      expect(shouldQuitOnAllWindowsClosed()).toBe(false);
    });

    it("quits on Windows/Linux when not running in the background", () => {
      jest.mocked(isMac).mockReturnValue(false);
      setRunInBackground(false);

      expect(shouldQuitOnAllWindowsClosed()).toBe(true);
    });

    it("stays resident on macOS when not running in the background", () => {
      jest.mocked(isMac).mockReturnValue(true);
      setRunInBackground(false);

      expect(shouldQuitOnAllWindowsClosed()).toBe(false);
    });
  });
});
