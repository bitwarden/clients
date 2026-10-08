import * as fs from "fs";
import { pathToFileURL } from "node:url";
import * as path from "path";

import { app, session } from "electron";
import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { AbstractStorageService } from "@bitwarden/common/platform/abstractions/storage.service";
import { BiometricStateService } from "@bitwarden/key-management";

import { SafeShell } from "../platform/main/safe-shell.main";
import { DesktopSettingsService } from "../platform/services/desktop-settings.service";

// window.main.ts registers a privileged scheme at module load time, which
// requires the electron runtime. Mock the surface the module touches on
// import so it can be loaded in Jest.
jest.mock("electron", () => ({
  app: {
    on: jest.fn(),
    whenReady: jest.fn(() => new Promise<void>(() => {})),
    requestSingleInstanceLock: jest.fn(() => true),
  },
  BrowserWindow: jest.fn(),
  ipcMain: { on: jest.fn() },
  nativeTheme: {},
  screen: {},
  session: { fromPartition: jest.fn() },
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

jest.mock("../utils", () => ({ ...jest.requireActual("../utils"), isDev: () => true }));

import { isSnapStore } from "./platform-utils.main";
import { isConfinedSnap, WindowMain } from "./window.main";

describe("WindowMain", () => {
  it("initializes the managed session and window when Electron is already ready", async () => {
    jest.mocked(app.whenReady).mockResolvedValueOnce(undefined);
    const managedSession = { protocol: { handle: jest.fn() } };
    jest
      .mocked(session.fromPartition)
      .mockReturnValueOnce(managedSession as unknown as Electron.Session);
    const settings = mock<DesktopSettingsService>();
    settings.modalMode$ = of({ isModalModeActive: false });
    settings.preventScreenshots$ = of(false);
    const startupOrder: string[] = [];
    const sut = new WindowMain(
      mock<BiometricStateService>(),
      mock<LogService>(),
      mock<AbstractStorageService>(),
      settings,
      mock<SafeShell>(),
      null,
      () => {},
      null,
      async () => {
        expect(sut.session).toBe(managedSession);
        startupOrder.push("reconcile");
      },
    );
    const createWindow = jest.spyOn(sut, "createWindow").mockImplementation(async () => {
      expect(sut.session).toBe(managedSession);
      startupOrder.push("window");
    });
    await sut.init();
    expect(session.fromPartition).toHaveBeenCalledWith("persist:bitwarden", { cache: false });
    expect(createWindow).toHaveBeenCalledWith("full-app", true);
    expect(startupOrder).toEqual(["reconcile", "window"]);
  });

  it("rejects initialization if readiness fails instead of hanging bootstrap", async () => {
    const error = new Error("readiness failed");
    jest.mocked(app.whenReady).mockRejectedValueOnce(error);
    const settings = mock<DesktopSettingsService>();
    settings.modalMode$ = of({ isModalModeActive: false });
    settings.preventScreenshots$ = of(false);
    const sut = new WindowMain(
      mock<BiometricStateService>(),
      mock<LogService>(),
      mock<AbstractStorageService>(),
      settings,
      mock<SafeShell>(),
      null,
      () => {},
      null,
    );
    await expect(sut.init()).rejects.toBe(error);
  });
  it("owns only its live local renderer ID and the session attached to that window", () => {
    const sut = new WindowMain(
      mock<BiometricStateService>(),
      mock<LogService>(),
      mock<AbstractStorageService>(),
      mock<DesktopSettingsService>(),
      mock<SafeShell>(),
      null,
      () => {},
      null,
    );
    const actualSession = {};
    const mainContents = {
      id: 7,
      session: actualSession,
      isDestroyed: () => false,
      getURL: () => pathToFileURL(path.join(__dirname, "/index.html")).toString(),
    };
    sut.win = { webContents: mainContents } as unknown as Electron.BrowserWindow;
    sut.session = {} as Electron.Session;
    const request = { ...mainContents } as unknown as Electron.WebContents;
    expect(sut.ownsMtlsContents(request)).toBe(true);
    expect(sut.ownsMtlsContents({ ...request, id: 8 } as Electron.WebContents)).toBe(false);
    expect(sut.ownsMtlsContents({ ...request, session: {} } as Electron.WebContents)).toBe(false);
    expect(
      sut.ownsMtlsContents({
        ...request,
        getURL: () => "https://evil.example",
      } as Electron.WebContents),
    ).toBe(false);
    mainContents.isDestroyed = () => true;
    expect(sut.ownsMtlsContents(request)).toBe(false);
    mainContents.isDestroyed = () => false;
    sut.win = null;
    expect(sut.ownsMtlsContents(request)).toBe(false);
  });
  it("marks shutdown before Electron closes windows, without waiting for biometric reset", async () => {
    jest.mocked(app.on).mockClear();
    const biometrics = mock<BiometricStateService>();
    let finishReset: () => void;
    biometrics.resetAllPromptCancelled.mockReturnValue(
      new Promise<void>((resolve) => (finishReset = resolve)),
    );
    const settings = mock<DesktopSettingsService>();
    settings.modalMode$ = of({ isModalModeActive: false });
    settings.preventScreenshots$ = of(false);
    const sut = new WindowMain(
      biometrics,
      mock<LogService>(),
      mock<AbstractStorageService>(),
      settings,
      mock<SafeShell>(),
      null,
      () => {},
      null,
    );
    void sut.init();
    const beforeQuit = jest
      .mocked(app.on)
      .mock.calls.find(([event]) => event === "before-quit")[1] as () => Promise<void>;
    const reset = beforeQuit();
    expect(sut.isQuitting).toBe(true);
    finishReset();
    await reset;
  });

  it("accepts mTLS IPC only from the main frame of its local application window", () => {
    const sut = new WindowMain(
      mock<BiometricStateService>(),
      mock<LogService>(),
      mock<AbstractStorageService>(),
      mock<DesktopSettingsService>(),
      mock<SafeShell>(),
      null,
      () => {},
      null,
    );
    const frame = { url: pathToFileURL(path.join(__dirname, "/index.html")).toString() };
    const webContents = { mainFrame: frame };
    sut.win = { webContents } as Electron.BrowserWindow;

    expect(
      sut.isTrustedIpcSender({
        sender: webContents,
        senderFrame: frame,
      } as Electron.IpcMainInvokeEvent),
    ).toBe(true);
    expect(
      sut.isTrustedIpcSender({
        sender: webContents,
        senderFrame: { url: "https://evil.example" },
      } as Electron.IpcMainInvokeEvent),
    ).toBe(false);
    expect(
      sut.isTrustedIpcSender({ sender: {}, senderFrame: frame } as Electron.IpcMainInvokeEvent),
    ).toBe(false);
  });

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
});

describe("isConfinedSnap", () => {
  const originalPlatform = process.platform;
  const originalExecPath = process.execPath;
  const originalSnap = process.env.SNAP;
  const originalSnapName = process.env.SNAP_NAME;

  const setPlatform = (platform: NodeJS.Platform) => {
    Object.defineProperty(process, "platform", { value: platform, configurable: true });
  };

  const setExecPath = (execPath: string) => {
    Object.defineProperty(process, "execPath", { value: execPath, configurable: true });
  };

  // Spied rather than module-mocked: this spec's import graph reaches the SDK, which reads its
  // WASM binary through fs at import time, so `jest.mock("fs")` breaks the whole suite.
  let readFileSync: jest.SpyInstance;

  const setCgroup = (contents: string) => {
    readFileSync.mockReturnValue(contents);
  };

  const setCgroupUnreadable = () => {
    readFileSync.mockImplementation(() => {
      throw new Error("ENOENT: no such file or directory, open '/proc/self/cgroup'");
    });
  };

  // A confined snap's cgroup path contains snap.<snap-name>.<app-name>
  const confinedCgroup = (snapName: string) =>
    `0::/user.slice/user-1000.slice/user@1000.service/app.slice/snap.${snapName}.${snapName}.f0e1d2c3.scope\n`;

  beforeEach(() => {
    readFileSync = jest.spyOn(fs, "readFileSync");
    setPlatform("linux");
    // Only the stable snap path is a valid default; each test sets what it needs.
    setExecPath("/snap/bitwarden/x1/opt/Bitwarden/bitwarden");
    setCgroup(confinedCgroup("bitwarden"));
  });

  afterEach(() => {
    jest.restoreAllMocks();
    Object.defineProperty(process, "platform", { value: originalPlatform, configurable: true });
    Object.defineProperty(process, "execPath", { value: originalExecPath, configurable: true });
    if (originalSnap === undefined) {
      delete process.env.SNAP;
    } else {
      process.env.SNAP = originalSnap;
    }
    if (originalSnapName === undefined) {
      delete process.env.SNAP_NAME;
    } else {
      process.env.SNAP_NAME = originalSnapName;
    }
  });

  it("returns true for the stable snap", () => {
    setExecPath("/snap/bitwarden/x1/opt/Bitwarden/bitwarden");
    setCgroup(confinedCgroup("bitwarden"));
    expect(isConfinedSnap()).toBe(true);
  });

  it("returns true for the beta snap", () => {
    setExecPath("/snap/bitwarden-beta/x1/opt/Bitwarden Beta/bitwarden");
    setCgroup(confinedCgroup("bitwarden-beta"));
    expect(isConfinedSnap()).toBe(true);
  });

  // Fedora, Arch and openSUSE mount snaps at /var/lib/snapd/snap; execPath is canonicalized, so
  // it carries that root rather than the /snap compatibility symlink.
  it("returns true on distros that mount snaps outside /snap", () => {
    setExecPath("/var/lib/snapd/snap/bitwarden/x1/opt/Bitwarden/bitwarden");
    setCgroup(confinedCgroup("bitwarden"));
    expect(isConfinedSnap()).toBe(true);
  });

  it("returns false when execPath is outside a snap mount", () => {
    setExecPath("/opt/Bitwarden/bitwarden");
    expect(isConfinedSnap()).toBe(false);
  });

  // snapd's per-user data dir is user-writable, so a copy planted there must not pass as confined.
  it("returns false for a snap-lookalike path under the user's home", () => {
    setExecPath("/home/user/snap/bitwarden/current/opt/Bitwarden/bitwarden");
    setCgroup(confinedCgroup("bitwarden"));
    expect(isConfinedSnap()).toBe(false);
  });

  it("returns false when execPath belongs to another snap", () => {
    setExecPath("/snap/some-terminal/x1/usr/bin/some-terminal");
    setCgroup(confinedCgroup("some-terminal"));
    expect(isConfinedSnap()).toBe(false);
  });

  it("does not read the cgroup when execPath already rules out a snap", () => {
    setExecPath("/opt/Bitwarden/bitwarden");
    isConfinedSnap();
    expect(readFileSync).not.toHaveBeenCalled();
  });

  it("returns false when the cgroup does not name a bitwarden snap", () => {
    setCgroup("0::/user.slice/user-1000.slice/session-2.scope\n");
    expect(isConfinedSnap()).toBe(false);
  });

  it("returns false when the cgroup cannot be read", () => {
    setCgroupUnreadable();
    expect(isConfinedSnap()).toBe(false);
  });

  it("returns false on non-Linux platforms", () => {
    setPlatform("darwin");
    expect(isConfinedSnap()).toBe(false);
  });

  it("is not fooled by snap env vars alone, unlike isSnapStore", () => {
    setExecPath("/opt/Bitwarden/bitwarden");
    process.env.SNAP = "/snap/bitwarden/x1";
    process.env.SNAP_NAME = "bitwarden";

    expect(isConfinedSnap()).toBe(false);
    expect(isSnapStore()).toBe(true);
  });
});
