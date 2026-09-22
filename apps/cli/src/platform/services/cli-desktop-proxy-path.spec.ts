import {
  DESKTOP_PROXY_PATH_ENV,
  getDesktopProxyPaths,
  resolveDesktopProxyPath,
} from "./cli-desktop-proxy-path";

describe("getDesktopProxyPaths", () => {
  it("returns the standard Windows desktop installation paths", () => {
    expect(
      getDesktopProxyPaths("win32", "C:\\Users\\alice", {
        LOCALAPPDATA: "C:\\Users\\alice\\AppData\\Local",
        ProgramFiles: "C:\\Program Files",
        "ProgramFiles(x86)": "C:\\Program Files (x86)",
      }),
    ).toEqual([
      "C:\\Users\\alice\\AppData\\Local\\Programs\\Bitwarden\\desktop_proxy.exe",
      "C:\\Program Files\\Bitwarden\\desktop_proxy.exe",
      "C:\\Program Files (x86)\\Bitwarden\\desktop_proxy.exe",
    ]);
  });

  it("returns system and per-user macOS application paths", () => {
    expect(getDesktopProxyPaths("darwin", "/Users/alice", {})).toEqual([
      "/Applications/Bitwarden.app/Contents/MacOS/desktop_proxy",
      "/Users/alice/Applications/Bitwarden.app/Contents/MacOS/desktop_proxy",
    ]);
  });

  it("returns standard desktop installation paths on Linux", () => {
    expect(getDesktopProxyPaths("linux", "/home/alice", {})).toEqual([
      "/opt/Bitwarden/desktop_proxy",
      "/app/Bitwarden/desktop_proxy",
      "/usr/lib/bitwarden/desktop_proxy",
      "/usr/lib/bitwarden-desktop/desktop_proxy",
      "/snap/bitwarden/current/desktop_proxy",
    ]);
  });
});

describe("resolveDesktopProxyPath", () => {
  it("prefers the environment override", () => {
    expect(resolveDesktopProxyPath(["/standard/proxy"], "/custom/proxy", () => true)).toBe(
      "/custom/proxy",
    );
  });

  it("rejects an invalid environment override", () => {
    expect(() => resolveDesktopProxyPath([], "/missing/proxy", () => false)).toThrow(
      `${DESKTOP_PROXY_PATH_ENV} points to a file that does not exist`,
    );
  });

  it("selects the first existing well-known path", () => {
    expect(
      resolveDesktopProxyPath(["/missing/proxy", "/installed/proxy"], undefined, (candidate) =>
        candidate.startsWith("/installed"),
      ),
    ).toBe("/installed/proxy");
  });

  it("reports how to configure a non-standard proxy path", () => {
    expect(() => resolveDesktopProxyPath([], undefined, () => false)).toThrow(
      `Set ${DESKTOP_PROXY_PATH_ENV} to its path`,
    );
  });
});
