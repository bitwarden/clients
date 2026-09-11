import { existsSync, promises as fs } from "fs";
import { homedir, tmpdir } from "os";
import * as path from "path";

import { mock } from "jest-mock-extended";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import { NativeMessagingMain } from "./native-messaging.main";
import { WindowMain } from "./window.main";

// native-messaging.main.ts registers ipcMain handlers at construction, and its
// WindowMain import registers a privileged scheme at module load time. Mock the
// surface both touch so the module can be loaded in Jest.
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

// Both modules load native .node modules at import time.
jest.mock("@bitwarden/desktop-napi", () => ({
  ipc: { NativeIpcServer: { listen: jest.fn() } },
  windows_registry: { createKey: jest.fn(), deleteKey: jest.fn() },
  processisolations: {
    isolateProcess: jest.fn(),
    isCoreDumpingDisabled: jest.fn(),
    disableCoredumps: jest.fn(),
  },
}));

jest.mock("os", () => ({
  ...jest.requireActual("os"),
  homedir: jest.fn(),
}));

describe("NativeMessagingMain", () => {
  const originalPlatform = process.platform;

  let home: string;
  let logService: LogService;
  let nativeMessagingMain: NativeMessagingMain;

  const firefoxManifest = () =>
    path.join(home, ".mozilla", "native-messaging-hosts", "com.8bit.bitwarden.json");
  const chromeManifest = () =>
    path.join(home, ".config", "google-chrome", "NativeMessagingHosts", "com.8bit.bitwarden.json");
  const edgeManifest = () =>
    path.join(home, ".config", "microsoft-edge", "NativeMessagingHosts", "com.8bit.bitwarden.json");

  beforeEach(async () => {
    Object.defineProperty(process, "platform", { value: "linux", configurable: true });
    globalThis.BIT_ENVIRONMENT = "production";

    home = await fs.mkdtemp(path.join(tmpdir(), "bw-nmh-"));
    jest.mocked(homedir).mockReturnValue(home);

    // The proxy binary must exist for generateManifests to proceed.
    const appDir = path.join(home, "app");
    await fs.mkdir(appDir, { recursive: true });
    await fs.writeFile(path.join(appDir, "desktop_proxy"), "");

    logService = mock<LogService>();
    nativeMessagingMain = new NativeMessagingMain(
      logService,
      mock<WindowMain>(),
      path.join(home, "userData"),
      path.join(appDir, "bitwarden"),
      appDir,
    );
  });

  afterEach(async () => {
    Object.defineProperty(process, "platform", { value: originalPlatform, configurable: true });
    await fs.rm(home, { recursive: true, force: true });
    jest.clearAllMocks();
  });

  describe("generateManifests on linux", () => {
    it("creates the native messaging hosts directory for chromium browsers", async () => {
      // Browser config directory present, but no NativeMessagingHosts subdirectory in it.
      await fs.mkdir(path.join(home, ".config", "google-chrome"), { recursive: true });

      await nativeMessagingMain.generateManifests();

      expect(existsSync(chromeManifest())).toBe(true);
      expect(
        existsSync(
          path.join(
            home,
            ".config",
            "google-chrome",
            "NativeMessagingHosts",
            ".bitwarden_desktop_proxy",
          ),
        ),
      ).toBe(true);
    });

    it("continues with the remaining browsers when one fails", async () => {
      await fs.mkdir(path.join(home, ".mozilla"), { recursive: true });
      await fs.mkdir(path.join(home, ".config", "chromium"), { recursive: true });
      await fs.mkdir(path.join(home, ".config", "microsoft-edge"), { recursive: true });

      // A file where the directory belongs makes the Chromium step fail. Chromium sits
      // between Firefox and Microsoft Edge in the iteration order.
      await fs.writeFile(path.join(home, ".config", "chromium", "NativeMessagingHosts"), "");

      await expect(nativeMessagingMain.generateManifests()).resolves.not.toThrow();

      expect(existsSync(firefoxManifest())).toBe(true);
      expect(existsSync(edgeManifest())).toBe(true);
      expect(logService.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to set up Chromium"),
        expect.anything(),
      );
    });
  });
});
