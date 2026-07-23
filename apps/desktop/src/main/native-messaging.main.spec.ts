import { promises as fsPromises } from "fs";

import { mock } from "jest-mock-extended";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import * as utils from "../utils";

import { NativeMessagingMain } from "./native-messaging.main";
import { WindowMain } from "./window.main";

// The constructor registers ipcMain handlers, and importing this module pulls in
// window.main.ts, which registers a privileged scheme and loads a native module at
// import time. Mock the electron/napi surface so the module loads under Jest.
// jest.mock calls are hoisted above these imports, so the mocks are registered first.
jest.mock("electron", () => ({
  app: {},
  BrowserWindow: jest.fn(),
  ipcMain: { on: jest.fn(), handle: jest.fn() },
  nativeTheme: {},
  screen: {},
  session: {},
  protocol: { registerSchemesAsPrivileged: jest.fn() },
  net: {},
}));

jest.mock("@bitwarden/desktop-napi", () => ({
  ipc: {},
  windows_registry: {},
  processisolations: {
    isolateProcess: jest.fn(),
    isCoreDumpingDisabled: jest.fn(),
    disableCoredumps: jest.fn(),
  },
}));

jest.mock("../utils", () => ({
  isDev: jest.fn(() => false),
  isMacAppStore: jest.fn(() => false),
}));

jest.mock("fs", () => ({
  existsSync: jest.fn(() => true),
  promises: { writeFile: jest.fn(), mkdir: jest.fn() },
}));

describe("NativeMessagingMain", () => {
  const exePath = "/Applications/Bitwarden.app/Contents/MacOS/Bitwarden";
  const proxyPath = "/Applications/Bitwarden.app/Contents/MacOS/desktop_proxy";

  let sut: NativeMessagingMain;
  let originalPlatform: PropertyDescriptor | undefined;

  beforeEach(() => {
    jest.clearAllMocks();
    (utils.isDev as jest.Mock).mockReturnValue(false);

    // generateDdgManifests only writes a manifest on darwin.
    originalPlatform = Object.getOwnPropertyDescriptor(process, "platform");
    Object.defineProperty(process, "platform", { value: "darwin" });

    sut = new NativeMessagingMain(
      mock<LogService>(),
      mock<WindowMain>(),
      "/user-path",
      exePath,
      "/app-path",
    );
  });

  afterEach(() => {
    if (originalPlatform) {
      Object.defineProperty(process, "platform", originalPlatform);
    }
  });

  // Parses the manifest JSON handed to fs.writeFile and returns its `path` field.
  function writtenManifestPath(): string {
    const writeFile = fsPromises.writeFile as jest.Mock;
    expect(writeFile).toHaveBeenCalledTimes(1);
    const [, contents] = writeFile.mock.calls[0];
    return JSON.parse(contents as string).path;
  }

  describe("generateDdgManifests", () => {
    it("points the DDG manifest at the app executable on the Mac App Store build", async () => {
      // On the sandboxed MAS build DDG must launch the app so entry.ts can spawn
      // desktop_proxy.inherit, which inherits the App Group socket access.
      (utils.isMacAppStore as jest.Mock).mockReturnValue(true);

      await sut.generateDdgManifests();

      expect(writtenManifestPath()).toBe(exePath);
    });

    it("points the DDG manifest at desktop_proxy on non-App-Store builds", async () => {
      (utils.isMacAppStore as jest.Mock).mockReturnValue(false);

      await sut.generateDdgManifests();

      expect(writtenManifestPath()).toBe(proxyPath);
    });
  });
});
