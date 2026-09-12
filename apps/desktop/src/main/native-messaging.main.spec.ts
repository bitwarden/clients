import { existsSync, promises as fs } from "fs";

import { mock, MockProxy } from "jest-mock-extended";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import { NativeMessagingMain } from "./native-messaging.main";
import { WindowMain } from "./window.main";

jest.mock("electron", () => ({
  ipcMain: { handle: jest.fn(), on: jest.fn() },
}));

jest.mock("@bitwarden/desktop-napi", () => ({
  ipc: { NativeIpcServer: { listen: jest.fn() } },
  windows_registry: { createKey: jest.fn(), deleteKey: jest.fn() },
}));

jest.mock("fs", () => ({
  ...jest.requireActual("fs"),
  existsSync: jest.fn(),
  promises: {
    ...jest.requireActual("fs").promises,
    mkdir: jest.fn(),
    writeFile: jest.fn(),
    unlink: jest.fn(),
  },
}));

jest.mock("os", () => ({
  ...jest.requireActual("os"),
  homedir: jest.fn(() => "/Users/test"),
  userInfo: jest.fn(() => ({ homedir: "/Users/test", username: "test" })),
}));

jest.mock("../utils", () => ({ isDev: () => false }));

describe("NativeMessagingMain", () => {
  const APP_SUPPORT = "/Users/test/Library/Application Support";
  const EXE_PATH = "/Applications/Bitwarden.app/Contents/MacOS/Bitwarden";
  const BINARY_PATH = "/Applications/Bitwarden.app/Contents/MacOS/desktop_proxy";

  const FIREFOX_PROFILES = `${APP_SUPPORT}/Firefox/`;
  const MOZILLA = `${APP_SUPPORT}/Mozilla/`;
  const CHROME = `${APP_SUPPORT}/Google/Chrome/`;

  const FIREFOX_MANIFEST = `${APP_SUPPORT}/Mozilla/NativeMessagingHosts/com.8bit.bitwarden.json`;
  const CHROME_MANIFEST = `${APP_SUPPORT}/Google/Chrome/NativeMessagingHosts/com.8bit.bitwarden.json`;

  let logService: MockProxy<LogService>;
  let sut: NativeMessagingMain;
  let originalPlatform: PropertyDescriptor;

  const givenOnDisk = (paths: string[]) => {
    const present = new Set([BINARY_PATH, ...paths]);
    (existsSync as jest.Mock).mockImplementation((candidate: string) => present.has(candidate));
  };

  const manifestWrittenTo = (destination: string) => {
    const call = (fs.writeFile as jest.Mock).mock.calls.find(([target]) => target === destination);
    return call == null ? undefined : JSON.parse(call[1]);
  };

  beforeEach(() => {
    jest.clearAllMocks();

    originalPlatform = Object.getOwnPropertyDescriptor(process, "platform");
    Object.defineProperty(process, "platform", { value: "darwin", configurable: true });

    (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
    (fs.writeFile as jest.Mock).mockResolvedValue(undefined);
    (fs.unlink as jest.Mock).mockResolvedValue(undefined);

    logService = mock<LogService>();
    sut = new NativeMessagingMain(
      logService,
      mock<WindowMain>(),
      "/user/path",
      EXE_PATH,
      "/app/path",
    );
  });

  afterEach(() => {
    Object.defineProperty(process, "platform", originalPlatform);
  });

  describe("generateManifests on macOS", () => {
    it("installs the Firefox manifest when only the Firefox profile directory exists", async () => {
      givenOnDisk([FIREFOX_PROFILES]);

      await sut.generateManifests();

      expect(fs.mkdir).toHaveBeenCalledWith(`${APP_SUPPORT}/Mozilla/NativeMessagingHosts`, {
        recursive: true,
      });
      expect(manifestWrittenTo(FIREFOX_MANIFEST)).toEqual(
        expect.objectContaining({
          name: "com.8bit.bitwarden",
          path: BINARY_PATH,
          allowed_extensions: ["{446900e4-71c2-419f-a6a7-df9c091e268b}"],
        }),
      );
    });

    it("still installs the Firefox manifest when only Mozilla/ exists", async () => {
      givenOnDisk([MOZILLA]);

      await sut.generateManifests();

      expect(manifestWrittenTo(FIREFOX_MANIFEST)).toBeDefined();
    });

    it("skips Firefox when neither the profile directory nor Mozilla/ exists", async () => {
      givenOnDisk([CHROME]);

      await sut.generateManifests();

      expect(manifestWrittenTo(FIREFOX_MANIFEST)).toBeUndefined();
      expect(logService.warning).toHaveBeenCalledWith("Firefox not found, skipping.");
    });

    it("installs a Chrome-flavoured manifest for chromium browsers", async () => {
      givenOnDisk([CHROME]);

      await sut.generateManifests();

      expect(manifestWrittenTo(CHROME_MANIFEST)).toEqual(
        expect.objectContaining({
          allowed_origins: expect.arrayContaining([
            "chrome-extension://nngceckbapebfimnlniiiahkandclblb/",
          ]),
        }),
      );
    });

    it("still installs the other browsers when the Mozilla directory cannot be created", async () => {
      givenOnDisk([FIREFOX_PROFILES, CHROME]);
      (fs.mkdir as jest.Mock).mockImplementation((directory: string) =>
        directory.includes("Mozilla")
          ? Promise.reject(new Error("EPERM: operation not permitted"))
          : Promise.resolve(undefined),
      );

      await expect(sut.generateManifests()).resolves.toBeUndefined();

      expect(manifestWrittenTo(FIREFOX_MANIFEST)).toBeUndefined();
      expect(manifestWrittenTo(CHROME_MANIFEST)).toBeDefined();
      expect(logService.error).toHaveBeenCalledWith(expect.stringContaining("Firefox"));
    });

    it("still installs the other browsers when the Firefox manifest cannot be written", async () => {
      givenOnDisk([FIREFOX_PROFILES, CHROME]);
      (fs.writeFile as jest.Mock).mockImplementation((target: string) =>
        target === FIREFOX_MANIFEST
          ? Promise.reject(new Error("EACCES: permission denied"))
          : Promise.resolve(undefined),
      );

      await expect(sut.generateManifests()).resolves.toBeUndefined();

      expect(manifestWrittenTo(CHROME_MANIFEST)).toBeDefined();
      expect(logService.error).toHaveBeenCalledWith(expect.stringContaining("Firefox"));
    });
  });

  describe("removeManifests on macOS", () => {
    it("removes the Firefox manifest from Mozilla/NativeMessagingHosts", async () => {
      givenOnDisk([FIREFOX_MANIFEST]);

      await sut.removeManifests();

      expect(fs.unlink).toHaveBeenCalledWith(FIREFOX_MANIFEST);
    });
  });
});
