import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import * as path from "path";

import { mock, MockProxy } from "jest-mock-extended";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { DesktopIpcPeerClientType } from "@bitwarden/common/platform/ipc";
import { ipc, windows_registry } from "@bitwarden/desktop-napi";

import { NativeMessagingMain } from "./native-messaging.main";
import { isWindowsStore } from "./platform-utils.main";
import { WindowMain } from "./window.main";

jest.mock("electron", () => ({
  ipcMain: { handle: jest.fn(), on: jest.fn() },
}));

// native-messaging.main.ts loads a native .node module at import time.
jest.mock("@bitwarden/desktop-napi", () => ({
  ipc: {
    NativeIpcServer: { listen: jest.fn() },
    IpcMessageType: { Connected: 0, Disconnected: 1, Message: 2 },
  },
  windows_registry: { createKey: jest.fn() },
}));

// Dev mode would scan browser profiles for extension ids.
jest.mock("../utils", () => ({ ...jest.requireActual("../utils"), isDev: () => false }));

jest.mock("./platform-utils.main", () => ({ isWindowsStore: jest.fn() }));

describe("NativeMessagingMain", () => {
  const clientId = 7;

  let sut: NativeMessagingMain;
  let logService: MockProxy<LogService>;
  let emit: (error: unknown, message: ipc.IpcMessage) => void;

  /** Delivers a native message from `clientId`, as the napi server would. */
  function receive(message: object): void {
    emit(null, {
      kind: ipc.IpcMessageType.Message,
      clientId,
      message: JSON.stringify(message),
    } as ipc.IpcMessage);
  }

  /** Connects `clientId`, carrying `announcement` as the napi server would. */
  function connect(announcement?: object): void {
    emit(null, {
      kind: ipc.IpcMessageType.Connected,
      clientId,
      message: announcement == null ? undefined : JSON.stringify(announcement),
    } as ipc.IpcMessage);
  }

  beforeEach(async () => {
    jest.clearAllMocks();

    jest.mocked(ipc.NativeIpcServer.listen).mockImplementation((_name, callback) => {
      emit = callback as typeof emit;
      return Promise.resolve(mock<ipc.NativeIpcServer>({ getPaths: () => [] }));
    });

    logService = mock<LogService>();
    sut = new NativeMessagingMain(logService, mock<WindowMain>(), "userPath", "exe", "app");
    await sut.listen();
  });

  it("reports no client type for a client that is not connected", () => {
    expect(sut.clientTypeFor(clientId)).toBeUndefined();
  });

  it("reports an unknown client type for a client that never announced one", () => {
    connect();

    expect(sut.clientTypeFor(clientId)).toBe(DesktopIpcPeerClientType.Unknown);
  });

  it("records an announced client type", () => {
    connect({ clientType: DesktopIpcPeerClientType.Cli });

    expect(sut.clientTypeFor(clientId)).toBe(DesktopIpcPeerClientType.Cli);
  });

  it("reports an unknown client type for a malformed announcement", () => {
    emit(null, {
      kind: ipc.IpcMessageType.Connected,
      clientId,
      message: "not json",
    } as ipc.IpcMessage);

    expect(sut.clientTypeFor(clientId)).toBe(DesktopIpcPeerClientType.Unknown);
  });

  it("logs the announced client details", () => {
    connect({
      clientType: DesktopIpcPeerClientType.Firefox,
      extensionId: "{id}",
      unexpected: "not logged",
    });

    expect(logService.info).toHaveBeenCalledWith(
      `Native messaging client ${clientId} has connected as firefox`,
      { extensionId: "{id}" },
    );
  });

  it("relays other messages", () => {
    const relayed = jest.fn();
    sut.messages$.subscribe(relayed);

    receive({ type: "bitwarden-ipc-message" });

    expect(relayed).toHaveBeenCalled();
  });

  it("forgets the client type once the client disconnects, so a reused id is not stale", () => {
    connect({ clientType: DesktopIpcPeerClientType.Cli });

    emit(null, { kind: ipc.IpcMessageType.Disconnected, clientId } as ipc.IpcMessage);

    expect(sut.clientTypeFor(clientId)).toBeUndefined();
  });

  describe("generateManifests on linux", () => {
    const manifestName = "com.8bit.bitwarden.json";
    const platform = process.platform;

    let home: string;

    beforeEach(() => {
      home = mkdtempSync(path.join(tmpdir(), "nmh-"));
      Object.defineProperty(process, "platform", { value: "linux" });
      jest.spyOn(sut as any, "homedir").mockReturnValue(home);

      // Stand-in for the desktop_proxy binary the manifests point to.
      const binary = path.join(home, "desktop_proxy");
      writeFileSync(binary, "");
      jest.spyOn(sut as any, "binaryPath").mockReturnValue(binary);
    });

    afterEach(() => {
      Object.defineProperty(process, "platform", { value: platform });
      rmSync(home, { recursive: true, force: true });
    });

    it("writes the firefox manifest when only the XDG profile dir exists", async () => {
      mkdirSync(path.join(home, ".config", "mozilla"), { recursive: true });

      await sut.generateManifests();

      const nmhs = path.join(home, ".mozilla", "native-messaging-hosts");
      expect(existsSync(path.join(nmhs, manifestName))).toBe(true);
    });

    it("writes the flatpak firefox manifest when only the app dir exists", async () => {
      const app = path.join(home, ".var", "app", "org.mozilla.firefox");
      mkdirSync(app, { recursive: true });

      await sut.generateManifests();

      const nmhs = path.join(app, ".mozilla", "native-messaging-hosts");
      expect(existsSync(path.join(nmhs, manifestName))).toBe(true);
    });

    // Chromium-based browsers don't always ship a NativeMessagingHosts dir.
    it("writes the chromium manifest when the NativeMessagingHosts dir is missing", async () => {
      mkdirSync(path.join(home, ".config", "chromium"), { recursive: true });

      await sut.generateManifests();

      const nmhs = path.join(home, ".config", "chromium", "NativeMessagingHosts");
      expect(existsSync(path.join(nmhs, manifestName))).toBe(true);
    });

    it("skips firefox when no profile dir exists", async () => {
      await sut.generateManifests();

      expect(existsSync(path.join(home, ".mozilla"))).toBe(false);
      expect(existsSync(path.join(home, ".var"))).toBe(false);
    });
  });
});

