jest.mock("electron", () => ({
  app: { getLoginItemSettings: jest.fn() },
}));

import { app } from "electron";

import { AUTOSTART_FLAG, isAutostartLaunch } from "./autostart";

describe("isAutostartLaunch", () => {
  const originalArgv = process.argv;
  const originalPlatform = process.platform;

  const setPlatform = (platform: NodeJS.Platform) => {
    Object.defineProperty(process, "platform", { value: platform, configurable: true });
  };

  afterEach(() => {
    process.argv = originalArgv;
    setPlatform(originalPlatform);
    jest.clearAllMocks();
  });

  it.each<NodeJS.Platform>(["darwin", "win32", "linux"])(
    "returns true when the autostart flag is present on %s",
    (platform) => {
      setPlatform(platform);
      process.argv = ["bitwarden", AUTOSTART_FLAG];

      expect(isAutostartLaunch()).toBe(true);
    },
  );

  it("returns true on macOS when the OS reports the app was opened at login", () => {
    setPlatform("darwin");
    process.argv = ["bitwarden"];
    jest.mocked(app.getLoginItemSettings).mockReturnValue({ wasOpenedAtLogin: true } as any);

    expect(isAutostartLaunch()).toBe(true);
  });

  it("returns false on macOS when the app was opened by the user", () => {
    setPlatform("darwin");
    process.argv = ["bitwarden"];
    jest.mocked(app.getLoginItemSettings).mockReturnValue({ wasOpenedAtLogin: false } as any);

    expect(isAutostartLaunch()).toBe(false);
  });

  it.each<NodeJS.Platform>(["win32", "linux"])(
    "returns false without the flag on %s and does not query login items",
    (platform) => {
      setPlatform(platform);
      process.argv = ["bitwarden"];

      expect(isAutostartLaunch()).toBe(false);
      expect(app.getLoginItemSettings).not.toHaveBeenCalled();
    },
  );
});