describe("NativeMessagingMain.generateManifests on Windows", () => {
  const chromeKey = "SOFTWARE\\Google\\Chrome\\NativeMessagingHosts\\com.8bit.bitwarden";
  const originalPlatform = process.platform;
  const originalResourcesPath = process.resourcesPath;
  const originalLocalAppData = process.env.LOCALAPPDATA;

  let root: string;
  let userPath: string;
  let localAppData: string;
  let installPath: string;
  let sut: NativeMessagingMain;

  /** Reads the Chrome manifest that `generateManifests` registered for browsers to discover. */
  function readRegisteredChromeManifest(): { path: string } {
    const [, , manifestPath] = jest
      .mocked(windows_registry.createKey)
      .mock.calls.find(([, subkey]) => subkey === chromeKey);
    return JSON.parse(readFileSync(manifestPath, "utf8"));
  }

  /** Runs as if from the Appx with this package full name, whose package folder exists. */
  async function runFromAppx(packageFullName: string, packageFamilyName: string) {
    jest.mocked(isWindowsStore).mockReturnValue(true);
    Object.defineProperty(process, "resourcesPath", {
      value: `C:\\Program Files\\WindowsApps\\${packageFullName}\\app\\resources`,
      configurable: true,
    });
    mkdirSync(path.join(localAppData, "Packages", packageFamilyName, "LocalState"), {
      recursive: true,
    });
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    Object.defineProperty(process, "platform", { value: "win32" });

    // %APPDATA%\Bitwarden is left uncreated: the Appx may be installed without it.
    root = mkdtempSync(path.join(tmpdir(), "bitwarden-"));
    userPath = path.join(root, "Roaming", "Bitwarden");
    localAppData = path.join(root, "Local");
    installPath = path.join(root, "install");
    process.env.LOCALAPPDATA = localAppData;
    mkdirSync(installPath);
    writeFileSync(path.join(installPath, "desktop_proxy.exe"), "");

    sut = new NativeMessagingMain(
      mock<LogService>(),
      mock<WindowMain>(),
      userPath,
      path.join(installPath, "Bitwarden.exe"),
      "app",
    );
  });

  afterEach(async () => {
    Object.defineProperty(process, "platform", { value: originalPlatform });
    Object.defineProperty(process, "resourcesPath", {
      value: originalResourcesPath,
      configurable: true,
    });
    process.env.LOCALAPPDATA = originalLocalAppData;
    rmSync(root, { recursive: true, force: true });
  });

  it("registers a manifest in the user data directory pointing at the proxy beside the app outside an Appx", async () => {
    jest.mocked(isWindowsStore).mockReturnValue(false);
    mkdirSync(userPath, { recursive: true });

    await sut.generateManifests();

    expect(windows_registry.createKey).toHaveBeenCalledWith(
      "HKCU",
      chromeKey,
      path.join(userPath, "browsers", "chrome.json"),
    );
    expect((readRegisteredChromeManifest()).path).toBe(
      path.join(installPath, "desktop_proxy.exe"),
    );
  });

  it("registers a manifest in the package folder pointing at the proxy's execution alias in the Appx", async () => {
    await runFromAppx(
      "8bitSolutionsLLC.bitwardendesktop_1.0.0.0_x64__h4e712dmw3xyy",
      "8bitSolutionsLLC.bitwardendesktop_h4e712dmw3xyy",
    );

    await sut.generateManifests();

    expect(windows_registry.createKey).toHaveBeenCalledWith(
      "HKCU",
      chromeKey,
      path.join(
        localAppData,
        "Packages",
        "8bitSolutionsLLC.bitwardendesktop_h4e712dmw3xyy",
        "LocalState",
        "browsers",
        "chrome.json",
      ),
    );
    expect((readRegisteredChromeManifest()).path).toBe(
      path.join(localAppData, "Microsoft", "WindowsApps", "bitwarden_desktop_proxy.exe"),
    );
  });

  it("registers a manifest in the package folder pointing at the Beta proxy's execution alias in the Beta Appx", async () => {
    await runFromAppx(
      "8bitSolutionsLLC.BitwardenBeta_1.0.0.0_x64__h4e712dmw3xyy",
      "8bitSolutionsLLC.BitwardenBeta_h4e712dmw3xyy",
    );

    await sut.generateManifests();

    expect(windows_registry.createKey).toHaveBeenCalledWith(
      "HKCU",
      chromeKey,
      path.join(
        localAppData,
        "Packages",
        "8bitSolutionsLLC.BitwardenBeta_h4e712dmw3xyy",
        "LocalState",
        "browsers",
        "chrome.json",
      ),
    );
    expect((readRegisteredChromeManifest()).path).toBe(
      path.join(localAppData, "Microsoft", "WindowsApps", "bitwarden_beta_desktop_proxy.exe"),
    );
  });
});
